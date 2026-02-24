#!/usr/bin/env node
/**
 * Generate a new Nepali Calendar API key and store it (hashed) in Firestore.
 *
 * Usage:
 *   node tools/generate-api-key.js --owner "John Doe" --email "john@example.com"
 *   node tools/generate-api-key.js --owner "John Doe" --email "john@example.com" --limit 5000
 *   node tools/generate-api-key.js --revoke <keyId>
 *   node tools/generate-api-key.js --list
 *
 * Prerequisites:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   npm install firebase-admin  (inside the tools directory, or use the functions one)
 */

const admin = require('../functions/node_modules/firebase-admin');
const crypto = require('crypto');
const path = require('path');

// ── Init Firebase Admin ───────────────────────────────────────────────────────
// Uses GOOGLE_APPLICATION_CREDENTIALS env var, or falls back to functions/serviceAccountKey.json
const serviceAccountPath = path.resolve(__dirname, '..', 'functions', 'serviceAccountKey.json');
let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = admin.credential.applicationDefault();
} else {
  try {
    const sa = require(serviceAccountPath);
    credential = admin.credential.cert(sa);
  } catch {
    console.error(
      'No credentials found.\n' +
      'Either set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in functions/.'
    );
    process.exit(1);
  }
}

// Detect project ID from service account or env
let projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;
if (!projectId) {
  try {
    const sa = require(serviceAccountPath);
    projectId = sa.project_id;
  } catch {}
}

admin.initializeApp({ credential, projectId });
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRawKey() {
  return 'npcal_' + crypto.randomBytes(16).toString('hex'); // npcal_ + 32 hex chars
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function createKey({ owner, email, limit }) {
  if (!owner || !email) {
    console.error('--owner and --email are required.');
    process.exit(1);
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const rateLimit = parseInt(limit, 10) || 1000;
  const todayStr = new Date().toISOString().slice(0, 10);

  const docRef = await db.collection('apiKeys').add({
    keyHash,
    owner,
    email: email.toLowerCase(),
    plan: rateLimit > 1000 ? 'pro' : 'free',
    active: true,
    rateLimit,
    requestsToday: 0,
    rateLimitDate: todayStr,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsed: null
  });

  console.log('\n✅ API key created successfully');
  console.log('─────────────────────────────────────────');
  console.log(`  Raw key  : ${rawKey}`);
  console.log(`  Key ID   : ${docRef.id}`);
  console.log(`  Owner    : ${owner} <${email}>`);
  console.log(`  Plan     : ${rateLimit > 1000 ? 'pro' : 'free'} (${rateLimit} req/day)`);
  console.log('─────────────────────────────────────────');
  console.log('⚠️  Copy the raw key now — it cannot be recovered from the database.\n');
}

async function revokeKey(keyId) {
  if (!keyId) { console.error('--revoke requires a key ID.'); process.exit(1); }
  await db.collection('apiKeys').doc(keyId).update({ active: false });
  console.log(`\n✅ Key ${keyId} has been revoked.\n`);
}

async function listKeys() {
  const snap = await db.collection('apiKeys').get();
  if (snap.empty) { console.log('\nNo API keys found.\n'); return; }
  console.log(`\n${'ID'.padEnd(25)} ${'Owner'.padEnd(20)} ${'Email'.padEnd(30)} ${'Plan'.padEnd(8)} ${'Active'.padEnd(8)} ${'Today'.padEnd(8)} ${'Limit'}`);
  console.log('─'.repeat(110));
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log(
      `${doc.id.padEnd(25)} ${(d.owner || '').padEnd(20)} ${(d.email || '').padEnd(30)} ` +
      `${(d.plan || 'free').padEnd(8)} ${String(d.active).padEnd(8)} ${String(d.requestsToday || 0).padEnd(8)} ${d.rateLimit || 1000}`
    );
  });
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listKeys();
  } else if (args.revoke) {
    await revokeKey(args.revoke);
  } else if (args.owner || args.email) {
    await createKey(args);
  } else {
    console.log(`
Usage:
  node tools/generate-api-key.js --owner "Name" --email "email@example.com" [--limit 1000]
  node tools/generate-api-key.js --list
  node tools/generate-api-key.js --revoke <keyId>
    `);
  }

  process.exit(0);
})();
