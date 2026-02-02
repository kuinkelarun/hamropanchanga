/**
 * Migration Script: Add nameNormalized field to existing members
 * 
 * This script ensures all existing members in all trees have the nameNormalized field
 * which is used for case-insensitive duplicate detection during bulk uploads.
 * 
 * Run this in browser console:
 * 1. Open your app in browser
 * 2. Open Developer Console (F12)
 * 3. Copy and paste this entire script
 * 4. Run: normalizeExistingMembers()
 */

function normalizeForCompare(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function normalizeExistingMembers() {
  const db = window.db;
  if (!db) {
    console.error('Database not available. Make sure you are logged into the app.');
    return;
  }

  console.log('🔍 Starting normalization check for existing members...');

  try {
    // Get all trees
    const treesSnapshot = await db.collection('trees').get();
    console.log(`📊 Found ${treesSnapshot.size} trees to process`);

    let totalMembers = 0;
    let membersUpdated = 0;
    let membersAlreadyNormalized = 0;
    let errors = 0;

    for (const treeDoc of treesSnapshot.docs) {
      const treeId = treeDoc.id;
      const treeName = treeDoc.data().title || treeId;
      
      console.log(`\n📁 Processing tree: ${treeName} (${treeId})`);

      // Get all members in this tree
      const membersSnapshot = await db
        .collection('trees')
        .doc(treeId)
        .collection('members')
        .get();

      console.log(`   👥 Found ${membersSnapshot.size} members`);
      totalMembers += membersSnapshot.size;

      // Process members in batches of 500 (Firestore limit)
      const batch = db.batch();
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500;

      for (const memberDoc of membersSnapshot.docs) {
        const memberId = memberDoc.id;
        const memberData = memberDoc.data();
        const memberName = memberData.name || '';

        // Check if nameNormalized already exists and is correct
        const expectedNormalized = normalizeForCompare(memberName);
        const currentNormalized = memberData.nameNormalized;

        if (currentNormalized === expectedNormalized) {
          membersAlreadyNormalized++;
          continue; // Already normalized correctly
        }

        // Update member with normalized name
        const memberRef = db
          .collection('trees')
          .doc(treeId)
          .collection('members')
          .doc(memberId);

        batch.update(memberRef, {
          nameNormalized: expectedNormalized,
          updatedAt: new Date()
        });

        batchCount++;
        membersUpdated++;

        console.log(`   ✅ Queued update for: ${memberName} → ${expectedNormalized}`);

        // Commit batch if it reaches the limit
        if (batchCount >= MAX_BATCH_SIZE) {
          try {
            await batch.commit();
            console.log(`   💾 Committed batch of ${batchCount} updates`);
            batchCount = 0;
          } catch (error) {
            console.error(`   ❌ Error committing batch:`, error);
            errors++;
          }
        }
      }

      // Commit remaining updates for this tree
      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`   💾 Committed final batch of ${batchCount} updates`);
        } catch (error) {
          console.error(`   ❌ Error committing final batch:`, error);
          errors++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ NORMALIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Total Members:     ${totalMembers}`);
    console.log(`   Already Normalized: ${membersAlreadyNormalized}`);
    console.log(`   Updated:           ${membersUpdated}`);
    console.log(`   Errors:            ${errors}`);
    console.log('='.repeat(60));

    if (membersUpdated > 0) {
      console.log('\n✨ Members have been normalized!');
      console.log('You can now use bulk upload without "member not found" errors.');
    } else {
      console.log('\n✨ All members were already normalized. No updates needed!');
    }

  } catch (error) {
    console.error('❌ Fatal error during normalization:', error);
  }
}

// Auto-run if window.db is available
if (typeof window !== 'undefined' && window.db) {
  console.log('✅ Database detected. Ready to normalize members.');
  console.log('Run: normalizeExistingMembers()');
} else {
  console.log('⚠️  Database not available. Make sure you are logged into the app.');
}
