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

// ─── WhatsApp: notify on tree share ──────────────────────────────────────────
//
// Triggers when a `trees/{treeId}` document is updated.
// NOTE: WhatsApp notification is now handled by the shareTreeWithWhatsApp callable.
// This trigger is kept for future use but WhatsApp sending is disabled here.

const { sendTemplateMessage } = require('./whatsapp/sendWhatsApp');
const { getTargetDatesNPT } = require('./utils/dateUtils');

exports.onTreeShared = functions.firestore
  .database('hamropanchanga-db')
  .document('trees/{treeId}')
  .onUpdate(async (change, context) => {
    // WhatsApp notifications are sent directly by the shareTreeWithWhatsApp callable
    // which handles the invitation token logic. This trigger is a no-op for sharing.
    return null;
  });

// ─── WhatsApp: daily event reminders ─────────────────────────────────────────
//
// Runs daily at 00:15 UTC (≈ 06:00 NPT).
// Sends WhatsApp reminders for calendar events that fall on:
//   - today in NPT (day-of reminder)
//   - today + 7 days in NPT (week-ahead reminder)
//
// The calendarEvents collection uses `dateKey` (YYYY-MM-DD AD) as the date field.
// Only non-public (personal/tree) events are considered.

exports.sendEventReminders = functions.pubsub
  .schedule('15 0 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();

    // Determine target dates (today NPT and +7 days NPT, in AD YYYY-MM-DD format)
    const targetDates = getTargetDatesNPT();
    console.log('[sendEventReminders] Target dates:', targetDates);

    // Fetch all non-public events on either target date
    const eventSnaps = await Promise.all(
      targetDates.map((dateKey) =>
        db.collection('calendarEvents')
          .where('dateKey', '==', dateKey)
          .where('isPublic', '==', false)
          .get()
      )
    );

    // Collect all matching events, annotate with which date offset triggered them
    const allEvents = [];
    eventSnaps.forEach((snap, idx) => {
      const isWeekAhead = idx === 1;
      snap.docs.forEach((d) => {
        allEvents.push({ id: d.id, ...d.data(), isWeekAhead });
      });
    });

    if (allEvents.length === 0) {
      console.log('[sendEventReminders] No events to remind today.');
      return null;
    }

    // Group events by the UID that created them (createdBy field)
    const byCreator = {};
    for (const event of allEvents) {
      const uid = event.createdBy;
      if (!uid) continue;
      if (!byCreator[uid]) byCreator[uid] = [];
      byCreator[uid].push(event);
    }

    // Also collect tree-shared events: for each event that has a treeId,
    // notify every member of that tree who has opted in.
    const treeEventsByMember = {}; // memberEmail → events[]
    const treeCache = {};

    for (const event of allEvents) {
      if (!event.treeId) continue;

      if (!treeCache[event.treeId]) {
        try {
          const treeDoc = await db.collection('trees').doc(event.treeId).get();
          treeCache[event.treeId] = treeDoc.exists ? treeDoc.data() : null;
        } catch (_) {
          treeCache[event.treeId] = null;
        }
      }

      const treeData = treeCache[event.treeId];
      if (!treeData) continue;

      // sharedWith is a map { email: true }
      const memberEmails = Object.keys(treeData.sharedWith || {});
      for (const email of memberEmails) {
        if (!treeEventsByMember[email]) treeEventsByMember[email] = [];
        treeEventsByMember[email].push(event);
      }
    }

    // Helper to send a single reminder
    async function sendReminder(phoneNumber, displayName, event) {
      const dateLabel = event.isWeekAhead ? 'in 7 days' : 'today';
      const title     = event.title || event.tithi || 'an event';

      try {
        await sendTemplateMessage(
          phoneNumber,
          'event_reminder',
          'en',
          [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: displayName },
                { type: 'text', text: title },
                { type: 'text', text: dateLabel },
              ],
            },
          ]
        );
      } catch (err) {
        console.error(`[sendEventReminders] Failed for ${phoneNumber}:`, err.message);
      }
    }

    // Notify event creators
    await Promise.all(
      Object.entries(byCreator).map(async ([uid, events]) => {
        try {
          const userDoc = await db.collection('users').doc(uid).get();
          if (!userDoc.exists) return;
          const userData = userDoc.data();
          if (!userData.phoneNumber || !userData.whatsAppOptIn) return;

          for (const event of events) {
            await sendReminder(userData.phoneNumber, userData.displayName || 'there', event);
          }
        } catch (err) {
          console.error(`[sendEventReminders] Error for creator ${uid}:`, err.message);
        }
      })
    );

    // Notify tree-shared members (by email lookup)
    await Promise.all(
      Object.entries(treeEventsByMember).map(async ([email, events]) => {
        try {
          const usersSnap = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();
          if (usersSnap.empty) return;

          const userData = usersSnap.docs[0].data();
          const uid      = usersSnap.docs[0].id;

          if (!userData.phoneNumber || !userData.whatsAppOptIn) return;

          // Skip events already notified via the byCreator path
          const eventsToNotify = events.filter((e) => e.createdBy !== uid);
          for (const event of eventsToNotify) {
            await sendReminder(userData.phoneNumber, userData.displayName || 'there', event);
          }
        } catch (err) {
          console.error(`[sendEventReminders] Error for member ${email}:`, err.message);
        }
      })
    );

    console.log('[sendEventReminders] Done.');
    return null;
  });
