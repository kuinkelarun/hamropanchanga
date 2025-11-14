const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

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
