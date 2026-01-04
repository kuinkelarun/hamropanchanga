const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const serviceAccountPath = process.env.SERVICE_ACCOUNT || argv.serviceAccount || argv.serviceAccountPath || 'serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found at', serviceAccountPath);
  console.error('Set SERVICE_ACCOUNT env var or pass --serviceAccount path/to/serviceAccount.json');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixInvitations() {
  try {
    const snapshot = await db.collection('userInvitations').get();
    console.log(`Found ${snapshot.size} invitation(s)`);
    let updated = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.emailLower && data.email) {
        const emailLower = data.email.toLowerCase();
        db.collection('userInvitations').doc(doc.id).update({ emailLower })
          .then(() => console.log(`Updated ${doc.id} -> emailLower=${emailLower}`))
          .catch(err => console.error(`Failed update ${doc.id}:`, err.message));
        updated++;
      }
    });
    console.log(`Triggered updates for ${updated} invitations (async).`);
  } catch (err) {
    console.error('Error fixing invitations:', err);
  }
}

fixInvitations();
