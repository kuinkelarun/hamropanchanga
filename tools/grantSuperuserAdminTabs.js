#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.length < 1) {
  console.error('Usage: node tools/grantSuperuserAdminTabs.js <uid>');
  process.exit(1);
}
const [uid] = argv;
const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('service-account.json not found at', serviceAccountPath);
  process.exit(1);
}
const serviceAccount = require(serviceAccountPath);
try { admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); } catch(e) {}
const db = admin.firestore();

async function main() {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const current = snap.exists ? snap.data() : {};
  const perms = Object.assign({}, current.permissions || {}, {
    bulkUpload: true,
    manageTithis: true,
    manageEvents: true
  });
  await userRef.set({ permissions: perms, updatedAt: new Date().toISOString(), role: current.role || 'superuser' }, { merge: true });
  console.log('Granted Admin tabs permissions to', uid);
}

main().catch(err => { console.error(err); process.exit(1); });
