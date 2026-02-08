/**
 * Diagnostic: Inspect sharing data for a specific user
 * 
 * Run in browser console to see exactly what's in sharedWith vs sharedWithEmails
 * 
 * Usage:
 *   diagnoseSharing('kuinkelarun22@gmail.com')
 */

async function diagnoseSharing(targetEmail) {
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

  const { collection, getDocs, query, where } = helpers;
  const normalizedEmail = (targetEmail || '').toLowerCase().trim();

  console.log('🔍 Diagnosing sharing for:', normalizedEmail);
  console.log('='.repeat(60));

  try {
    // Find trees where sharedWithEmails contains this email
    const q = query(collection(db, 'trees'), where('sharedWithEmails', 'array-contains', normalizedEmail));
    const snap = await getDocs(q);

    console.log(`📊 Found ${snap.size} trees with '${normalizedEmail}' in sharedWithEmails`);

    if (snap.size === 0) {
      console.log('No trees found. User is not in any sharedWithEmails arrays.');
      return;
    }

    for (const doc of snap.docs) {
      const data = doc.data();
      console.log('\n' + '-'.repeat(60));
      console.log('Tree:', doc.id);
      console.log('Name:', data.title || data.name || '(untitled)');
      console.log('Owner:', data.ownerUid);
      console.log('Deleted:', data.deleted || false);

      // Check sharedWithEmails
      const sharedWithEmails = data.sharedWithEmails || [];
      console.log('\nsharedWithEmails:', sharedWithEmails);

      // Check sharedWith map keys
      const sharedWith = data.sharedWith || {};
      const sharedWithKeys = Object.keys(sharedWith);
      console.log('sharedWith keys:', sharedWithKeys);

      // Check if the exact lowercase email is a key
      const hasExactKey = normalizedEmail in sharedWith;
      console.log(`\n✓ Has exact key '${normalizedEmail}':`, hasExactKey);

      if (!hasExactKey && sharedWithKeys.length > 0) {
        console.log('⚠️  PROBLEM: sharedWithEmails contains the email, but sharedWith does NOT have the exact lowercase key!');
        console.log('   This will cause permission denied errors.');
        
        // Find keys that match when lowercased
        const matchingKeys = sharedWithKeys.filter(k => k.toLowerCase() === normalizedEmail);
        if (matchingKeys.length > 0) {
          console.log('   Found mixed-case keys:', matchingKeys);
          console.log('   FIX: Run normalizeTreeSharing({ dryRun: false }) to correct this.');
        }
      } else if (hasExactKey) {
        console.log('✅ Sharing data is correct for this tree.');
        console.log('   Permission:', sharedWith[normalizedEmail].permission);
        console.log('   Shared by:', sharedWith[normalizedEmail].sharedBy || '(not recorded)');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`Total trees: ${snap.size}`);
    const problematic = snap.docs.filter(doc => {
      const data = doc.data();
      const sharedWith = data.sharedWith || {};
      return !(normalizedEmail in sharedWith);
    });
    console.log(`Trees with case mismatch: ${problematic.length}`);
    if (problematic.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   1. Refresh the app');
      console.log('   2. Paste normalizeTreeSharing.js into console');
      console.log('   3. Run: normalizeTreeSharing({ dryRun: false })');
    } else {
      console.log('✅ All trees have correct sharing keys!');
    }
  } catch (err) {
    console.error('❌ Error during diagnosis:', err);
    console.log('\nIf you see permission errors here, you may not be admin/superuser.');
    console.log('Ask the tree owner to run this diagnostic.');
  }
}

if (typeof window !== 'undefined' && window.db) {
  console.log('✅ Diagnostic ready.');
  console.log('Run: diagnoseSharing("user@example.com")');
} else {
  console.log('⚠️  Database not available.');
}
