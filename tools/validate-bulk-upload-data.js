/**
 * Database Validation Tool
 * 
 * Validates data integrity for bulk upload system:
 * - Finds duplicate tree names (normalized)
 * - Checks normalization consistency
 * - Verifies referential integrity
 * - Identifies orphaned records
 * 
 * Usage: node tools/validate-bulk-upload-data.js
 */

const admin = require('firebase-admin');
const path = require('path');

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
 * Find duplicate tree names by normalized form
 */
async function findDuplicateTreesByNormalizedName() {
  console.log('\n📊 Checking for duplicate tree names...');
  
  const treesSnapshot = await db.collection('trees').get();
  const grouped = new Map();
  
  treesSnapshot.forEach(doc => {
    const data = doc.data();
    const rawName = data.name || data.title || '';
    const normalized = normalizeForCompare(rawName);
    
    if (!grouped.has(normalized)) {
      grouped.set(normalized, []);
    }
    grouped.get(normalized).push({
      id: doc.id,
      name: data.name,
      nameNormalized: data.nameNormalized,
      owner: data.owner,
      deleted: data.deleted || false
    });
  });
  
  // Find groups with more than 1 tree
  const duplicates = [];
  grouped.forEach((trees, normalized) => {
    // Only consider non-deleted trees
    const activeTrees = trees.filter(t => !t.deleted);
    if (activeTrees.length > 1) {
      duplicates.push({ normalized, trees: activeTrees });
    }
  });
  
  if (duplicates.length > 0) {
    console.warn(`   ⚠️  Found ${duplicates.length} duplicate tree name groups:`);
    duplicates.forEach(dup => {
      console.warn(`   \n   - "${dup.normalized}" has ${dup.trees.length} trees:`);
      dup.trees.forEach(t => {
        console.warn(`       * ${t.id}: "${t.name}" (owner: ${t.owner})`);
      });
    });
  } else {
    console.log('   ✅ No duplicate tree names found');
  }
  
  return duplicates;
}

/**
 * Check normalization consistency
 */
