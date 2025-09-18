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
