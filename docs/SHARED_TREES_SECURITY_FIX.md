# Shared Trees Security Rules Fix

## Issue
After implementing the shared tree feature with the `sharedWithEmails` array field, users were unable to view shared trees even after running the migration. The error was:
```
Failed to fetch shared trees: FirebaseError: Missing or insufficient permissions
```

## Root Cause
The Firestore security rules were only checking the `sharedWith` map but NOT the `sharedWithEmails` array. This caused a mismatch:
- **Query**: Used `array-contains` on `sharedWithEmails` array
- **Security Rules**: Only checked `sharedWith` map

Even though the data was correct (both fields existed), the rules blocked read access because they didn't validate against the array field that the query was using.

## Solution
Updated all relevant Firestore security rules to check BOTH:
1. `sharedWith` map (legacy support)
2. `sharedWithEmails` array (new field)

### Files Modified
- `firestore.rules` - Updated all tree-related security rules

### Changes Made

#### 1. Updated `isTreeOwner()` function
Added check for `sharedWithEmails` array:
```javascript
function isTreeOwner(treeId) {
  return isAuthenticated() &&
    treeId != null &&
    exists(/databases/$(database)/documents/trees/$(treeId)) &&
    (get(/databases/$(database)/documents/trees/$(treeId)).data.ownerUid == request.auth.uid ||
     (get(/databases/$(database)/documents/trees/$(treeId)).data.sharedWith != null &&
      request.auth.token.email in get(/databases/$(database)/documents/trees/$(treeId)).data.sharedWith) ||
     // NEW: Also check sharedWithEmails array
     (get(/databases/$(database)/documents/trees/$(treeId)).data.sharedWithEmails != null &&
      request.auth.token.email in get(/databases/$(database)/documents/trees/$(treeId)).data.sharedWithEmails));
}
```

#### 2. Updated tree collection read rules
```javascript
allow read: if isAdmin() || 
  isSuperUser() ||
  (isAuthenticated() && (
    (resource != null && resource.data.ownerUid == request.auth.uid) ||
    (resource != null && resource.data.sharedWith != null && 
     request.auth.token.email in resource.data.sharedWith) ||
    // NEW: Also check sharedWithEmails array
    (resource != null && resource.data.sharedWithEmails != null && 
     request.auth.token.email in resource.data.sharedWithEmails)
  )
);
```

#### 3. Updated subcollection rules
Applied the same dual-check pattern to:
- `trees/{treeId}/members/{memberId}` - Read and write rules
- `trees/{treeId}/relationships/{relationshipId}` - Read and write rules
- `trees/{treeId}/marriagePoints/{marriagePointId}` - Read and write rules

## Deployment
```bash
firebase deploy --only firestore:rules
```

## Testing
After deployment:
1. ✅ Shared trees now appear in the tree list
2. ✅ Users can access trees shared with them
3. ✅ No permission errors in the console
4. ✅ New shares work immediately without migration

## Why Migration Alone Didn't Fix It
The migration script correctly added the `sharedWithEmails` array to existing trees, but the security rules were still blocking access because they only validated against the map field. **Both** the data migration AND security rules update were required for the feature to work properly.

## Architecture Notes
The dual-field approach (map + array) provides:
- **Map (`sharedWith`)**: Stores permission levels and metadata per user
- **Array (`sharedWithEmails`)**: Enables efficient `array-contains` queries

Security rules now validate both fields to ensure proper access control regardless of which field the query uses.

## Related Files
- [firestore.rules](../firestore.rules) - Security rules
- [firestoreTreeApi.js](../src/api/firestoreTreeApi.js) - Query implementation
- [BulkUploadService.js](../src/services/BulkUploadService.js) - Share/unshare functions
- [SHARED_TREES_MIGRATION.md](./SHARED_TREES_MIGRATION.md) - Migration guide (if exists)

## Date
Fixed: January 2025
