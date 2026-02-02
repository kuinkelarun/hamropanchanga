/**
 * Browser Console Migration Script for sharedWithEmails
 * 
 * This script can be run from the browser console when logged in as admin.
 * It migrates existing shared trees to include the sharedWithEmails array.
 * 
 * Instructions:
 * 1. Open the app in browser and login as admin
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Run: migrateSharedTreesInBrowser()
 * 
 * Note: This function is automatically available as a global function
 */

window.migrateSharedTreesInBrowser = async function() {
  console.log('🔧 Starting migration of shared trees...');
  
  try {
    // Get Firestore from the global firebase object
    const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
    
    // Get db from window (assuming it's exposed via firebase.js)
    const db = window.db || (window.firebase && window.firebase.db);
    
    if (!db) {
      console.error('❌ Firestore database not found. Make sure you\'re logged in and the app is loaded.');
      console.log('💡 Try: Make sure firebase is initialized');
      return;
    }

    const treesRef = collection(db, 'trees');
    const treesSnapshot = await getDocs(treesRef);
    
    let totalTrees = treesSnapshot.size;
    let treesWithShares = 0;
    let treesMigrated = 0;
    let treesAlreadyMigrated = 0;
    let errors = [];

    console.log(`📊 Found ${totalTrees} total trees`);

    for (const treeDoc of treesSnapshot.docs) {
      const treeData = treeDoc.data();
      const treeId = treeDoc.id;

      // Check if tree has sharedWith map
      if (treeData.sharedWith && typeof treeData.sharedWith === 'object' && Object.keys(treeData.sharedWith).length > 0) {
        treesWithShares++;
        
        const sharedEmails = Object.keys(treeData.sharedWith).map(email => email.toLowerCase());
        
        // Check if sharedWithEmails already exists and is correct
        if (treeData.sharedWithEmails && Array.isArray(treeData.sharedWithEmails)) {
          const existingEmails = treeData.sharedWithEmails.map(e => e.toLowerCase());
          const missingEmails = sharedEmails.filter(e => !existingEmails.includes(e));
          
          if (missingEmails.length > 0) {
            console.log(`🔄 Tree ${treeId}: Updating incomplete array (adding ${missingEmails.length} emails)`);
            
            try {
              const treeRef = doc(db, 'trees', treeId);
              await updateDoc(treeRef, {
                sharedWithEmails: sharedEmails
              });
              treesMigrated++;
              console.log(`  ✅ Updated: ${sharedEmails.join(', ')}`);
            } catch (error) {
              console.error(`  ❌ Error updating tree ${treeId}:`, error.message);
              errors.push({ treeId, error: error.message });
            }
          } else {
            treesAlreadyMigrated++;
          }
        } else {
          // Add sharedWithEmails array
          console.log(`🔄 Tree ${treeId} (${treeData.title || 'Untitled'}): Adding sharedWithEmails array`);
          console.log(`  📧 Emails: ${sharedEmails.join(', ')}`);
          
          try {
            const treeRef = doc(db, 'trees', treeId);
            await updateDoc(treeRef, {
              sharedWithEmails: sharedEmails
            });
            treesMigrated++;
            console.log(`  ✅ Added array successfully`);
          } catch (error) {
            console.error(`  ❌ Error updating tree ${treeId}:`, error.message);
            errors.push({ treeId, error: error.message });
          }
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total trees: ${totalTrees}`);
    console.log(`Trees with shares: ${treesWithShares}`);
    console.log(`Trees migrated: ${treesMigrated}`);
    console.log(`Trees already migrated: ${treesAlreadyMigrated}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n' + '⚠️ ERRORS:');
      errors.forEach(({ treeId, error }) => {
        console.log(`  Tree ${treeId}: ${error}`);
      });
    }
    
    if (treesMigrated > 0) {
      console.log('\n✅ Migration complete! Please refresh the page to see shared trees.');
    } else if (treesWithShares === 0) {
      console.log('\n💡 No trees with shares found. Nothing to migrate.');
    } else {
      console.log('\n✅ All trees already have the sharedWithEmails array. No migration needed.');
    }

    return {
      totalTrees,
      treesWithShares,
      treesMigrated,
      treesAlreadyMigrated,
      errors
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// Auto-run check for easier usage
console.log('✅ Migration script loaded successfully!');
console.log('📝 To migrate shared trees, run: migrateSharedTreesInBrowser()');
console.log('');
console.log('💡 Make sure you are:');
console.log('   1. Logged in as admin');
console.log('   2. On the Family Tree app page');
console.log('   3. Have trees that are shared with other users');

