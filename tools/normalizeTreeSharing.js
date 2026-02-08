/**
 * Migration Script: Normalize tree sharing fields
 *
 * Fixes cases where a tree was unshared but the other user still sees it
 * (usually because `sharedWithEmails` contains stale or mixed-case entries).
 *
 * What it does:
 * - Rebuilds `sharedWith` and `sharedWithEmails` from actual share records
 * - Handles legacy bad writes where emails containing '.' were written via dot-paths,
 *   resulting in nested objects under `sharedWith`
 * - Clears stale `sharedWithEmails` entries after unshare (when no share record exists)
 *
 * Run this in browser console:
 * 1) Open your app in browser (logged in as admin/owner that can read all trees)
 * 2) Open DevTools console (F12)
 * 3) Copy/paste this whole file
 * 4) Run: normalizeTreeSharing({ dryRun: true })  // preview
 * 5) Then: normalizeTreeSharing({ dryRun: false }) // apply
 */

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
  // Treat records with at least a valid permission as share records (older docs may not have metadata).
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

async function normalizeTreeSharing({ dryRun = true } = {}) {
  const db = window.db;
  if (!db) {
    console.error('Database not available. Make sure you are logged into the app.');
    return;
  }

  const helpers = window.__firestoreHelpers;
  if (!helpers) {
    console.error('Firestore helpers not available. Refresh the app and try again.');
    console.log('Expected window.__firestoreHelpers to be set by src/index.js');
    return;
  }

  console.log('🔍 Starting tree-sharing normalization...', { dryRun });

  try {
    const {
      collection,
      getDocs,
      writeBatch,
      doc,
      serverTimestamp
    } = helpers;

    const treesSnapshot = await getDocs(collection(db, 'trees'));
    console.log(`📊 Found ${treesSnapshot.size} trees to process`);

    let treesUpdated = 0;
    let treesAlreadyOk = 0;
    let errors = 0;
    let deletedCount = 0;
    let activeCount = 0;

    const MAX_BATCH_SIZE = 450;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const treeDoc of treesSnapshot.docs) {
      const treeId = treeDoc.id;
      const treeData = treeDoc.data() || {};

      if (treeData.deleted) {
        deletedCount++;
      } else {
        activeCount++;
      }

      const sharedWithRaw = isPlainObject(treeData.sharedWith) ? treeData.sharedWith : {};
      const shareRecords = [];
      collectShareRecords(sharedWithRaw, [], shareRecords);

      // Canonical flattened map: { [emailLower]: { permission, sharedAt, sharedBy, ... } }
      const canonicalSharedWith = {};
      for (const [emailCandidate, record] of shareRecords) {
        const emailLower = normalizeEmail(emailCandidate);
        if (!emailLower) continue;

        const permission = record.permission === 'edit' ? 'edit' : 'view';
        const sharedBy = typeof record.sharedBy === 'string' && record.sharedBy.trim()
          ? record.sharedBy.trim()
          : (treeData.ownerEmail || null);

        // If duplicates exist, prefer edit over view.
        const existing = canonicalSharedWith[emailLower];
        if (existing && existing.permission === 'edit') continue;

        canonicalSharedWith[emailLower] = {
          ...record,
          permission,
          ...(sharedBy ? { sharedBy } : {})
        };
      }

      const targetEmails = Object.keys(canonicalSharedWith)
        .map(normalizeEmail)
        .filter(Boolean);
      const targetSharedWithEmails = Array.from(new Set(targetEmails)).sort();

      const currentSharedWithEmails = Array.isArray(treeData.sharedWithEmails)
        ? treeData.sharedWithEmails.map(normalizeEmail).filter(Boolean)
        : [];
      const currentSharedWithEmailsDeduped = Array.from(new Set(currentSharedWithEmails)).sort();

      // IMPORTANT: Firestore rules check for the *exact* lowercase email key.
      // If an existing key is mixed-case (e.g. 'User@Example.com'), reads will fail.
      // So we must compare keys exactly (no normalization) and rewrite when needed.
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
        const treeRef = doc(db, 'trees', treeId);
        batch.update(treeRef, {
          sharedWith: canonicalSharedWith,
          sharedWithEmails: targetSharedWithEmails,
          updatedAt: serverTimestamp()
        });
        batchCount++;
      }

      treesUpdated++;

      if (!dryRun && batchCount >= MAX_BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} tree updates`);
        } catch (e) {
          console.error('❌ Error committing batch:', e);
          errors++;
        } finally {
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
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
    console.log(`   Trees processed:   ${treesSnapshot.size}`);
    console.log(`   Active (deleted=false): ${activeCount}`);
    console.log(`   Deleted (deleted=true): ${deletedCount}`);
    console.log(`   Already OK:        ${treesAlreadyOk}`);
    console.log(`   Needs update:      ${treesUpdated}`);
    console.log(`   Errors:            ${errors}`);
    console.log(`   Mode:              ${dryRun ? 'DRY RUN (no writes)' : 'APPLIED'}`);
    console.log('='.repeat(60));

    if (dryRun) {
      console.log('\nNext: run normalizeTreeSharing({ dryRun: false }) to apply changes.');
    }
  } catch (error) {
    console.error('❌ Fatal error during sharing normalization:', error);
  }
}

if (typeof window !== 'undefined' && window.db) {
  console.log('✅ Database detected. Ready to normalize tree sharing.');
  console.log('Run: normalizeTreeSharing({ dryRun: true })');
} else {
  console.log('⚠️  Database not available. Make sure you are logged into the app.');
}