async function checkNormalizationConsistency(collectionName, fieldName) {
  console.log(`\n📊 Checking normalization consistency for ${collectionName}.${fieldName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const inconsistent = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const rawValue = data[fieldName];
    const storedNormalized = data[`${fieldName}Normalized`];
    const computedNormalized = normalizeForCompare(rawValue);
    
    if (storedNormalized !== computedNormalized) {
      inconsistent.push({
        id: doc.id,
        rawValue,
        storedNormalized,
        computedNormalized,
        diff: {
          stored: storedNormalized?.length || 0,
          computed: computedNormalized?.length || 0,
          hexStored: Array.from(storedNormalized || '').map(c => 
            c.charCodeAt(0).toString(16).padStart(4, '0')).join(' '),
          hexComputed: Array.from(computedNormalized || '').map(c => 
            c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ')
        }
      });
    }
  });
  
  if (inconsistent.length > 0) {
    console.warn(`   ⚠️  Found ${inconsistent.length} records with normalization mismatches`);
    inconsistent.slice(0, 5).forEach(item => {
      console.warn(`   \n   - ${item.id}:`);
      console.warn(`       Raw: "${item.rawValue}"`);
      console.warn(`       Stored: "${item.storedNormalized}"`);
      console.warn(`       Computed: "${item.computedNormalized}"`);
      console.warn(`       Lengths: ${item.diff.stored} vs ${item.diff.computed}`);
    });
    if (inconsistent.length > 5) {
      console.warn(`   ... and ${inconsistent.length - 5} more`);
    }
  } else {
    console.log('   ✅ All normalizations are consistent');
  }
  
  return inconsistent;
}

/**
 * Verify referential integrity for events
 */
async function verifyReferentialIntegrity() {
  console.log('\n📊 Checking referential integrity...');
  
  const report = {
    orphanedEvents: [],
    orphanedMembers: [],
    missingTreeRefs: []
  };
  
  // Check events reference valid members and trees
  const eventsSnapshot = await db.collection('calendarEvents').limit(1000).get();
  
  console.log(`   Checking ${eventsSnapshot.size} events...`);
  
  for (const eventDoc of eventsSnapshot.docs) {
    const eventData = eventDoc.data();
    const { treeId, memberId } = eventData;
    
    if (!treeId || !memberId) {
      report.missingTreeRefs.push({
        eventId: eventDoc.id,
        title: eventData.title,
        issue: 'Missing treeId or memberId'
      });
      continue;
    }
    
    try {
      // Check if tree exists
      const treeDoc = await db.collection('trees').doc(treeId).get();
      if (!treeDoc.exists) {
        report.orphanedEvents.push({
          eventId: eventDoc.id,
          title: eventData.title,
          issue: 'Tree not found',
          treeId
        });
        continue;
      }
      
      // Check if member exists
      const memberDoc = await db.collection('trees').doc(treeId)
        .collection('members').doc(memberId).get();
      if (!memberDoc.exists) {
        report.orphanedEvents.push({
          eventId: eventDoc.id,
          title: eventData.title,
          issue: 'Member not found',
          treeId,
          memberId
        });
      }
    } catch (error) {
      report.missingTreeRefs.push({
        eventId: eventDoc.id,
        title: eventData.title,
        error: error.message
      });
    }
  }
  
  if (report.orphanedEvents.length > 0) {
    console.warn(`   ⚠️  Found ${report.orphanedEvents.length} orphaned events`);
    report.orphanedEvents.slice(0, 5).forEach(event => {
      console.warn(`       - Event "${event.title}" (${event.eventId})`);
      console.warn(`         Issue: ${event.issue}`);
      if (event.treeId) console.warn(`         Tree: ${event.treeId}`);
      if (event.memberId) console.warn(`         Member: ${event.memberId}`);
    });
    if (report.orphanedEvents.length > 5) {
      console.warn(`   ... and ${report.orphanedEvents.length - 5} more`);
    }
  } else {
    console.log('   ✅ No orphaned events found');
  }
  
  if (report.missingTreeRefs.length > 0) {
    console.warn(`   ⚠️  Found ${report.missingTreeRefs.length} events with missing references`);
  }
  
  return report;
}

/**
 * Check for trees without normalized name field
 */
async function checkMissingNormalizedFields() {
  console.log('\n📊 Checking for missing normalized fields...');
  
  const treesSnapshot = await db.collection('trees').get();
  const missing = [];
  
  treesSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.nameNormalized && data.name) {
      missing.push({
        id: doc.id,
        name: data.name,
        owner: data.owner
      });
    }
  });
  
  if (missing.length > 0) {
    console.warn(`   ⚠️  Found ${missing.length} trees without nameNormalized field`);
    console.warn(`       Run the migration script to fix this.`);
  } else {
    console.log('   ✅ All trees have normalized fields');
  }
  
  return missing;
}

/**
 * Main validation function
 */
async function validateDatabase() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 BULK UPLOAD DATA VALIDATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Check 1: Duplicate tree names
    const duplicates = await findDuplicateTreesByNormalizedName();
    
    // Check 2: Missing normalized fields
    const missingFields = await checkMissingNormalizedFields();
    
    // Check 3: Normalization consistency
    const treeInconsistent = await checkNormalizationConsistency('trees', 'name');
    
    // Check 4: Referential integrity
    const integrity = await verifyReferentialIntegrity();
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VALIDATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Duplicate tree names:        ${duplicates.length}`);
    console.log(`Missing normalized fields:   ${missingFields.length}`);
    console.log(`Normalization inconsistent:  ${treeInconsistent.length}`);
    console.log(`Orphaned events:             ${integrity.orphanedEvents.length}`);
    console.log(`Missing references:          ${integrity.missingTreeRefs.length}`);
    
    const totalIssues = duplicates.length + missingFields.length + 
                       treeInconsistent.length + integrity.orphanedEvents.length +
                       integrity.missingTreeRefs.length;
    
    if (totalIssues === 0) {
      console.log('\n✅ All validation checks passed!');
    } else {
      console.log(`\n⚠️  Found ${totalIssues} issues that need attention`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  validateDatabase()
    .then(() => {
      console.log('Validation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Validation error:', error);
      process.exit(1);
    });
}

module.exports = {
  validateDatabase,
  findDuplicateTreesByNormalizedName,
  checkNormalizationConsistency,
  verifyReferentialIntegrity,
  checkMissingNormalizedFields
};
