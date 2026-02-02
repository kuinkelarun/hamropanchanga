# Tree Sharing - Quick Testing Guide

## 🚀 Quick Start

### 1. Verify Code is Running
- App should be running on `http://localhost:3000`
- Latest code changes should be deployed

### 2. Test User Setup
Create/use these test accounts:
- **Admin User:** admin@example.com (or your admin account)
- **User A:** user1@example.com
- **User B:** user2@example.com

## ✅ Test Scenarios

### Test 1: Admin Shares with Regular User
**Steps:**
1. Login as admin
2. Go to `/trees` page
3. Select a tree (checkbox)
4. Click "Share Selected Trees" button
5. Enter User A email
6. Select "View" permission
7. Click "Share Trees"
8. Logout

**Expected:**
- ✅ Success message appears
- ✅ No errors in console

**Verify:**
1. Login as User A
2. Go to `/trees` page

**Expected:**
- ✅ Shared tree appears in the list
- ✅ Tree name shows correctly
- ✅ Can click to open tree

**Test Access:**
1. Open the shared tree
2. Try to edit a member

**Expected:**
- ✅ Tree loads successfully
- ❌ Cannot edit (view-only permission)

---

### Test 2: Regular User Shares with Another Regular User
**Steps:**
1. Login as User A
2. Create a new tree (if needed)
3. Go to `/trees` page
4. Select your tree
5. Click "Share Selected Trees"
6. Enter User B email
7. Select "Edit" permission
8. Click "Share Trees"
9. Logout

**Expected:**
- ✅ Success message
- ✅ No console errors

**Verify:**
1. Login as User B
2. Go to `/trees` page

**Expected:**
- ✅ Shared tree appears in list
- ✅ Can open tree
- ✅ Can edit members (has edit permission)

---

### Test 3: Single Tree Share from Detail Page
**Steps:**
1. Login as Admin or User A
2. Open any tree (click on it)
3. Look for "Share Tree" button next to "About Family"
4. Click "Share Tree"
5. Enter User B email
6. Select "View" permission
7. Click "Share Tree"

**Expected:**
- ✅ Modal opens correctly
- ✅ Success message after sharing
- ✅ Modal closes

**Verify:**
1. Login as User B
2. Go to `/trees` page

**Expected:**
- ✅ Tree appears in list

---

### Test 4: Remove Share Access
**Steps:**
1. Login as tree owner (Admin or User A)
2. Go to `/trees` page
3. Select the shared tree
4. Click "Share Selected Trees"
5. Enter the same user email you shared with
6. Click "Remove Access" button
7. Confirm the action

**Expected:**
- ✅ Success message: "Access removed"
- ✅ No errors

**Verify:**
1. Login as the user who had access (User B)
2. Go to `/trees` page

**Expected:**
- ❌ Tree no longer appears in list
- ✅ Cannot access tree directly (permission denied)

---

### Test 5: Bulk Share Multiple Trees
**Steps:**
1. Login as Admin
2. Go to `/trees` page
3. Select multiple trees (check 2-3 checkboxes)
4. Click "Share Selected Trees"
5. Enter User A email
6. Select "View" permission
7. Click "Share Trees"

**Expected:**
- ✅ Success message for each tree
- ✅ "Successfully shared X trees"

**Verify:**
1. Login as User A
2. Go to `/trees` page

**Expected:**
- ✅ All shared trees appear in list
- ✅ Each tree can be opened
- ✅ None can be edited (view permission)

---

### Test 6: Edit Permission Verification
**Steps:**
1. Login as Admin
2. Share a tree with User A with "Edit" permission
3. Logout

**Verify:**
1. Login as User A
2. Open the shared tree
3. Click on a member to edit
4. Change a field (e.g., name)
5. Click Save

**Expected:**
- ✅ Can edit member details
- ✅ Changes save successfully
- ✅ No permission errors

---

## 🔍 Data Verification

### Check Firestore Console
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to `trees` collection
4. Select a shared tree

**Verify Structure:**
```javascript
{
  id: "tree123",
  ownerUid: "...",
  familyName: "...",
  sharedWith: {
    "user1@example.com": {
      permission: "view",
      sharedAt: Timestamp,
      sharedBy: "admin@example.com"
    }
  },
  sharedWithEmails: [
    "user1@example.com"  // <-- Should be present!
  ]
}
```

**Check Points:**
- ✅ `sharedWith` map exists
- ✅ `sharedWithEmails` array exists
- ✅ Emails in array are lowercase
- ✅ Same emails in both map and array

---

## 🐛 Troubleshooting

### Issue: Shared tree not appearing

**Check 1: Data Format**
- Open Firestore console
- Check tree document
- Verify `sharedWithEmails` array exists
- Verify recipient email is in the array (lowercase)