// ─── Email: share tree callable ────────────────────────────────────────────
//
// Called when a user shares a tree by email (no WhatsApp phone provided).
// Two-branch logic:
//   A) Email found in users → grant access + send WhatsApp notification if opted in
//   B) Email NOT found → create invitation token + send email via Resend

const { Resend } = require('resend');

function buildInviteEmailHtml({ fromEmail, treeName, inviteUrl }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Family Tree Invitation</title></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="font-size:20px;color:#1a1a1a;margin-top:0;margin-bottom:8px;">Family tree shared with you</h1>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      <strong>${fromEmail}</strong> has shared the family tree
      <strong>&ldquo;${treeName}&rdquo;</strong> with you on HamroPanchanga.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">Click the link below to accept and view the tree:</p>
    <div style="margin:28px 0;">
      <a href="${inviteUrl}"
         style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">
        Accept Invitation
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;">Or copy this link into your browser:</p>
    <p style="color:#6b7280;font-size:12px;word-break:break-all;">${inviteUrl}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:11px;margin:0;">This invitation expires in 30 days. If you did not expect this email, you can safely ignore it. This is a one-time notification from HamroPanchanga.</p>
  </div>
</body>
</html>`;
}

function buildNotificationEmailHtml({ fromEmail, treeName, appUrl }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Family Tree Shared</title></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="font-size:20px;color:#1a1a1a;margin-top:0;margin-bottom:8px;">A family tree was shared with you</h1>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      <strong>${fromEmail}</strong> has shared the family tree
      <strong>&ldquo;${treeName}&rdquo;</strong> with you on HamroPanchanga.
      Sign in to view it.
    </p>
    <div style="margin:28px 0;">
      <a href="${appUrl}"
         style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">
        Open HamroPanchanga
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:11px;margin:0;">If you did not expect this email, you can safely ignore it. This is a one-time notification from HamroPanchanga.</p>
  </div>
</body>
</html>`;
}

