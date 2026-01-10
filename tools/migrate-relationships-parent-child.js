/*
Migrate existing Firestore relationship docs to the current parent/child rules.

What this does (per tree):
1) Convert legacy Option-A docs that were stored as:
   - type: 'child'
   - fromMemberId = parent
   - toMemberId   = child
   - parentId/childId missing
   into:
   - type: 'parent'
   - parentId = fromMemberId
   - childId  = toMemberId

2) Backfill canonical parentId/childId for all relationships where type is 'parent' or 'child'
   and parentId/childId are missing.

This DOES NOT change edge labels/handles in the UI — those are enforced by the app.

Usage:
  # Dry run (default)
  node tools/migrate-relationships-parent-child.js

  # Single tree
  node tools/migrate-relationships-parent-child.js --treeId <TREE_ID>

  # Execute writes
  node tools/migrate-relationships-parent-child.js --execute
  node tools/migrate-relationships-parent-child.js --execute --yes

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
  console.warn('No service account JSON found; attempting Application Default Credentials (ADC).');
  console.warn('If this fails, download a service account JSON and run with:');
  console.warn('  set SERVICE_ACCOUNT=path\\to\\serviceAccountKey.json');
  console.warn('  node tools\\migrate-relationships-parent-child.js --execute');
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

function normalizeParentChild({ fromMemberId, toMemberId, type }) {
  const t = String(type || '').toLowerCase();
  const from = String(fromMemberId || '');
  const to = String(toMemberId || '');
  if (!from || !to) return { parentId: '', childId: '' };
  if (t === 'parent') return { parentId: from, childId: to };
  if (t === 'child') return { parentId: to, childId: from };
  return { parentId: '', childId: '' };
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

async function commitBatches(writes) {
  const BATCH_LIMIT = 400;
  let committed = 0;

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const slice = writes.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const w of slice) {
      batch.update(w.ref, w.data);
    }
    await batch.commit();
    committed += slice.length;
  }

  return committed;
}

async function readRelationships(treeId) {
  const relsSnap = await db.collection('trees').doc(treeId).collection('relationships').get();
  return relsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...(d.data() || {}) }));
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
  let totalRels = 0;
  let totalLegacyConverted = 0;
  let totalBackfilled = 0;

  const allWrites = []; // { ref, data, treeId, relId, kind }

  for (const treeDoc of treesSnap.docs) {
    const treeId = treeDoc.id;
    totalTrees += 1;

    const rels = await readRelationships(treeId);
    totalRels += rels.length;

    let legacyConverted = 0;
    let backfilled = 0;

    for (const r of rels) {
      const type = String(r.type || '').toLowerCase();
      if (type !== 'parent' && type !== 'child') continue;

      const from = String(r.fromMemberId || '');
      const to = String(r.toMemberId || '');
      if (!from || !to) continue;

      const p = String(r.parentId || '').trim();
      const c = String(r.childId || '').trim();

      // Step 1: legacy conversion (child was used as canonical parent->child)
      if (type === 'child' && (!p || !c)) {
        allWrites.push({
          treeId,
          relId: r.id,
          kind: 'legacy-child->parent',
          ref: r.ref,
          data: {
            type: 'parent',
            parentId: from,
            childId: to,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        legacyConverted += 1;
        continue;
      }

      // Step 2: backfill canonical parentId/childId
      if (!p || !c) {
        const norm = normalizeParentChild({ fromMemberId: from, toMemberId: to, type });
        if (!norm.parentId || !norm.childId) continue;
        allWrites.push({
          treeId,
          relId: r.id,
          kind: 'backfill-parentId-childId',
          ref: r.ref,
          data: {
            parentId: norm.parentId,
            childId: norm.childId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        backfilled += 1;
      }
    }

    totalLegacyConverted += legacyConverted;
    totalBackfilled += backfilled;

    if (legacyConverted || backfilled) {
      console.log(`Tree ${treeId}: legacyConverted=${legacyConverted}, backfilled=${backfilled}`);
    }
  }

  console.log('\nSummary');
  console.log('-------');
  console.log(`Trees scanned: ${totalTrees}`);
  console.log(`Relationships scanned: ${totalRels}`);
  console.log(`Legacy converted (child->parent): ${totalLegacyConverted}`);
  console.log(`Backfilled parentId/childId: ${totalBackfilled}`);
  console.log(`Total updates to write: ${allWrites.length}`);

  if (allWrites.length === 0) {
    console.log('\n✅ No migrations needed.');
    process.exit(0);
  }

  if (!execute) {
    console.log('\nDry-run only. To execute writes, run:');
    console.log('  node tools/migrate-relationships-parent-child.js --execute');
    process.exit(0);
  }

  console.log(`\nAbout to update ${allWrites.length} relationship doc(s).`);
  const ok = await confirmOrExit('Type "yes" to confirm: ');
  if (!ok) {
    console.log('❌ Cancelled. No changes made.');
    process.exit(0);
  }

  console.log('\nWriting...');
  const committed = await commitBatches(allWrites);
  console.log(`\n✅ Done. Updated ${committed}/${allWrites.length} relationship doc(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
