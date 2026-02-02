/**
 * Database Migration Script
 * 
 * Fixes database records to ensure:
 * - All trees have nameNormalized field
 * - All members have nameNormalized field
 * - Normalization is consistent with current algorithm
 * 
 * Usage: node tools/migrate-normalize-fields.js [--dry-run] [--limit=N]
 * 
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --limit=N    Limit migration to N records (for testing)
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Import normalization function (simulate the client-side version)
function normalizeForCompare(value) {
  if (value == null) return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u00AD\u00A0\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .replace(/[\u200c\u200d]/g, '')
    .toLowerCase()
    .replace(/[^0-9a-z\u0900-\u097f]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Migrate tree normalization fields
 */
async function migrateTreeFields(dryRun = false, limit = null) {
  console.log('\n📊 Migrating tree normalization fields...');
  if (dryRun) console.log('   🔍 DRY RUN MODE - No changes will be made\n');
  
  let query = db.collection('trees');
  if (limit) {
    query = query.limit(limit);
  }
  
  const treesSnapshot = await query.get();
  const batch = db.batch();
  let updateCount = 0;
  let errorCount = 0;
  
  console.log(`   Processing ${treesSnapshot.size} trees...`);
  
  treesSnapshot.forEach(doc => {
    const data = doc.data();
    const updates = {};
    
    // Check if nameNormalized exists and is correct
    const rawName = data.name || data.title || '';
    const currentNormalized = data.nameNormalized;
    const correctNormalized = normalizeForCompare(rawName);
    
    if (!currentNormalized || currentNormalized !== correctNormalized) {
      updates.nameNormalized = correctNormalized;
      
      if (!dryRun) {
        console.log(`   ✏️  ${doc.id}:`);
        console.log(`       Name: "${rawName}"`);
        console.log(`       Old normalized: "${currentNormalized}"`);
        console.log(`       New normalized: "${correctNormalized}"`);
      }
    }
    
    // Check primaryMemberNameNormalized if it exists
    if (data.primaryMemberName) {
      const currentPrimaryNorm = data.primaryMemberNameNormalized;
      const correctPrimaryNorm = normalizeForCompare(data.primaryMemberName);
      
      if (!currentPrimaryNorm || currentPrimaryNorm !== correctPrimaryNorm) {
        updates.primaryMemberNameNormalized = correctPrimaryNorm;
      }
    }
    
    // Check locationNormalized if it exists
    if (data.location) {
      const currentLocNorm = data.locationNormalized;
      const correctLocNorm = normalizeForCompare(data.location);
      
      if (!currentLocNorm || currentLocNorm !== correctLocNorm) {
        updates.locationNormalized = correctLocNorm;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      updateCount++;
      if (!dryRun) {
        try {
          batch.update(doc.ref, updates);
        } catch (error) {
          console.error(`   ❌ Error updating ${doc.id}:`, error.message);
          errorCount++;
        }
      }
    }
  });
  
  if (dryRun) {
    console.log(`\n   📋 Would update ${updateCount} trees`);
  } else {
    if (updateCount > 0) {
      console.log(`\n   💾 Committing ${updateCount} updates...`);
      try {
        await batch.commit();
        console.log(`   ✅ Successfully updated ${updateCount} trees`);
      } catch (error) {
        console.error(`   ❌ Batch commit failed:`, error.message);
        errorCount++;
      }
    } else {
      console.log(`   ✅ All trees already have correct normalized fields`);
    }
  }
  
  return { updated: updateCount, errors: errorCount };
}

/**
 * Migrate member normalization fields
 */
async function migrateMemberFields(dryRun = false, limit = null) {
  console.log('\n📊 Migrating member normalization fields...');
  if (dryRun) console.log('   🔍 DRY RUN MODE - No changes will be made\n');
  
  // Get all trees first
  const treesSnapshot = await db.collection('trees').get();
  let totalUpdated = 0;
  let totalErrors = 0;
  
  console.log(`   Processing members from ${treesSnapshot.size} trees...`);
  
  for (const treeDoc of treesSnapshot.docs) {
    const membersQuery = limit 
      ? db.collection('trees').doc(treeDoc.id).collection('members').limit(limit)
      : db.collection('trees').doc(treeDoc.id).collection('members');
      
    const membersSnapshot = await membersQuery.get();
    
    if (membersSnapshot.size === 0) continue;
    
    const batch = db.batch();
    let updateCount = 0;
    
    membersSnapshot.forEach(memberDoc => {
      const data = memberDoc.data();
      const updates = {};
      
      // Check if nameNormalized exists and is correct
      const rawName = data.name || '';
      const currentNormalized = data.nameNormalized;
      const correctNormalized = normalizeForCompare(rawName);
      
      if (!currentNormalized || currentNormalized !== correctNormalized) {
        updates.nameNormalized = correctNormalized;
        updateCount++;
      }
      
      if (Object.keys(updates).length > 0 && !dryRun) {
        try {
          batch.update(memberDoc.ref, updates);
        } catch (error) {
          console.error(`   ❌ Error updating member ${memberDoc.id}:`, error.message);
          totalErrors++;
        }
      }
    });
    
    if (updateCount > 0) {
      totalUpdated += updateCount;
      
      if (!dryRun) {
        try {
          await batch.commit();
          console.log(`   ✅ Updated ${updateCount} members in tree ${treeDoc.id}`);
        } catch (error) {
          console.error(`   ❌ Batch commit failed for tree ${treeDoc.id}:`, error.message);
          totalErrors++;
        }
      }
    }
  }
  
  if (dryRun) {
    console.log(`\n   📋 Would update ${totalUpdated} members`);
  } else {
    if (totalUpdated > 0) {
      console.log(`   ✅ Successfully updated ${totalUpdated} members`);
    } else {
      console.log(`   ✅ All members already have correct normalized fields`);
    }
  }
  
  return { updated: totalUpdated, errors: totalErrors };
}

/**
 * Main migration function
 */
async function runMigration() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 DATABASE NORMALIZATION MIGRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (dryRun) {
    console.log('🔍 RUNNING IN DRY-RUN MODE');
    console.log('   No changes will be made to the database');
  }
  
  if (limit) {
    console.log(`⚠️  Limited to ${limit} records per collection`);
  }
  
  try {
    // Migrate trees
    const treeResults = await migrateTreeFields(dryRun, limit);
    
    // Migrate members
    const memberResults = await migrateMemberFields(dryRun, limit);
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Trees updated:    ${treeResults.updated}`);
    console.log(`Members updated:  ${memberResults.updated}`);
    console.log(`Total errors:     ${treeResults.errors + memberResults.errors}`);
    
    if (dryRun) {
      console.log('\n💡 Run without --dry-run to apply these changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  migrateTreeFields,
  migrateMemberFields
};