exports.shareTreeWithEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { treeId, recipientEmail, permission } = data;

  if (!treeId || typeof treeId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'treeId is required.');
  }
  if (!recipientEmail || typeof recipientEmail !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'recipientEmail is required.');
  }
  const allowedPermissions = ['view', 'edit'];
  const resolvedPermission = allowedPermissions.includes(permission) ? permission : 'view';

  const db = admin.firestore();
  const treeRef = db.collection('trees').doc(treeId);
  const treeSnap = await treeRef.get();
  if (!treeSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Tree not found.');
  }
  const treeData = treeSnap.data();

  // Admins can share any tree on behalf of the owner
  let callerIsAdmin = context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const adminSnap = await db.collection('adminList').doc(context.auth.uid).get();
    callerIsAdmin = adminSnap.exists;
  }
  if (!callerIsAdmin) {
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = userSnap.exists && userSnap.data().role === 'admin';
  }

  if (!callerIsAdmin && treeData.ownerUid !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the tree owner can share it.');
  }

  const treeName = treeData.title || treeData.name || 'a family tree';
  const fromEmail = (context.auth.token.email || '').toLowerCase();

  // Show the tree owner's identity in notification emails (not the admin's)
  let ownerDisplay = treeData.ownerName;
  if (!ownerDisplay && callerIsAdmin && treeData.ownerUid !== context.auth.uid) {
    const ownerSnap = await db.collection('users').doc(treeData.ownerUid).get();
    if (ownerSnap.exists) {
      ownerDisplay = ownerSnap.data().displayName || ownerSnap.data().email || null;
    }
  }
  ownerDisplay = ownerDisplay || fromEmail;

  const recipientLower = recipientEmail.toLowerCase();

  // ── Branch A: recipient already has an account ────────────────────────
  const byEmailSnap = await db.collection('users')
    .where('email', '==', recipientLower)
    .limit(1)
    .get();

  if (!byEmailSnap.empty) {
    const foundUser = byEmailSnap.docs[0].data();
    const recipientDisplay = foundUser.displayName || recipientLower;

    await treeRef.update(
      new admin.firestore.FieldPath('sharedWith', recipientLower),
      {
        permission: resolvedPermission,
        sharedAt: admin.firestore.FieldValue.serverTimestamp(),
        sharedBy: fromEmail,
      },
      'sharedWithEmails',
      admin.firestore.FieldValue.arrayUnion(recipientLower),
    );

    // Send WhatsApp notification if recipient has opted in
    if (foundUser.phoneNumber && foundUser.whatsAppOptIn) {
      const lang = foundUser.phoneNumber.startsWith('+977') ? 'ne' : 'en';
      try {
        await sendTemplateMessage(foundUser.phoneNumber, 'tree_shared_notification', lang, [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: recipientDisplay },
              { type: 'text', text: ownerDisplay },
              { type: 'text', text: treeName },
            ],
          },
        ]);
      } catch (err) {
        console.error('[shareTreeWithEmail] Branch A: WhatsApp notify failed:', err.message);
      }
    }

    // Always send email notification to existing user
    const RESEND_API_KEY_A = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL_A = process.env.RESEND_FROM_EMAIL || 'noreply@hamropanchanga.com';
    if (RESEND_API_KEY_A) {
      try {
        const resend = new Resend(RESEND_API_KEY_A);
        await resend.emails.send({
          from: `HamroPanchanga <${RESEND_FROM_EMAIL_A}>`,
          to: [recipientLower],
          subject: `${ownerDisplay} shared a family tree with you on HamroPanchanga`,
          text: `${ownerDisplay} has shared the family tree "${treeName}" with you on HamroPanchanga. Sign in at https://hamropanchanga.com to view it.`,
          html: buildNotificationEmailHtml({
            fromEmail: ownerDisplay,
            treeName,
            appUrl: 'https://hamropanchanga.com',
          }),
        });
      } catch (err) {
        console.error('[shareTreeWithEmail] Branch A: Email notify failed:', err.message);
      }
    }

    return { branch: 'A', email: recipientLower };
  }

  // ── Branch B: unknown recipient → create invitation + send email ──────
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@hamropanchanga.com';

  if (!RESEND_API_KEY) {
    // Fallback: just grant access without sending email (graceful degradation)
    console.warn('[shareTreeWithEmail] RESEND_API_KEY not set — skipping email send.');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const invitationRef = db.collection('invitations').doc();
  const invitationId = invitationRef.id;

  await invitationRef.set({
    treeId,
    treeTitle: treeName,
    fromUid: context.auth.uid,
    fromEmail,
    hintEmail: recipientLower,
    whatsappPhone: null,
    permission: resolvedPermission,
    status: 'pending',
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    claimedByEmail: null,
    claimedByUid: null,
    claimedAt: null,
    expiredReason: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const inviteUrl = `https://hamropanchanga.com/invite/${invitationId}`;

  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        from: `HamroPanchanga <${RESEND_FROM_EMAIL}>`,
        to: [recipientLower],
        subject: `${ownerDisplay} shared a family tree with you on HamroPanchanga`,
        text: `${ownerDisplay} has shared the family tree "${treeName}" with you on HamroPanchanga. Accept your invitation here: ${inviteUrl}`,
        html: buildInviteEmailHtml({ fromEmail: ownerDisplay, treeName, inviteUrl }),
      });
      console.log(`[shareTreeWithEmail] Email sent to ${recipientLower}`);
    } catch (err) {
      console.error('[shareTreeWithEmail] Branch B: Email send failed:', err.message);
      // Invitation is still created — don't throw
    }
  }

  return { branch: 'B', invitationId };
});

// ─── WhatsApp: share tree callable ───────────────────────────────────────────
//
// Called from the client when a user shares a tree with a WhatsApp phone number.
// Three-branch logic:
//   A) Phone found in users → user already has an account → grant access + notify
//   B) Not found by phone but hintEmail user exists → grant access + notify (no token)
//   C) Neither found → create invitation token → send invite link via WhatsApp

