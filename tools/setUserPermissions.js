#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Usage: node tools/setUserPermissions.js <uid> <permissions-json>
// Example: node tools/setUserPermissions.js 0QtIa6aNy6WBszwggcU8T0XfFqB2 '{"bulkUpload":true,"manageTithis":true,"manageEvents":true}'
const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error('Usage: node tools/setUserPermissions.js <uid> <permissions-json>');
  process.exit(1);
}
const [uid, permsJson] = argv;
let perms;
try {
  perms = JSON.parse(permsJson);
} catch (e) {
  console.error('Invalid JSON for permissions:', e.message);
  process.exit(1);
}

const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('service-account.json not found at', serviceAccountPath);
  process.exit(1);
}
const serviceAccount = require(serviceAccountPath);
try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {}
const db = admin.firestore();

async function main() {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.log('User doc does not exist - creating with provided permissions');
    await userRef.set({
      permissions: perms,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log('User created/updated');
    return;
  }
  const userData = userSnap.data();
  const newPerms = { ...(userData.permissions || {}), ...perms };
  await userRef.update({ permissions: newPerms, updatedAt: new Date().toISOString() });
  console.log('Permissions updated for', uid, newPerms);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
