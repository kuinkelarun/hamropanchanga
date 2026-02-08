/**
 * Admin Cleanup Script: Permanently purge soft-deleted trees
 *
 * WARNING: This is destructive and cannot be undone.
 *
 * What it deletes for each tree where `deleted === true`:
 * - /trees/{treeId} (the tree document)
 * - /trees/{treeId}/members/*
 * - /trees/{treeId}/relationships/*
 * - /trees/{treeId}/marriagePoints/*
 * - /calendarEvents/* where treeId == {treeId}
 *
 * Run in browser console (logged in as admin/superuser):
 * 1) Refresh app
 * 2) Paste this entire file
 * 3) Dry run:  purgeDeletedTrees({ dryRun: true })
 * 4) Apply:    purgeDeletedTrees({ dryRun: false, confirm: 'DELETE' })
 */

async function purgeDeletedTrees(options = {}) {
  const {
    dryRun = true,
    confirm = '',
    maxTrees = Infinity,
    includeCalendarEvents = true,
    batchSize = 450,
  } = options;

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

  if (!dryRun && confirm !== 'DELETE') {
    console.error("Refusing to run destructive purge without confirm: 'DELETE'");
    return;
  }

  const {
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    doc,
  } = helpers;

  const toChunks = (arr, n) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
    return chunks;
  };

  const deleteRefsInBatches = async (docRefs, label) => {
    let deleted = 0;
    for (const chunk of toChunks(docRefs, batchSize)) {
      if (!chunk.length) continue;
      if (!dryRun) {
        const batch = writeBatch(db);
        chunk.forEach((r) => batch.delete(r));
        await batch.commit();
      }
      deleted += chunk.length;
    }
    if (label) console.log(`   - ${label}: ${deleted}${dryRun ? ' (dry-run)' : ''}`);
    return deleted;
  };

  console.log('🧨 Starting PURGE of soft-deleted trees...', {
    dryRun,
    maxTrees,
    includeCalendarEvents,
    batchSize,
  });

  const deletedTreesSnap = await getDocs(
    query(collection(db, 'trees'), where('deleted', '==', true))
  );

  const trees = deletedTreesSnap.docs.slice(0, Number.isFinite(maxTrees) ? maxTrees : deletedTreesSnap.docs.length);

  console.log(`📊 Found ${deletedTreesSnap.size} soft-deleted trees total`);
  console.log(`📊 Will process ${trees.length} trees (maxTrees=${maxTrees})`);

  let treesProcessed = 0;
  let treesPurged = 0;
  let totalMembersDeleted = 0;
  let totalRelationshipsDeleted = 0;
  let totalMarriagePointsDeleted = 0;
  let totalEventsDeleted = 0;
  let errors = 0;

  for (const treeDoc of trees) {
    const treeId = treeDoc.id;
    const treeData = treeDoc.data() || {};

    treesProcessed++;
    console.log(`\n🗑️  Purging tree ${treesProcessed}/${trees.length}:`, {
      treeId,
      name: treeData.title || treeData.name || '(untitled)',
      ownerUid: treeData.ownerUid || null,
    });

    try {
      // Collect all docs to delete under this tree
      const membersSnap = await getDocs(collection(db, 'trees', treeId, 'members'));
      const relSnap = await getDocs(collection(db, 'trees', treeId, 'relationships'));
      const mpSnap = await getDocs(collection(db, 'trees', treeId, 'marriagePoints'));

      const memberRefs = membersSnap.docs.map((d) => d.ref);
      const relRefs = relSnap.docs.map((d) => d.ref);
      const mpRefs = mpSnap.docs.map((d) => d.ref);

      let eventRefs = [];
      if (includeCalendarEvents) {
        const eventsSnap = await getDocs(query(collection(db, 'calendarEvents'), where('treeId', '==', treeId)));
        eventRefs = eventsSnap.docs.map((d) => d.ref);
      }

      // Delete subcollection docs
      totalMembersDeleted += await deleteRefsInBatches(memberRefs, 'members');
      totalRelationshipsDeleted += await deleteRefsInBatches(relRefs, 'relationships');
      totalMarriagePointsDeleted += await deleteRefsInBatches(mpRefs, 'marriagePoints');
      totalEventsDeleted += await deleteRefsInBatches(eventRefs, 'calendarEvents');

      // Finally delete the tree document itself
      if (!dryRun) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'trees', treeId));
        await batch.commit();
      }

      treesPurged++;
      console.log(`✅ Purged tree doc: ${treeId}${dryRun ? ' (dry-run)' : ''}`);
    } catch (e) {
      errors++;
      console.error('❌ Failed to purge tree:', treeId, e);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ PURGE COMPLETE');
  console.log('='.repeat(60));
  console.log('📊 Statistics:');
  console.log(`   Trees matched (deleted=true): ${deletedTreesSnap.size}`);
  console.log(`   Trees processed:             ${treesProcessed}`);
  console.log(`   Trees purged:                ${treesPurged}`);
  console.log(`   Members deleted:             ${totalMembersDeleted}`);
  console.log(`   Relationships deleted:       ${totalRelationshipsDeleted}`);
  console.log(`   Marriage points deleted:     ${totalMarriagePointsDeleted}`);
  console.log(`   Calendar events deleted:     ${totalEventsDeleted}`);
  console.log(`   Errors:                      ${errors}`);
  console.log(`   Mode:                        ${dryRun ? 'DRY RUN (no deletes)' : 'APPLIED'}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log("\nNext: run purgeDeletedTrees({ dryRun: false, confirm: 'DELETE' }) to apply deletes.");
  }
}

if (typeof window !== 'undefined' && window.db) {
  console.log('✅ Database detected. Ready to purge soft-deleted trees.');
  console.log('Run: purgeDeletedTrees({ dryRun: true })');
} else {
  console.log('⚠️  Database not available. Make sure you are logged into the app.');
}
