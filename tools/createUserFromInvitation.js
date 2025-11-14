#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Simple CLI: node tools/createUserFromInvitation.js <email> <uid>
const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error('Usage: node tools/createUserFromInvitation.js <email> <uid>');
  process.exit(1);
}
const [email, uid] = argv;
const emailLower = String(email).toLowerCase();

const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('service-account.json not found at', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

try {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  // ignore if already initialized in some environments
}

const db = admin.firestore();

async function main() {
  console.log('Creating/updating user from invitation: ', email, uid);

  const invitationRef = db.collection('userInvitations').doc(emailLower);
  const invSnap = await invitationRef.get();

  let role = 'superuser';
  let permissions = { manageHomeCards: true, viewOwnCustomers: true, manageOwnCustomers: true };
  let displayName = '';

  if (invSnap.exists) {
    const inv = invSnap.data();
    console.log('Found invitation document:', inv);
    role = inv.role || role;
    permissions = inv.permissions || permissions;
    displayName = inv.displayName || '';
  } else {
    console.log('No invitation found for', emailLower, '- creating user with default superuser permissions.');
  }

  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    email: email,
    emailLower: emailLower,
    displayName: displayName,
    role: role,
    permissions: permissions,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  if (role === 'admin') {
    await db.collection('adminList').doc(uid).set({ email: email, addedAt: new Date().toISOString() }, { merge: true });
    console.log('Added to adminList');
  }

  try {
    await invitationRef.set({ processed: true, processedAt: new Date().toISOString(), processedUid: uid }, { merge: true });
    console.log('Marked invitation processed');
  } catch (e) {
    console.warn('Unable to update invitation processed flag:', e.message || e);
  }

  console.log('User document created/updated for UID:', uid);
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err); process.exit(1); });
