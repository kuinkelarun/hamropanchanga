/*
Bootstrap script to add an admin entry to Firestore `adminList/{uid}` for a user identified by email.
Usage:
  1. Download a Firebase service account JSON from the Firebase console and save as `serviceAccountKey.json` (or set SERVICE_ACCOUNT env var to the path).
  2. From project root run:
     node tools/bootstrap-admin.js --email alice@example.com

This script will:
 - initialize the Admin SDK with the provided service account
 - find the user by email
 - write a document at `adminList/{uid}` with email and createdAt

WARNING: Keep your service account JSON private and do not commit it to source control.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const email = argv.email || argv.e;
const serviceAccountPath = process.env.SERVICE_ACCOUNT || argv.serviceAccount || 'serviceAccountKey.json';

if (!email) {
  console.error('Usage: node tools/bootstrap-admin.js --email kuinkelarun@gmail.com [--serviceAccount path/to/serviceAccount.json]');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found at', serviceAccountPath);
  console.error('Set SERVICE_ACCOUNT env var or pass --serviceAccount path.');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

(async () => {
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    console.log('Found user:', email, 'uid=', uid);

    const db = admin.firestore();
    const adminDocRef = db.collection('adminList').doc(uid);
    await adminDocRef.set({
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      bootstrappedBy: serviceAccount.client_email || 'local-script'
    }, { merge: true });

    console.log(`Created adminList/${uid}`);
    process.exit(0);
  } catch (err) {
    console.error('Error bootstrapping admin:', err);
    process.exit(2);
  }
})();
