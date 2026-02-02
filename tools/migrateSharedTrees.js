/**
 * Migration Script: Add sharedWithEmails array to existing shared trees
 * 
 * This script scans all trees with a sharedWith map and adds a corresponding
 * sharedWithEmails array for efficient querying.
 * 
 * Usage: node tools/migrateSharedTrees.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateSharedTrees() {
  console.log('Starting migration of shared trees...');
  
  try {
    // Get all trees
    const treesSnapshot = await db.collection('trees').get();
    
    let totalTrees = treesSnapshot.size;
    let treesWithShares = 0;
    let treesMigrated = 0;
    let treesAlreadyMigrated = 0;
    let errors = [];

    console.log(`Found ${totalTrees} total trees`);

    for (const doc of treesSnapshot.docs) {
      const treeData = doc.data();
      const treeId = doc.id;

      // Check if tree has sharedWith map
      if (treeData.sharedWith && typeof treeData.sharedWith === 'object') {
        treesWithShares++;
        
        const sharedEmails = Object.keys(treeData.sharedWith).map(email => email.toLowerCase());
        
        // Check if sharedWithEmails already exists
        if (treeData.sharedWithEmails && Array.isArray(treeData.sharedWithEmails)) {
          // Verify it matches the sharedWith map
          const existingEmails = treeData.sharedWithEmails.map(e => e.toLowerCase());
          const missingEmails = sharedEmails.filter(e => !existingEmails.includes(e));
          
          if (missingEmails.length > 0) {
            console.log(`Tree ${treeId}: Updating incomplete sharedWithEmails array`);
            console.log(`  Missing emails: ${missingEmails.join(', ')}`);
            
            try {
              await doc.ref.update({
                sharedWithEmails: sharedEmails
              });
              treesMigrated++;
            } catch (error) {
              console.error(`Error updating tree ${treeId}:`, error.message);
              errors.push({ treeId, error: error.message });
            }
          } else {
            treesAlreadyMigrated++;
            console.log(`Tree ${treeId}: Already has correct sharedWithEmails array (${sharedEmails.length} emails)`);
          }
        } else {
          // Add sharedWithEmails array
          console.log(`Tree ${treeId}: Adding sharedWithEmails array`);
          console.log(`  Emails: ${sharedEmails.join(', ')}`);
          
          try {
            await doc.ref.update({
              sharedWithEmails: sharedEmails
            });
            treesMigrated++;
          } catch (error) {
            console.error(`Error updating tree ${treeId}:`, error.message);
            errors.push({ treeId, error: error.message });
          }
        }
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total trees: ${totalTrees}`);
    console.log(`Trees with shares: ${treesWithShares}`);
    console.log(`Trees migrated: ${treesMigrated}`);
    console.log(`Trees already migrated: ${treesAlreadyMigrated}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach(({ treeId, error }) => {
        console.log(`Tree ${treeId}: ${error}`);
      });
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

// Run migration
migrateSharedTrees();
