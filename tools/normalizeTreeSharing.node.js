/**
 * Node Migration Script: Normalize tree sharing fields
 *
 * Why:
 * - Fix stale `sharedWithEmails` entries that keep unshared trees appearing in queries.
 * - Fix legacy bad writes where emails containing '.' were written via dot-paths,
 *   resulting in nested objects under `sharedWith`.
 *
 * What it does:
 * - Rebuilds canonical `sharedWith` (flat map keyed by lowercase email)
 * - Rebuilds `sharedWithEmails` from canonical `sharedWith`
 *
 * Usage:
 *   node tools/normalizeTreeSharing.node.js --dry-run
 *   node tools/normalizeTreeSharing.node.js
 *   node tools/normalizeTreeSharing.node.js --limit=100
 *
 * Auth:
 * - Preferred: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.
 * - Or place firebase-service-account.json in the project root (see tools/README.md).
 */

/* eslint-disable no-console */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

function looksLikeEmailKey(key) {
  if (!key) return false;
  const s = String(key);
  return s.includes('@') && s.includes('.');
}

function normalizeEmail(raw) {
  return String(raw || '').toLowerCase().trim();
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isShareRecord(value) {
  if (!isPlainObject(value)) return false;
  const permission = value.permission;
  return permission === 'view' || permission === 'edit';
}

function collectShareRecords(node, pathKeys, out) {
  if (isShareRecord(node)) {
    const emailCandidate = pathKeys.join('.');
    if (looksLikeEmailKey(emailCandidate)) {
      out.push([emailCandidate, node]);
    }
    return;
  }

  if (!isPlainObject(node)) return;

  for (const [key, value] of Object.entries(node)) {
    collectShareRecords(value, pathKeys.concat(key), out);
  }
}

function initAdmin() {
  if (admin.apps.length) return;

  const explicitCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicitCredPath && fs.existsSync(explicitCredPath)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return;
  }

  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  throw new Error(
    'No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or add firebase-service-account.json to project root.'
  );
}

async function normalizeTreeSharing({ dryRun, limit }) {
  initAdmin();
  const db = admin.firestore();

  console.log('🔍 Starting tree-sharing normalization (node)...', { dryRun, limit });

  const treesRef = db.collection('trees');
  const snap = await treesRef.get();

  const docs = typeof limit === 'number' ? snap.docs.slice(0, limit) : snap.docs;
  console.log(`📊 Found ${snap.size} trees total; processing ${docs.length}`);

  let treesUpdated = 0;
  let treesAlreadyOk = 0;
  let errors = 0;

  const MAX_BATCH_SIZE = 450;
  let batch = db.batch();
  let batchCount = 0;

  for (const treeDoc of docs) {
    const treeId = treeDoc.id;
    const treeData = treeDoc.data() || {};

    const sharedWithRaw = isPlainObject(treeData.sharedWith) ? treeData.sharedWith : {};
    const shareRecords = [];
    collectShareRecords(sharedWithRaw, [], shareRecords);

    const canonicalSharedWith = {};
    for (const [emailCandidate, record] of shareRecords) {
      const emailLower = normalizeEmail(emailCandidate);
      if (!emailLower) continue;

      const permission = record.permission === 'edit' ? 'edit' : 'view';
      const sharedBy = typeof record.sharedBy === 'string' && record.sharedBy.trim()
        ? record.sharedBy.trim()
        : (treeData.ownerEmail || null);

      const existing = canonicalSharedWith[emailLower];
      if (existing && existing.permission === 'edit') continue;

      canonicalSharedWith[emailLower] = {
        ...record,
        permission,
        ...(sharedBy ? { sharedBy } : {})
      };
    }

    const targetSharedWithEmails = Array.from(new Set(Object.keys(canonicalSharedWith))).sort();

    const currentSharedWithEmails = Array.isArray(treeData.sharedWithEmails)
      ? treeData.sharedWithEmails.map(normalizeEmail).filter(Boolean)
      : [];
    const currentSharedWithEmailsDeduped = Array.from(new Set(currentSharedWithEmails)).sort();

    const rawKeys = Object.keys(sharedWithRaw);
    const rawEmailKeys = rawKeys.filter(looksLikeEmailKey).map((k) => String(k).trim()).sort();
    const canonicalKeys = Object.keys(canonicalSharedWith).sort();
    const sharedWithKeysExact = arraysEqual(rawEmailKeys, canonicalKeys);
    const rawHasNonEmailKeys = rawKeys.some((k) => !looksLikeEmailKey(k));
    const rawHasUnnormalizedEmailKey = rawEmailKeys.some((k) => normalizeEmail(k) !== k);
    const sharedWithNeedsRewrite = !sharedWithKeysExact || rawHasNonEmailKeys || rawHasUnnormalizedEmailKey;

    const emailsAlreadyOk = arraysEqual(currentSharedWithEmailsDeduped, targetSharedWithEmails);

    if (!sharedWithNeedsRewrite && emailsAlreadyOk) {
      treesAlreadyOk++;
      continue;
    }

    console.log('🧹 Tree needs normalization:', {
      treeId,
      name: treeData.title || treeData.name || '(untitled)',
      beforeEmails: currentSharedWithEmailsDeduped,
      afterEmails: targetSharedWithEmails,
      shareRecordsFound: shareRecords.length,
      sharedWithTopLevelKeys: Object.keys(sharedWithRaw)
    });

    if (!dryRun) {
      batch.update(treeDoc.ref, {
        sharedWith: canonicalSharedWith,
        sharedWithEmails: targetSharedWithEmails,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount++;

      if (batchCount >= MAX_BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} tree updates`);
        } catch (e) {
          console.error('❌ Error committing batch:', e);
          errors++;
        } finally {
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    treesUpdated++;
  }

  if (!dryRun && batchCount > 0) {
    try {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchCount} tree updates`);
    } catch (e) {
      console.error('❌ Error committing final batch:', e);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TREE SHARING NORMALIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log('📊 Statistics:');
  console.log(`   Trees scanned:     ${docs.length}`);
  console.log(`   Already OK:        ${treesAlreadyOk}`);
  console.log(`   Needs update:      ${treesUpdated}`);
  console.log(`   Errors:            ${errors}`);
  console.log(`   Mode:              ${dryRun ? 'DRY RUN (no writes)' : 'APPLIED'}`);
  console.log('='.repeat(60));
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['dry-run', 'dryRun'],
    string: ['limit'],
    alias: {
      d: 'dry-run',
      l: 'limit',
    },
    default: {
      'dry-run': false,
    },
  });

  const dryRun = Boolean(args['dry-run'] || args.dryRun);
  const limit = args.limit != null ? Number(args.limit) : undefined;

  if (args.limit != null && Number.isNaN(limit)) {
    throw new Error(`Invalid --limit value: ${args.limit}`);
  }

  await normalizeTreeSharing({ dryRun, limit });
}

main().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
