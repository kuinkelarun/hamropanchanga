/*
Cleanup orphaned marriage points from Firestore.

What it considers an orphan (mirrors the app's loadGraph cleanup):
- marriagePoint.parents missing / not exactly 2
- either parent no longer exists in members
- no spouse relationship exists between the two parents
- parents have no common child (via parent/child relationships)

Usage:
  # Dry-run (default)
  node tools/cleanup-orphan-marriage-points.js

  # Dry-run for a single tree
  node tools/cleanup-orphan-marriage-points.js --treeId <TREE_ID>

  # Execute deletions (prompts unless --yes)
  node tools/cleanup-orphan-marriage-points.js --execute
  node tools/cleanup-orphan-marriage-points.js --execute --yes

Service account:
  - set SERVICE_ACCOUNT env var, or pass --serviceAccount <path>
  - defaults to service-account.json if present, otherwise serviceAccountKey.json
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
const treeIdFilter = argv.treeId || argv.t;
const execute = Boolean(argv.execute);
const yes = Boolean(argv.yes) || Boolean(argv.y);

function resolveServiceAccountPath() {
  const explicit = process.env.SERVICE_ACCOUNT || argv.serviceAccount || argv.serviceAccountPath;
  if (explicit) return explicit;

  const candidates = ['service-account.json', 'serviceAccountKey.json'];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Fall back to standard ADC env var if present
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && fs.existsSync(gac)) return gac;

  return null;
}

const serviceAccountPath = resolveServiceAccountPath();

if (serviceAccountPath) {
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account JSON not found at', serviceAccountPath);
    console.error('Set SERVICE_ACCOUNT env var or pass --serviceAccount path/to/serviceAccount.json');
    process.exit(1);
  }
  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // Try Application Default Credentials (gcloud auth / env-based)
  console.warn('No service account JSON found; attempting Application Default Credentials (ADC).');
  console.warn('If this fails, download a service account JSON and run with:');
  console.warn('  set SERVICE_ACCOUNT=path\\to\\serviceAccountKey.json');
  console.warn('  node tools\\cleanup-orphan-marriage-points.js --execute');
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

function getSpouseKey(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  return aa < bb ? `${aa}|${bb}` : `${bb}|${aa}`;
}

function collectChildrenByParent(rels) {
  // parentId -> Set(childId) based on (type parent|child) and fromMemberId -> toMemberId
  const childrenByParent = new Map();
  for (const r of rels) {
    const type = String(r.type || '');
    if (type !== 'parent' && type !== 'child') continue;
    const from = String(r.fromMemberId || '');
    const to = String(r.toMemberId || '');
    if (!from || !to) continue;
    if (!childrenByParent.has(from)) childrenByParent.set(from, new Set());
    childrenByParent.get(from).add(to);
  }
  return childrenByParent;
}

function hasCommonChild(childrenByParent, p1Id, p2Id) {
  const p1 = childrenByParent.get(String(p1Id)) || new Set();
  const p2 = childrenByParent.get(String(p2Id)) || new Set();
  for (const c of p1) {
    if (p2.has(c)) return true;
  }
  return false;
}

async function readTreeData(treeId) {
  const [membersSnap, relsSnap, mpSnap] = await Promise.all([
    db.collection('trees').doc(treeId).collection('members').get(),
    db.collection('trees').doc(treeId).collection('relationships').get(),
    db.collection('trees').doc(treeId).collection('marriagePoints').get(),
  ]);

  const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const relationships = relsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const marriagePoints = mpSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return { members, relationships, marriagePoints };
}

function detectOrphanMarriagePoints({ members, relationships, marriagePoints }) {
  const memberIds = new Set((members || []).map(m => String(m.id)));

  const spousePairs = new Set();
  for (const r of relationships || []) {
    if (String(r.type || '') !== 'spouse') continue;
    const a = String(r.fromMemberId || '');
    const b = String(r.toMemberId || '');
    if (!a || !b) continue;
    spousePairs.add(getSpouseKey(a, b));
  }

  const childrenByParent = collectChildrenByParent(relationships || []);

  const orphaned = [];

  for (const mp of marriagePoints || []) {
    const parents = Array.isArray(mp.parents) ? mp.parents.map(p => String(p)) : [];

    if (parents.length !== 2) {
      orphaned.push({ id: mp.id, reason: `invalid_parent_count:${parents.length}` });
      continue;
    }

    const [p1Id, p2Id] = parents;

    if (!memberIds.has(p1Id) || !memberIds.has(p2Id)) {
      orphaned.push({ id: mp.id, reason: 'missing_parent_member' });
      continue;
    }

    if (!spousePairs.has(getSpouseKey(p1Id, p2Id))) {
      orphaned.push({ id: mp.id, reason: 'missing_spouse_relationship' });
      continue;
    }

    if (!hasCommonChild(childrenByParent, p1Id, p2Id)) {
      orphaned.push({ id: mp.id, reason: 'no_common_children' });
      continue;
    }
  }

  return orphaned;
}

async function confirmOrExit(prompt) {
  if (yes) return true;

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise(resolve => {
    readline.question(prompt, resolve);
  });

  readline.close();
  return String(answer || '').trim().toLowerCase() === 'yes';
}

async function main() {
  const treesSnap = treeIdFilter
    ? await db.collection('trees').doc(String(treeIdFilter)).get().then(doc => ({ docs: doc.exists ? [doc] : [] }))
    : await db.collection('trees').get();

  if (!treesSnap.docs.length) {
    console.log('No trees found for the given filter.');
    process.exit(0);
  }

  let totalTrees = 0;
  let totalMarriagePoints = 0;
  let totalOrphans = 0;
  const deletions = []; // { treeId, mpId, reason }

  for (const treeDoc of treesSnap.docs) {
    const treeId = treeDoc.id;
    totalTrees += 1;

    const { members, relationships, marriagePoints } = await readTreeData(treeId);
    totalMarriagePoints += (marriagePoints || []).length;

    const orphaned = detectOrphanMarriagePoints({ members, relationships, marriagePoints });
    totalOrphans += orphaned.length;

    if (orphaned.length > 0) {
      console.log(`Tree ${treeId}: ${orphaned.length} orphan marriage point(s)`);
      for (const o of orphaned) {
        deletions.push({ treeId, mpId: o.id, reason: o.reason });
      }
    }
  }

  console.log('\nSummary');
  console.log('-------');
  console.log(`Trees scanned: ${totalTrees}`);
  console.log(`Marriage points scanned: ${totalMarriagePoints}`);
  console.log(`Orphans found: ${totalOrphans}`);

  if (totalOrphans === 0) {
    console.log('\n✅ No orphaned marriage points detected.');
    process.exit(0);
  }

  if (!execute) {
    console.log('\nDry-run only. To delete, run:');
    console.log('  node tools/cleanup-orphan-marriage-points.js --execute');
    process.exit(0);
  }

  console.log(`\nAbout to delete ${deletions.length} marriage point doc(s).`);
  const ok = await confirmOrExit('Type "yes" to confirm deletion: ');
  if (!ok) {
    console.log('❌ Cancelled. No changes made.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  let deleted = 0;
  for (const d of deletions) {
    try {
      await db.collection('trees').doc(d.treeId).collection('marriagePoints').doc(d.mpId).delete();
      deleted += 1;
      console.log(`✓ Deleted trees/${d.treeId}/marriagePoints/${d.mpId} (${d.reason})`);
    } catch (err) {
      console.warn(`⚠ Failed to delete trees/${d.treeId}/marriagePoints/${d.mpId}:`, err && err.message ? err.message : err);
    }
  }

  console.log(`\n✅ Done. Deleted ${deleted}/${deletions.length} orphan marriage point(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
