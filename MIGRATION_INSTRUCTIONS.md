# URGENT: Fix Shared Trees Permission Error

## Problem
You're seeing this error in the console:
```
Failed to fetch shared trees: FirebaseError: Missing or insufficient permissions.
```

## Root Cause
Existing trees that were shared **before the fix** don't have the `sharedWithEmails` array field. The new query looks for this array, but it doesn't exist yet on old shared trees.

## Solution: Run Migration Script

### Step 1: Refresh the App
Since we just updated `index.js` to expose the `db` object globally, **refresh your browser** (F5) to load the new code.

### Step 2: Open Browser Console
Press **F12** to open Developer Tools, then click on the **Console** tab.

### Step 3: Copy & Paste Migration Script

Copy the entire content from:  
`tools/browserMigrateSharedTrees.js`

Paste it into the browser console and press Enter.

You should see:
```
✅ Migration script loaded successfully!
📝 To migrate shared trees, run: migrateSharedTreesInBrowser()
```

### Step 4: Run Migration
In the console, type:
```javascript
migrateSharedTreesInBrowser()
```

Press Enter.

### Step 5: Watch the Output
You'll see something like:
```
🔧 Starting migration of shared trees...
📊 Found 50 total trees
🔄 Tree abc123 (Smith Family): Adding sharedWithEmails array
  📧 Emails: user1@example.com, user2@example.com
  ✅ Added array successfully

==================================================
📈 MIGRATION SUMMARY
==================================================
Total trees: 50
Trees with shares: 3
Trees migrated: 3
Trees already migrated: 0
Errors: 0

✅ Migration complete! Please refresh the page to see shared trees.
```

### Step 6: Refresh the Page
After migration completes successfully, **refresh the page** (F5).

The shared trees should now appear without errors!

---

## Quick Copy-Paste for Console

If you want to do it all in one go, here's a combined script:

```javascript
// This will be available after you refresh the page with the updated index.js

// Wait a moment for the page to load, then paste this:
(async () => {
  console.log('Checking for db...');
  if (!window.db) {
    console.error('❌ Database not found. Please refresh the page first!');
    return;
  }
  
  // Import what we need
  const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
  const db = window.db;
  
  console.log('✅ Starting migration...');
  
  const treesRef = collection(db, 'trees');
  const treesSnapshot = await getDocs(treesRef);
  
  let migrated = 0;
  
  for (const treeDoc of treesSnapshot.docs) {
    const treeData = treeDoc.data();
    const treeId = treeDoc.id;
    
    if (treeData.sharedWith && typeof treeData.sharedWith === 'object' && Object.keys(treeData.sharedWith).length > 0) {
      const sharedEmails = Object.keys(treeData.sharedWith).map(email => email.toLowerCase());
      
      if (!treeData.sharedWithEmails || treeData.sharedWithEmails.length === 0) {
        console.log(`Migrating: ${treeData.title || treeId}`);
        const treeRef = doc(db, 'trees', treeId);
        await updateDoc(treeRef, { sharedWithEmails: sharedEmails });
        migrated++;
      }
    }
  }
  
  console.log(`✅ Migration complete! Migrated ${migrated} trees.`);
  console.log('🔄 Please refresh the page now.');
})();
```

---

## Verification

After migration and refresh, check:

1. ✅ No more "Missing or insufficient permissions" errors in console
2. ✅ Shared trees appear in the tree list
3. ✅ Share buttons work correctly
4. ✅ Share modal shows existing shares

---

## What the Migration Does

For each tree that has a `sharedWith` map:
```javascript
// BEFORE
{
  id: "tree123",
  sharedWith: {
    "user1@example.com": { permission: "view", ... },
    "user2@example.com": { permission: "edit", ... }
  }
}

// AFTER (with sharedWithEmails array added)
{
  id: "tree123",
  sharedWith: {
    "user1@example.com": { permission: "view", ... },
    "user2@example.com": { permission: "edit", ... }
  },
  sharedWithEmails: [  // <-- NEW
    "user1@example.com",
    "user2@example.com"
  ]
}
```

The array enables efficient querying while the map stores detailed permission info.

---

## Troubleshooting

### "Database not found" error
- Make sure you **refreshed the page** after the index.js update
- Check that you're logged in
- Try opening the Console tab after the page fully loads

### "Permission denied" during migration
- Make sure you're logged in as **admin** or as the **tree owner**
- You can only migrate trees you have access to

### Still seeing errors after migration
- Double-check that the migration actually ran (check the summary output)
- Verify in Firestore Console that trees now have `sharedWithEmails` array
- Clear browser cache and reload

### Need to verify in Firestore?
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Open `trees` collection
4. Check any shared tree
5. Verify it has both `sharedWith` (map) and `sharedWithEmails` (array)

---

## Future Shares

**Good news:** All NEW shares created after the code fix will automatically include the `sharedWithEmails` array. This migration is a one-time operation for existing data.

---

*Last Updated: February 1, 2026*
