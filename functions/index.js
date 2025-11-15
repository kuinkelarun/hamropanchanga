const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK (Cloud Functions provide credentials automatically)
admin.initializeApp();

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
