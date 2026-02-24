const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { computeTithi } = require('./tithiCalculator');
const { apiKeyMiddleware } = require('./api/middleware');
const apiRoutes = require('./api/routes');

// Initialize admin SDK (Cloud Functions provide credentials automatically)
admin.initializeApp();
// Use the named Firestore database (this project does not use the default database)
admin.firestore().settings({ databaseId: 'hamropanchanga-db' });

// ─── Public Nepali Calendar REST API ─────────────────────────────────────────

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check — no auth required
app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok', version: 'v1', timestamp: new Date().toISOString() });
});

// All /v1/* routes require a valid API key
app.use('/v1', apiKeyMiddleware, apiRoutes);

// Catch-all 404
app.use((req, res) => res.status(404).json({ error: 'Not Found', message: `No route for ${req.method} ${req.path}` }));

exports.api = functions.https.onRequest(app);

/**
 * Callable function to set or remove admin role for a user by email.
 * - Requires caller to be authenticated and have admin claim
 * - Input: { email: string, makeAdmin: boolean }
 * - Returns: { success: boolean, uid, email, makeAdmin }
 */
exports.setAdminRole = functions.https.onCall(async (data, context) => {
  // Only allow authenticated users
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  // Only allow callers who are already admins
  if (!context.auth.token || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can assign roles.');
  }

  const email = data.email;
  const makeAdmin = !!data.makeAdmin;

  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Please provide a valid email.');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    // Get existing custom claims
    const existingClaims = userRecord.customClaims || {};

    if (makeAdmin) {
      existingClaims.admin = true;
    } else {
      delete existingClaims.admin;
    }

    await admin.auth().setCustomUserClaims(uid, existingClaims);

    // Audit: write into Firestore users collection
    await admin.firestore().collection('users').doc(uid).set({
      role: makeAdmin ? 'admin' : 'user',
      email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      changedBy: context.auth.uid
    }, { merge: true });

    return { success: true, uid, email, makeAdmin };
  } catch (err) {
    console.error('setAdminRole error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

/**
 * Callable function to sync Firebase Authentication users to Firestore users collection.
 * This helps populate user data for users who logged in before the invitation system was implemented.
 * - Requires caller to be authenticated and have admin permissions
 * - Returns: { success: boolean, syncedCount: number, users: array }
 */
exports.syncAuthUsersToFirestore = functions.https.onCall(async (data, context) => {
  // Only allow authenticated users
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  // Check if caller is admin (either via custom claim or adminList)
  const isAdminClaim = context.auth.token && context.auth.token.admin === true;
  const adminListDoc = await admin.firestore().collection('adminList').doc(context.auth.uid).get();
  const isInAdminList = adminListDoc.exists;

  if (!isAdminClaim && !isInAdminList) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can sync users.');
  }

  try {
    const syncedUsers = [];
    let nextPageToken;
    
    // List all users from Firebase Authentication
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      
      for (const userRecord of listUsersResult.users) {
        // Check if user document exists in Firestore
        const userDocRef = admin.firestore().collection('users').doc(userRecord.uid);
        const userDocSnap = await userDocRef.get();
        
        if (!userDocSnap.exists) {
          // Check if user is in adminList before creating user document
          const adminDocRef = admin.firestore().collection('adminList').doc(userRecord.uid);
          const adminDocSnap = await adminDocRef.get();
          
          // Skip admins - they don't need user documents
          if (adminDocSnap.exists) {
            console.log('Skipping admin user:', userRecord.email);
            continue;
          }
          
          // Check if user has a pending invitation
          const invitationQuery = await admin.firestore()
            .collection('userInvitations')
            .where('email', '==', userRecord.email.toLowerCase())
            .limit(1)
            .get();
          
          let role = 'user';
          let permissions = {
            viewOwnCustomers: true,
            manageOwnCustomers: true,
            viewAllCustomers: false,
            manageHomeCards: false,
            manageTithis: false,
            manageEvents: false,
            bulkUpload: false,
            manageUsers: false,
            manualDashboard: false
          };
          
          // If user has invitation, use those settings
          if (!invitationQuery.empty) {
            const invitationData = invitationQuery.docs[0].data();
            if (!invitationData.processed) {
              role = invitationData.role || 'user';
              permissions = invitationData.permissions || permissions;
            }
          }
          
          // User doesn't have a Firestore document - create one
          await userDocRef.set({
            email: userRecord.email || '',
            displayName: userRecord.displayName || '',
            role: role,
            permissions: permissions,
            active: true,
            createdAt: userRecord.metadata.creationTime || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedFromAuth: true,
            syncedBy: context.auth.uid,
            syncedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          syncedUsers.push({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            role: role
          });
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    return { 
      success: true, 
      syncedCount: syncedUsers.length,
      users: syncedUsers
    };
  } catch (err) {
    console.error('syncAuthUsersToFirestore error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

/**
 * Callable function to compute Sun and Moon ecliptic longitudes using Python Skyfield.
 * Input: { date: string (ISO datetime), lat?: number, lon?: number }
 * Returns: { sunLon: number, moonLon: number, sunLat: number, moonLat: number }
 */
exports.computeEphemeris = functions.https.onCall(async (data, context) => {
  const { date, lat, lon } = data;
  if (!date || typeof date !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Date (ISO string) is required');
  }

  const latitude = lat != null ? lat : 27.7172;
  const longitude = lon != null ? lon : 85.3240;

  console.log('computeEphemeris called with:', { date, lat, lon });

  try {
    const result = computeTithi(date, latitude, longitude);
    console.log('Computed result:', result);
    
    return {
      sunLon: result.sun_lon_deg,
      moonLon: result.moon_lon_deg,
      sunLat: result.sun_lat_deg || 0,
      moonLat: result.moon_lat_deg || 0,
      tithiStart: result.tithi_start_utc,
      tithiEnd: result.tithi_end_utc
    };
  } catch (err) {
    console.error('computeTithi error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// ─── Daily rate-limit counter reset (runs at 00:00 UTC) ────────────────────

exports.resetApiRateLimits = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const snap = await db.collection('apiKeys').where('active', '==', true).get();
    if (snap.empty) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { requestsToday: 0, rateLimitDate: todayStr });
    });
    await batch.commit();
    console.log(`Reset rate limits for ${snap.size} API keys.`);
    return null;
  });

// ─── Approve API Key Request (admin-only callable) ──────────────────────────

exports.approveApiKeyRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  // Verify caller is an admin
  const isAdminClaim = context.auth.token && context.auth.token.admin === true;
  const adminDoc = await admin.firestore().collection('adminList').doc(context.auth.uid).get();
  if (!isAdminClaim && !adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can approve API key requests.');
  }

  const { requestId } = data;
  if (!requestId || typeof requestId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');
  }

  const db = admin.firestore();
  const requestRef = db.collection('apiKeyRequests').doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'API key request not found.');
  }

  const requestData = requestSnap.data();
  if (requestData.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', `Request is already ${requestData.status}.`);
  }

  // Generate a new API key: npcal_<32 random hex bytes>
  const rawKey = 'npcal_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Write to apiKeys collection (hash only — never store raw key there)
  const keyRef = db.collection('apiKeys').doc();
  await keyRef.set({
    keyHash,
    owner: requestData.name || requestData.email,
    email: requestData.email,
    uid: requestData.uid,
    plan: 'free',
    active: true,
    rateLimit: 1000,
    requestsToday: 0,
    rateLimitDate: new Date().toISOString().slice(0, 10),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsed: null,
  });

  // Update the request document: store raw key once for the user to copy
  await requestRef.update({
    status: 'approved',
    keyId: keyRef.id,
    rawKey,                   // shown once; user acknowledges and it stays masked
    rawKeyAcknowledged: false,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: context.auth.uid,
  });

  return { success: true, keyId: keyRef.id };
});

// ─── Reject API Key Request (admin-only callable) ───────────────────────────

exports.rejectApiKeyRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const isAdminClaim = context.auth.token && context.auth.token.admin === true;
  const adminDoc = await admin.firestore().collection('adminList').doc(context.auth.uid).get();
  if (!isAdminClaim && !adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can reject API key requests.');
  }

  const { requestId, rejectionReason } = data;
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');

  const db = admin.firestore();
  const requestRef = db.collection('apiKeyRequests').doc(requestId);
  const snap = await requestRef.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Request not found.');

  await requestRef.update({
    status: 'rejected',
    rejectionReason: rejectionReason || '',
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: context.auth.uid,
  });

  return { success: true };
});

// ─── Regenerate API Key (admin-only callable) ────────────────────────────────

exports.regenerateApiKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const isAdminClaim = context.auth.token && context.auth.token.admin === true;
  const adminDoc = await admin.firestore().collection('adminList').doc(context.auth.uid).get();
  if (!isAdminClaim && !adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can regenerate API keys.');
  }

  const { requestId } = data;
  if (!requestId || typeof requestId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');
  }

  const db = admin.firestore();
  const requestRef = db.collection('apiKeyRequests').doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'API key request not found.');
  }

  const requestData = requestSnap.data();
  if (requestData.status !== 'approved') {
    throw new functions.https.HttpsError('failed-precondition', 'Can only regenerate keys for approved requests.');
  }

  // Revoke the old API key if it exists
  if (requestData.keyId) {
    try {
      await db.collection('apiKeys').doc(requestData.keyId).delete();
    } catch (e) {
      console.warn('Could not delete old apiKey doc:', e.message);
    }
  }

  // Generate a fresh key
  const rawKey = 'npcal_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Write new apiKeys doc
  const keyRef = db.collection('apiKeys').doc();
  await keyRef.set({
    keyHash,
    owner: requestData.name || requestData.email,
    email: requestData.email,
    uid: requestData.uid,
    plan: 'free',
    active: true,
    rateLimit: 1000,
    requestsToday: 0,
    rateLimitDate: new Date().toISOString().slice(0, 10),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsed: null,
  });

  // Reset rawKey on the request — user will see the copy-key screen again
  await requestRef.update({
    keyId: keyRef.id,
    rawKey,
    rawKeyAcknowledged: false,
    regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    regeneratedBy: context.auth.uid,
  });

  return { success: true, keyId: keyRef.id };
});
