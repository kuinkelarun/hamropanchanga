/**
 * Targeted Repair: fix sharing invariants for ONE recipient email
 *
 * Goal: eliminate "poison" docs that make the recipient's shared-trees query fail.
 *
 * For each tree where sharedWithEmails contains targetEmailLower:
 * - Ensure sharedWith has an exact lowercase key for that email if any share exists
 * - If sharedWith has only mixed-case key, rewrite it to lowercase
 * - If sharedWith has NO record for that email, remove email from sharedWithEmails (stale unshare)
 * - Ensure sharedWithEmails includes the email when a share record exists
 *
 * Run in browser console as admin/owner (needs read+write on trees):
 *   1) Refresh app
 *   2) Paste this whole file
 *   3) Dry run:  repairSharingForEmail('user@example.com', { dryRun: true })
 *   4) Apply:    repairSharingForEmail('user@example.com', { dryRun: false })
 */

function normalizeEmail(raw) {
  return String(raw || '').toLowerCase().trim();
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function repairSharingForEmail(targetEmail, { dryRun = true } = {}) {
  const db = window.db;
  if (!db) {
    console.error('Database not available. Make sure you are logged into the app.');
    return;
  }

  const helpers = window.__firestoreHelpers;
  if (!helpers) {
    console.error('Firestore helpers not available. Refresh the app and try again.');
    return;
  }

  const { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } = helpers;
  const emailLower = normalizeEmail(targetEmail);
  if (!emailLower) {
    console.error('Target email is required');
    return;
  }

  console.log('🧰 Starting targeted sharing repair for:', emailLower, { dryRun });

  const snap = await getDocs(query(collection(db, 'trees'), where('sharedWithEmails', 'array-contains', emailLower)));
  console.log(`📊 Found ${snap.size} trees with '${emailLower}' in sharedWithEmails`);

  let alreadyOk = 0;
  let updated = 0;
  let staleFixed = 0;
  let mixedCaseFixed = 0;
  let errors = 0;

  const MAX_BATCH_SIZE = 450;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const treeDoc of snap.docs) {
    const treeId = treeDoc.id;
    const treeData = treeDoc.data() || {};

    const sharedWithRaw = isPlainObject(treeData.sharedWith) ? treeData.sharedWith : {};
    const sharedWithEmailsRaw = Array.isArray(treeData.sharedWithEmails) ? treeData.sharedWithEmails : [];

    const currentEmails = Array.from(new Set(sharedWithEmailsRaw.map(normalizeEmail).filter(Boolean)));

    const hasExact = Object.prototype.hasOwnProperty.call(sharedWithRaw, emailLower);
    const keys = Object.keys(sharedWithRaw);
    const mixedKeys = keys.filter((k) => normalizeEmail(k) === emailLower && k !== emailLower);

    let nextSharedWith = sharedWithRaw;
    let nextEmails = currentEmails;
    let needsWrite = false;

    // Case 1: mixed-case key exists, rewrite it to exact lowercase
    if (!hasExact && mixedKeys.length > 0) {
      nextSharedWith = { ...sharedWithRaw };
      // Prefer the first mixed key
      const fromKey = mixedKeys[0];
      nextSharedWith[emailLower] = nextSharedWith[fromKey];
      delete nextSharedWith[fromKey];
      needsWrite = true;
      mixedCaseFixed++;
    }

    const hasRecordAfterRewrite = Object.prototype.hasOwnProperty.call(nextSharedWith, emailLower);

    // Case 2: stale sharedWithEmails entry (no share record exists) -> remove email
    if (!hasRecordAfterRewrite) {
      if (nextEmails.includes(emailLower)) {
        nextEmails = nextEmails.filter((e) => e !== emailLower);
        needsWrite = true;
        staleFixed++;
      }
    } else {
      // Case 3: share record exists but sharedWithEmails missing -> add it
      if (!nextEmails.includes(emailLower)) {
        nextEmails = nextEmails.concat([emailLower]);
        needsWrite = true;
      }
    }

    // Keep deterministic order
    nextEmails = Array.from(new Set(nextEmails)).sort();

    // No-op?
    const emailsSame = JSON.stringify(nextEmails) === JSON.stringify(currentEmails.slice().sort());
    const sharedWithSame = nextSharedWith === sharedWithRaw;

    if (!needsWrite || (emailsSame && sharedWithSame)) {
      alreadyOk++;
      continue;
    }

    console.log('🛠️ Repairing tree:', {
      treeId,
      name: treeData.title || treeData.name || '(untitled)',
      beforeEmails: currentEmails,
      afterEmails: nextEmails,
      hadExact: hasExact,
      mixedKeys,
      hadRecord: hasRecordAfterRewrite,
    });

    if (!dryRun) {
      const treeRef = doc(db, 'trees', treeId);
      batch.update(treeRef, {
        sharedWith: nextSharedWith,
        sharedWithEmails: nextEmails,
        updatedAt: serverTimestamp(),
      });
      batchCount++;
    }

    updated++;

    if (!dryRun && batchCount >= MAX_BATCH_SIZE) {
      try {
        await batch.commit();
        console.log(`💾 Committed batch of ${batchCount} updates`);
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
      console.log(`💾 Committed final batch of ${batchCount} updates`);
    } catch (e) {
      console.error('❌ Error committing final batch:', e);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TARGETED REPAIR COMPLETE');
  console.log('='.repeat(60));
  console.log('📊 Statistics:');
  console.log(`   Trees scanned:             ${snap.size}`);
  console.log(`   Already OK:                ${alreadyOk}`);
  console.log(`   Updated:                   ${updated}`);
  console.log(`   Stale entries removed:     ${staleFixed}`);
  console.log(`   Mixed-case keys fixed:     ${mixedCaseFixed}`);
  console.log(`   Errors:                    ${errors}`);
  console.log(`   Mode:                      ${dryRun ? 'DRY RUN' : 'APPLIED'}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log("\nNext: run repairSharingForEmail('" + emailLower + "', { dryRun: false }) to apply.");
  }
}

if (typeof window !== 'undefined' && window.db) {
  console.log('✅ Ready. Run: repairSharingForEmail("user@example.com", { dryRun: true })');
}
