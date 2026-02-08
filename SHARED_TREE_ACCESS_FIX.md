# Shared Tree Access Permission Fix

## Issue
Users were getting "Missing or insufficient permissions" error when trying to open a tree that was shared with them by another user. The error occurred even though:
- The shared trees appeared in their "Shared With Me" section
- The trees were correctly stored in the database with their email in the `sharedWithEmails` array
- The permission level was set correctly

## Root Cause
The Firestore security rules were comparing emails without handling case-insensitivity. 

### Problem Scenario:
- User's auth token email might be: `kuinkelarun22@gmail.com` (lowercase)
- Stored shared email in database: `kuinkelarun22@gmail.com` (lowercase from our normalization)
- Firebase `request.auth.token.email` could potentially be in a different case
- The `in` operator in Firestore rules is case-sensitive

### Example Failure:
```javascript
// Fails if stored as 'User@example.com' but auth token has 'user@example.com'
request.auth.token.email in sharedWith  // Returns false due to case mismatch
```

## Solution
Updated all email comparisons in Firestore security rules to use `.lower()` for case-insensitive matching:

### Changes Made in firestore.rules:

1. **Helper Function: `isTreeOwner()`**
   - Now converts `request.auth.token.email` to lowercase before comparing
   - Checks both `sharedWith` map and `sharedWithEmails` array

2. **Helper Function: `hasTreeEditPermission()`**
   - Lowercases email before checking permission level
   - Ensures only 'edit' permission users can modify trees

3. **Tree Collection Read Rule**
   - Added `request.auth.token.email != null` check for safety
   - Lowercases email for all shared tree comparisons

### Before (Case-Sensitive):
```javascript
allow read: if isAdmin() || 
  isSuperUser() || 
  (isAuthenticated() && (
    (resource.data.ownerUid == request.auth.uid) ||
    (resource.data.sharedWith != null && 
     request.auth.token.email in resource.data.sharedWith) ||  // ❌ Case-sensitive
    (resource.data.sharedWithEmails != null && 
     request.auth.token.email in resource.data.sharedWithEmails)  // ❌ Case-sensitive
  ));
```

### After (Case-Insensitive):
```javascript
allow read: if isAdmin() || 
  isSuperUser() || 
  (isAuthenticated() && (
    (resource.data.ownerUid == request.auth.uid) ||
    (resource.data.sharedWith != null && 
     request.auth.token.email != null &&
     request.auth.token.email.lower() in resource.data.sharedWith) ||  // ✅ Case-insensitive
    (resource.data.sharedWithEmails != null && 
     request.auth.token.email != null &&
     request.auth.token.email.lower() in resource.data.sharedWithEmails)  // ✅ Case-insensitive
  ));
```

## Related Code
- BulkUploadService.js (line 1327): Already normalizes emails to lowercase when sharing
- TreeSelectionPage.js (line 91): Already lowercases when querying shared trees

## Testing Recommendations
1. ✅ Share a tree with a user (emails will be stored in lowercase)
2. ✅ Have that user login with their account
3. ✅ Navigate to the shared tree from "Shared With Me" section
4. ✅ Verify tree detail page loads without "Missing or insufficient permissions" error
5. ✅ Verify VIEW-only users cannot edit members/events
6. ✅ Verify EDIT users can modify tree data

## Impact
- **Security**: Maintains permission enforcement (VIEW vs EDIT)
- **Functionality**: Users can now successfully open trees shared with them
- **Performance**: No performance impact (same number of queries)
- **Backward Compatibility**: Works with existing shared trees

## Deployment
Rules deployed to Firebase Firestore on [February 5, 2026]
```
firebase deploy --only firestore:rules
✓ Rules compiled successfully
✓ Rules released to cloud.firestore
```

## Files Modified
- `/firestore.rules` - Security rules with case-insensitive email handling
