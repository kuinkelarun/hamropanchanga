# Bulk Upload Troubleshooting Guide

Quick reference for diagnosing and fixing bulk upload permission issues.

## Common Error Messages

### 1. "Missing or insufficient permissions"

**Symptom**: User gets this error when trying to bulk upload trees/members/events

**Possible Causes**:

#### A. Field Name Mismatch
- **Check**: Does the tree document use `ownerUid` or `owner`?
- **Verify**: Open Firebase Console → Firestore → trees collection
- **Fix**: Ensure BulkUploadService.js creates trees with `ownerUid` field
- **Location**: [src/services/BulkUploadService.js](src/services/BulkUploadService.js#L335)

#### B. Security Rules Not Updated
- **Check**: Do Firestore rules allow super users to access trees?
- **Verify**: Look at [firestore.rules](firestore.rules#L161)
- **Should contain**: `allow read, write: if isAdmin() || isSuperUser() || ...`
- **Fix**: Deploy updated rules: `firebase deploy --only firestore:rules`

#### C. User Role Not Set
- **Check**: User document in Firestore
- **Verify**: Firebase Console → Firestore → users → {userId}
- **Should have**: `role: 'superuser'`
- **Fix**: Update user document or run admin tool

#### D. Permission Flag Not Enabled
- **Check**: User document permissions field
- **Verify**: `permissions.bulkUpload: true`
- **Fix**: Enable via User Management UI or update Firestore directly

### 2. "User setup incomplete"

**Symptom**: Error says "User setup incomplete. Please refresh the page and try again."

**Cause**: User document doesn't exist in Firestore

**Fix**:
1. Check Firebase Console → Authentication → verify user exists
2. Check Firestore → users collection → verify user document exists
3. If missing, user needs to log out and log back in (triggers user creation)
4. Or manually create user document with required fields

**Required fields**:
```javascript
{
  email: "user@example.com",
  displayName: "User Name",
  role: "superuser",
  permissions: {
    bulkUpload: true,
    // other permissions...
  },
  active: true,
  createdAt: "2026-02-01T...",
  updatedAt: "2026-02-01T..."
}
```

### 3. "Tree already exists"

**Symptom**: Upload skips trees saying they already exist

**Causes**:
- Tree with exact same name already exists
- Tree with similar name (normalized) already exists
- Example: "राम परिवार" vs "राम  परिवार" (double space)

**Verify**:
```bash
# Check existing trees
firebase firestore:get trees --where 'ownerUid=={userId}'
```

**Fix Options**:
1. Delete/rename existing tree
2. Use different tree name in upload
3. Adjust normalization logic if needed

## Diagnostic Steps

### Step 1: Verify User Role and Permissions

**Firebase Console**:
1. Go to Firestore Database
2. Navigate to `users` collection
3. Find user by ID (from Firebase Authentication)
4. Check fields:
   - `role`: should be `'superuser'` or `'admin'`
   - `permissions.bulkUpload`: should be `true`

**Via Code** (add to BulkUploadModal.js temporarily):
```javascript
useEffect(() => {
  const checkPermissions = async () => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    console.log('User role:', userDoc.data()?.role);
    console.log('Bulk upload permission:', userDoc.data()?.permissions?.bulkUpload);
  };
  if (userId) checkPermissions();
}, [userId]);
```

### Step 2: Verify Security Rules

**Check deployed rules**:
```bash
firebase firestore:rules:get
```

**Test rules locally**:
```bash
firebase emulators:start
# Then run bulk upload against local emulator
```

**Expected rules** for trees:
```javascript
match /trees/{treeId} {
  allow read, write: if isAdmin() || 
    isSuperUser() || 
    (isAuthenticated() && ...)
}
```

### Step 3: Check Field Names

**Verify tree document structure**:
1. Go to Firebase Console → Firestore
2. Open any tree document
3. Confirm field exists: `ownerUid`
4. If only `owner` field exists, trees were created with old code

**Fix existing trees** (if needed):
```javascript
// Run this script to migrate old trees
const treesSnap = await getDocs(collection(db, 'trees'));
const batch = writeBatch(db);

treesSnap.docs.forEach(treeDoc => {
  const data = treeDoc.data();
  if (data.owner && !data.ownerUid) {
    batch.update(treeDoc.ref, { ownerUid: data.owner });
  }
});

await batch.commit();
console.log('Migration complete');
```

### Step 4: Test with Different Users

**Admin user** (should always work):
- Bulk upload any trees/members/events
- If admin fails → security rules issue

**Super user** (should work with permission):
- Must have `role: 'superuser'`
- Must have `permissions.bulkUpload: true`
- If fails → check role and permission

**Regular user** (should not see feature):
- Should not see bulk upload button
- If they do → frontend permission check failing

## Quick Fixes

### Fix 1: Grant Super User Bulk Upload Permission

**Via Firebase Console**:
1. Firestore Database → users collection
2. Find user document
3. Edit document
4. Add/update field: `permissions.bulkUpload = true`

**Via Admin Tool**:
```bash
node tools/grantSuperuserAdminTabs.js <userId>
```

### Fix 2: Deploy Updated Security Rules

```bash
# From project root
firebase deploy --only firestore:rules

# Verify deployment
firebase firestore:rules:get
```

### Fix 3: Update Existing Trees with ownerUid

**For single tree** (Firebase Console):
1. Go to tree document
2. Add field: `ownerUid` = `{userId}`

**For multiple trees** (script):
```bash
node tools/migrate-tree-owner-field.js
```

## Verification Commands

### Check User Permissions
```bash
firebase firestore:get users/{userId}
```

### Check Tree Ownership
```bash
firebase firestore:get trees/{treeId}
```

### List User's Trees
```bash
firebase firestore:query trees --where 'ownerUid=={userId}'
```

### View Security Rules
```bash
firebase firestore:rules:get
```

## Related Documentation

- [SUPER_USER_BULK_UPLOAD_FIX.md](SUPER_USER_BULK_UPLOAD_FIX.md) - Complete fix details
- [BULK_UPLOAD_DIAGNOSIS_AND_FIX.md](BULK_UPLOAD_DIAGNOSIS_AND_FIX.md) - Unicode/normalization issues
- [constants/roles.js](src/constants/roles.js) - Permission definitions
- [firestore.rules](firestore.rules) - Security rules

## Emergency Contacts

If critical production issues occur:
1. Check Firebase Console → Firestore → Logs for detailed errors
2. Review this troubleshooting guide
3. Check recent deployments for changes
4. Consider rollback if needed (see SUPER_USER_BULK_UPLOAD_FIX.md)

---

**Last Updated**: February 1, 2026  
**Version**: 1.0  
**Maintained By**: Development Team
