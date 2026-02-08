# Permission Enforcement Testing Guide

## Overview
This document outlines the test procedures to verify that permission levels are properly enforced in Firestore security rules. The fix ensures that users with VIEW-only permission cannot modify tree members, relationships, events, or marriage points.

## Key Changes Made

### Firestore Rules Updates
1. **isTreeOwner()** - Simplified to only check if user is in sharedWith (any permission level)
   - Removed sharedWithEmails fallback that bypassed permission checks
   - Used for READ access only

2. **hasTreeEditPermission()** - New function to validate EDIT permission
   - Only returns true if user owns tree OR has explicit 'edit' permission
   - Used for all WRITE operations

3. **Members Subcollection** - Updated write rules
   - Now uses `hasTreeEditPermission(treeId)` instead of loose email checks
   - VIEW-only users cannot add/edit/delete members

4. **Relationships Subcollection** - Updated write rules
   - Now uses `hasTreeEditPermission(treeId)`
   - VIEW-only users cannot add/edit/delete relationships

5. **MarriagePoints Subcollection** - Updated write rules
   - Now uses `hasTreeEditPermission(treeId)`
   - VIEW-only users cannot add/edit/delete marriage points

6. **CalendarEvents** - Updated write rules
   - Tree-linked events now require edit permission to modify
   - Added: `(resource.data.treeId != null && hasTreeEditPermission(resource.data.treeId))`

## Test Scenarios

### Scenario 1: Share Tree with VIEW Permission
**Objective**: Verify that a user with VIEW permission cannot modify tree data

**Prerequisites**:
- User A owns Tree1
- User B has another account with a different email
- Tree1 exists in Firebase

**Steps**:
1. Login as User A
2. Open Tree1
3. Click "Share Tree" button
4. Enter User B's email
5. Select permission: **VIEW ONLY** (or equivalent)
6. Click "Share" 
7. Verify tree appears in User B's "Shared With Me" section

**Expected Results After Fix**:
- ✅ User B can READ tree structure and members
- ❌ User B CANNOT add new members (error: "Missing or insufficient permissions")
- ❌ User B CANNOT edit existing members (error: "Missing or insufficient permissions")
- ❌ User B CANNOT add relationships (error: "Missing or insufficient permissions")
- ❌ User B CANNOT edit relationships (error: "Missing or insufficient permissions")
- ❌ User B CANNOT add marriage points (error: "Missing or insufficient permissions")

### Scenario 2: Share Tree with EDIT Permission
**Objective**: Verify that a user with EDIT permission CAN modify tree data

**Prerequisites**:
- Same as Scenario 1, but with EDIT permission granted

**Steps**:
1. Login as User A
2. Open Tree1
3. Share with User B using EDIT permission
4. Login as User B
5. Open Tree1 from "Shared With Me"
6. Try to add a new member

**Expected Results After Fix**:
- ✅ User B CAN add new members
- ✅ User B CAN edit existing members
- ✅ User B CAN add relationships
- ✅ User B CAN edit relationships
- ✅ User B CAN add marriage points
- ✅ User B CAN modify tree calendar events

### Scenario 3: Change Permission from VIEW to EDIT
**Objective**: Verify that permission changes take effect immediately

**Prerequisites**:
- User A owns Tree1
- User B has VIEW permission on Tree1
- User B is currently unable to edit

**Steps**:
1. Login as User A
2. Open Tree1
3. Click "Share Tree" button
4. Find User B in shared list
5. Change permission from VIEW to EDIT
6. Click "Save" or equivalent
7. Login as User B (if logged out)
8. Open Tree1 and try to add a member

**Expected Results After Fix**:
- ✅ User B CAN now add members (permission change takes effect immediately)

### Scenario 4: Calendar Events Linked to Trees
**Objective**: Verify calendar event write permissions are enforced

**Prerequisites**:
- User A owns Tree1 with a linked calendar event
- User B has VIEW permission on Tree1

**Steps**:
1. Login as User B
2. Navigate to calendar showing Tree1's event
3. Try to edit the event

**Expected Results After Fix**:
- ❌ User B CANNOT edit event (error for treeId-linked events)
- With EDIT permission:
  - ✅ User B CAN edit event

## Manual Testing Checklist

- [ ] Test Scenario 1 - VIEW permission blocks all edits
- [ ] Test Scenario 2 - EDIT permission allows all edits
- [ ] Test Scenario 3 - Permission change takes effect
- [ ] Test Scenario 4 - Calendar event permissions enforced
- [ ] Verify error messages are clear (e.g., "Missing or insufficient permissions")
- [ ] Test with multiple trees
- [ ] Test bulk operations (if applicable)
- [ ] Verify admin users can still edit any tree
- [ ] Verify superusers can still edit any tree

## Browser Console Debugging

When testing, watch the browser console (F12) for Firestore permission errors:

**Expected error for denied write**:
```
FirebaseError: Missing or insufficient permissions.
```

**Expected behavior**:
- Error should appear when VIEW-only user tries to modify
- No error when EDIT user or owner tries to modify
- No error for read operations with VIEW permission

## Deployment Verification

Rules were deployed on [DATE/TIME]:
```
firebase deploy --only firestore:rules
✓ Rules compiled successfully
✓ Rules released to cloud.firestore
```

## Related Code Files

- `/firestore.rules` - Security rules (lines 43-63 for helper functions, 170-178 for members)
- `/src/components/TreeShareModal.js` - UI for sharing (stores permission value)
- `/src/services/BulkUploadService.js` - Bulk operations using sharedWith data
- `/src/pages/TreeDetailPage.js` - Tree member management UI

## Rollback Plan

If tests fail, rules can be quickly reverted by:
```bash
# Check git history for previous version
git log firestore.rules

# Revert to previous version
git checkout [previous-commit] firestore.rules

# Deploy reverted version
firebase deploy --only firestore:rules
```

## Notes

- This fix addresses the critical security issue where sharedWithEmails array was being used as a fallback, bypassing permission level checks
- The permission level is stored in the sharedWith object (e.g., `sharedWith[email].permission == 'edit'`)
- sharedWithEmails is now used only for backward compatibility during reads, not writes
- All write operations require explicit edit permission validation