exports.shareTreeWithWhatsApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { treeId, hintEmail, whatsappPhone, permission } = data;

  if (!treeId || typeof treeId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'treeId is required.');
  }
  if (!whatsappPhone || typeof whatsappPhone !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'whatsappPhone is required.');
  }
  if (!hintEmail || typeof hintEmail !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'hintEmail is required.');
  }
  const allowedPermissions = ['view', 'edit'];
  const resolvedPermission = allowedPermissions.includes(permission) ? permission : 'view';

  const db = admin.firestore();

  // Load the tree to verify caller is the owner (or an admin)
  const treeRef = db.collection('trees').doc(treeId);
  const treeSnap = await treeRef.get();
  if (!treeSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Tree not found.');
  }
  const treeData = treeSnap.data();

  // Admins can share any tree on behalf of the owner
  let callerIsAdmin = context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const adminSnap = await db.collection('adminList').doc(context.auth.uid).get();
    callerIsAdmin = adminSnap.exists;
  }
  if (!callerIsAdmin) {
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = userSnap.exists && userSnap.data().role === 'admin';
  }

  if (!callerIsAdmin && treeData.ownerUid !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the tree owner can share it.');
  }

  const treeName = treeData.title || treeData.name || 'a family tree';
  const fromEmail = context.auth.token.email || hintEmail;

  // Show the tree owner's identity in notification emails (not the admin's)
  let ownerDisplay = treeData.ownerName;
  if (!ownerDisplay && callerIsAdmin && treeData.ownerUid !== context.auth.uid) {
    const ownerSnap = await db.collection('users').doc(treeData.ownerUid).get();
    if (ownerSnap.exists) {
      ownerDisplay = ownerSnap.data().displayName || ownerSnap.data().email || null;
    }
  }
  ownerDisplay = ownerDisplay || fromEmail;

  // ── Branch A: look up user by phone number ─────────────────────────────
  const byPhoneSnap = await db.collection('users')
    .where('phoneNumber', '==', whatsappPhone)
    .limit(1)
    .get();

  if (!byPhoneSnap.empty) {
    // User found by phone — grant access
    const foundUser = byPhoneSnap.docs[0].data();
    const foundEmail = (foundUser.email || hintEmail).toLowerCase();
    const recipientDisplay = foundUser.displayName || foundEmail;

    await treeRef.update(
      new admin.firestore.FieldPath('sharedWith', foundEmail),
      {
        permission: resolvedPermission,
        sharedAt: admin.firestore.FieldValue.serverTimestamp(),
        sharedBy: fromEmail,
      },
      'sharedWithEmails',
      admin.firestore.FieldValue.arrayUnion(foundEmail),
    );

    // Send notification (existing user, no invite needed)
    const langA = whatsappPhone.startsWith('+977') ? 'ne' : 'en';
    try {
      await sendTemplateMessage(whatsappPhone, 'tree_shared_notification', langA, [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: recipientDisplay },
            { type: 'text', text: ownerDisplay },
            { type: 'text', text: treeName },
          ],
        },
      ]);
    } catch (err) {
      console.error('[shareTreeWithWhatsApp] Branch A: WhatsApp send failed:', err.message);
    }

    return { branch: 'A', email: foundEmail };
  }

  // ── Branch B: no phone match, but hintEmail user exists ───────────────
  const hintEmailLower = hintEmail.toLowerCase();
  const byEmailSnap = await db.collection('users')
    .where('email', '==', hintEmailLower)
    .limit(1)
    .get();

  if (!byEmailSnap.empty) {
    const foundUser = byEmailSnap.docs[0].data();
    const recipientDisplay = foundUser.displayName || hintEmailLower;

    await treeRef.update(
      new admin.firestore.FieldPath('sharedWith', hintEmailLower),
      {
        permission: resolvedPermission,
        sharedAt: admin.firestore.FieldValue.serverTimestamp(),
        sharedBy: fromEmail,
      },
      'sharedWithEmails',
      admin.firestore.FieldValue.arrayUnion(hintEmailLower),
    );

    // Notify on the WhatsApp number they provided (may not match stored phone)
    const langB = whatsappPhone.startsWith('+977') ? 'ne' : 'en';
    try {
      await sendTemplateMessage(whatsappPhone, 'tree_shared_notification', langB, [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: recipientDisplay },
            { type: 'text', text: ownerDisplay },
            { type: 'text', text: treeName },
          ],
        },
      ]);
    } catch (err) {
      console.error('[shareTreeWithWhatsApp] Branch B: WhatsApp send failed:', err.message);
    }

    return { branch: 'B', email: hintEmailLower };
  }

  // ── Branch C: unknown recipient → create invitation token ─────────────
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const invitationRef = db.collection('invitations').doc();
  const invitationId = invitationRef.id;

  await invitationRef.set({
    treeId,
    treeTitle: treeName,
    fromUid: context.auth.uid,
    fromEmail,
    hintEmail: hintEmailLower,
    whatsappPhone,
    permission: resolvedPermission,
    status: 'pending',
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    claimedByEmail: null,
    claimedByUid: null,
    claimedAt: null,
    expiredReason: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const inviteUrl = `https://hamropanchanga.com/invite/${invitationId}`;

  const langC = whatsappPhone.startsWith('+977') ? 'ne' : 'en';
  try {
    await sendTemplateMessage(whatsappPhone, 'tree_shared_invitation', langC, [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: ownerDisplay },
          { type: 'text', text: inviteUrl },
        ],
      },
    ]);
  } catch (err) {
    console.error('[shareTreeWithWhatsApp] Branch C: WhatsApp send failed:', err.message);
    // Invitation is still created — user can resend manually
  }

  return { branch: 'C', invitationId };
});