**Fix:** Run migration script:
```javascript
// In browser console (logged in as admin)
// Copy content from tools/browserMigrateSharedTrees.js
await migrateSharedTreesInBrowser()
```

**Check 2: Query Error**
- Open browser console
- Look for errors when loading `/trees` page
- Should NOT see "Missing or insufficient permissions"

**Check 3: Case Sensitivity**
- Recipient email must be lowercase in `sharedWithEmails` array
- If email has uppercase, re-share the tree (will auto-fix)

### Issue: "Missing or insufficient permissions" error

**Possible Causes:**
1. Old data format (no `sharedWithEmails` array) → Run migration
2. Email case mismatch → Re-share to fix
3. Security rules not deployed → Check Firebase console

**Quick Fix:**
Re-share the tree - this will update both fields correctly.

### Issue: Can edit when should only view

**Check:**
- Open Firestore console
- Check `sharedWith.{email}.permission` field
- Should be "view" for view-only access
- Should be "edit" for edit access

**Fix:**
Change permission in modal and re-share.

---

## 📊 Expected Console Output

### Successful Share
```
Sharing 1 tree(s) with user1@example.com
Successfully shared tree: Family Tree 1
Successfully shared 1 tree(s)
```

### Successful Load (Regular User)
```
Fetching trees for user: user123
includeShared: true
userEmail: user1@example.com
Owned trees: 2
Shared trees: 1
Total trees: 3
```

### Successful Load (Admin)
```
Fetching trees for user: adminUser123
Admin user - fetching all trees
Total trees: 15
```

---

## 🎯 Quick Validation Checklist

After all tests, verify:

**Functionality:**
- [ ] Admin can share with any user
- [ ] Regular users can share with each other
- [ ] Shared trees appear in recipient's list
- [ ] View permission prevents editing
- [ ] Edit permission allows editing
- [ ] Remove share removes access
- [ ] Bulk sharing works for multiple trees

**Data Integrity:**
- [ ] All shared trees have `sharedWithEmails` array
- [ ] Emails are normalized (lowercase)
- [ ] Map and array contain same emails
- [ ] Permission levels stored correctly

**User Experience:**
- [ ] Share button appears in tree list
- [ ] Share button appears in tree detail
- [ ] Modals open and close correctly
- [ ] Success/error messages display
- [ ] No console errors

---

## 🔧 Migration Check

If you have existing shared trees, run this check:

1. Login as admin
2. Open browser console (F12)
3. Run:
```javascript
// Check if any trees need migration
const { collection, getDocs } = window.firebase.firestore;
const db = window.firebase.db;
const treesRef = collection(db, 'trees');
const snapshot = await getDocs(treesRef);

let needsMigration = [];
snapshot.forEach(doc => {
  const data = doc.data();
  if (data.sharedWith && Object.keys(data.sharedWith).length > 0) {
    if (!data.sharedWithEmails || data.sharedWithEmails.length === 0) {
      needsMigration.push({
        id: doc.id,
        familyName: data.familyName,
        sharedCount: Object.keys(data.sharedWith).length
      });
    }
  }
});

console.log('Trees needing migration:', needsMigration.length);
console.table(needsMigration);
```

**If any trees need migration:**
- Use the migration script from `tools/browserMigrateSharedTrees.js`
- Or re-share each tree (will auto-fix)

---

## 📝 Test Report Template

```
## Tree Sharing Test Report

**Date:** [Date]
**Tester:** [Name]
**Build:** [Commit/Version]

### Test Results

| Test # | Scenario | Status | Notes |
|--------|----------|--------|-------|
| 1 | Admin → User | ✅ / ❌ | |
| 2 | User → User | ✅ / ❌ | |
| 3 | Detail Page Share | ✅ / ❌ | |
| 4 | Remove Share | ✅ / ❌ | |
| 5 | Bulk Share | ✅ / ❌ | |
| 6 | Edit Permission | ✅ / ❌ | |

### Data Verification
- [ ] sharedWithEmails array present
- [ ] Emails normalized (lowercase)
- [ ] Map and array consistent

### Issues Found
[List any issues]

### Console Errors
[Copy any errors from console]

### Recommendations
[Any suggestions]
```

---

## Need Help?

**Check These Files:**
- Code: `src/components/TreeBuilder/utils/firestoreTreeApi.js` (line 92)
- Service: `src/services/BulkUploadService.js` (lines 1327-1415)
- Docs: `docs/TREE_SHARING_FIX.md`
- Migration: `tools/browserMigrateSharedTrees.js`

**Common Commands:**
```bash
# Restart app
npm start

# Check for errors
# Open browser console (F12)

# Run migration
# Copy browserMigrateSharedTrees.js to console
await migrateSharedTreesInBrowser()
```