// ─── Claim invitation callable ─────────────────────────────────────────────
//
// Called when an authenticated user visits /invite/:invitationId and clicks "Join".
// Validates the invitation, grants tree access to the caller, marks it claimed.

exports.claimInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in to claim an invitation.');
  }

  const { invitationId } = data;
  if (!invitationId || typeof invitationId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
  }

  const db = admin.firestore();
  const invRef = db.collection('invitations').doc(invitationId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Invitation not found.');
  }

  const inv = invSnap.data();

  if (inv.status !== 'pending') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      inv.status === 'claimed' ? 'This invitation has already been claimed.' : 'This invitation has expired.'
    );
  }

  const now = admin.firestore.Timestamp.now();
  if (inv.expiresAt && inv.expiresAt.toMillis() < now.toMillis()) {
    await invRef.update({ status: 'expired', expiredReason: 'expired_by_date' });
    throw new functions.https.HttpsError('deadline-exceeded', 'This invitation has expired.');
  }

  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!callerEmail) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your account email is unavailable. Please sign in again and retry claiming the invitation.',
    );
  }
  const treeRef = db.collection('trees').doc(inv.treeId);

  // Atomically grant tree access and mark claimed
  const batch = db.batch();

  batch.update(
    treeRef,
    new admin.firestore.FieldPath('sharedWith', callerEmail),
    {
      permission: inv.permission,
      sharedAt: now,
      sharedBy: inv.fromEmail,
    },
    'sharedWithEmails',
    admin.firestore.FieldValue.arrayUnion(callerEmail),
  );

  // If a hintEmail was set, remove it from sharedWith (not yet granted, just pending)
  if (inv.hintEmail && inv.hintEmail !== callerEmail) {
    batch.update(
      treeRef,
      new admin.firestore.FieldPath('sharedWith', inv.hintEmail),
      admin.firestore.FieldValue.delete(),
      'sharedWithEmails',
      admin.firestore.FieldValue.arrayRemove(inv.hintEmail),
    );
  }

  batch.update(invRef, {
    status: 'claimed',
    claimedByEmail: callerEmail,
    claimedByUid: context.auth.uid,
    claimedAt: now,
    expiredReason: 'claimed_by_hint_email',
  });

  await batch.commit();

  return { treeId: inv.treeId, treeTitle: inv.treeTitle };
});
// ─── WhatsApp Webhook ─────────────────────────────────────────────────────────
//
// Callback URL: https://us-central1-hamropanchanga.cloudfunctions.net/whatsappWebhook
//
// GET  — Meta verification challenge (one-time during setup)
// POST — Incoming messages / delivery status updates

exports.whatsappWebhook = functions.https.onRequest((req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  // ── Webhook verification (GET) ──────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[whatsappWebhook] Webhook verified successfully.');
      return res.status(200).send(challenge);
    }
    console.warn('[whatsappWebhook] Verification failed — token mismatch.');
    return res.sendStatus(403);
  }

  // ── Incoming events (POST) ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;

    // Validate it's from WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    try {
      for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
          const value = change.value || {};

          // Status updates (delivered, read, failed, etc.)
          for (const status of (value.statuses || [])) {
            console.log('[whatsappWebhook] Status update:', JSON.stringify(status));
            // Future: update Firestore delivery status here
          }

          // Incoming messages (replies from users)
          for (const message of (value.messages || [])) {
            console.log('[whatsappWebhook] Incoming message from', message.from, ':', JSON.stringify(message));
            // Future: handle opt-out keywords like "STOP" here
          }
        }
      }
    } catch (err) {
      console.error('[whatsappWebhook] Error processing payload:', err.message);
    }

    // Always respond 200 quickly so Meta doesn't retry
    return res.sendStatus(200);
  }

  return res.sendStatus(405);
});
