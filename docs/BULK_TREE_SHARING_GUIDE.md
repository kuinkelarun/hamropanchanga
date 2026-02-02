# Bulk Tree Sharing Guide

## Overview
The Bulk Tree Sharing feature allows users to share multiple family trees at once with other users. The feature includes role-based access control where administrators can share any tree in the system, while regular users can only share trees they own.

## Features

### ✅ Multi-Select Tree Sharing
- Select multiple trees using checkboxes
- Search/filter trees by name, location, or primary member
- Select/deselect all filtered trees at once
- View tree metadata (member count, location, primary member)

### ✅ Permission Levels
- **View Only** (`👁️`): Recipients can view tree details but cannot make changes
- **Can Edit** (`✏️`): Recipients can view and modify tree members, events, and relationships

### ✅ Role-Based Access
- **Admin Users**: Can share ANY tree in the system with anyone
- **Regular Users**: Can only share trees they own
- **Super Users**: Can share their own trees and trees they create via bulk upload

### ✅ User Experience
- Real-time search/filter functionality
- Batch operation with success/error reporting
- Email validation
- Prevents self-sharing
- Shows selection count and progress

## Architecture

### Components

#### 1. BulkTreeShareModal Component
**Location**: `src/components/BulkTreeShareModal.js`

**Props**:
```javascript
{
  isOpen: boolean,           // Controls modal visibility
  onClose: () => void,       // Callback when modal closes
  onComplete: () => void,    // Callback after successful sharing
  userEmail: string,         // Current user's email
  userId: string,            // Current user's ID
  isAdmin: boolean          // Whether user is admin
}
```

**State**:
- `trees`: Array of available trees
- `selectedTrees`: Array of selected tree IDs
- `recipientEmail`: Email address of recipient
- `permission`: Permission level (VIEW or EDIT)
- `filter`: Search/filter text
- `selectAll`: Whether all filtered trees are selected

**Key Methods**:
- `loadTrees()`: Fetches trees based on user role
- `handleTreeSelect(treeId)`: Toggles tree selection
- `handleSelectAll()`: Selects/deselects all filtered trees
- `getFilteredTrees()`: Filters trees by search term
- `handleShare()`: Performs bulk sharing operation

#### 2. Backend Service
**Location**: `src/services/BulkUploadService.js`

**Function**: `shareBulkTreesWithUser(treeIds, recipientEmail, permission, ownerEmail)`

**Parameters**:
- `treeIds`: Array of tree IDs to share
- `recipientEmail`: Recipient's email (lowercase)
- `permission`: Permission level (VIEW or EDIT)
- `ownerEmail`: Email of user performing the share

**Returns**:
```javascript
{
  success: number,          // Count of successfully shared trees
  failed: string[],         // Array of failed tree IDs
  errors: string[]          // Array of error messages
}
```

#### 3. Firestore API
**Location**: `src/components/TreeBuilder/utils/firestoreTreeApi.js`

**Function**: `Trees.list(ownerUid, options)`

**Parameters**:
- `ownerUid`: User ID (null for admin to get all trees)
- `options`:
  - `includeShared`: Include trees shared with user
  - `userEmail`: User's email for shared tree lookup
  - `includeDeleted`: Include soft-deleted trees

**Returns**: Array of tree objects

### Data Model

#### Tree Document (`trees/{treeId}`)
```javascript
{
  id: string,
  title: string,                    // Tree title
  name: string,                     // Legacy field (backwards compatibility)
  ownerUid: string,                 // Owner user ID
  owner: string,                    // Legacy field (backwards compatibility)
  location: string,                 // Tree location
  primaryMemberName: string,        // Primary member's name
  memberCount: number,              // Number of members
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deleted: boolean,                 // Soft delete flag
  deletedAt: Timestamp,
  
  // Sharing data
  sharedWith: {
    [email]: {
      permission: 'view' | 'edit',
      sharedBy: string,             // Email of sharer
      sharedAt: Timestamp
    }
  }
}
```

### Security Rules

#### Firestore Rules (`firestore.rules`)

**Tree Access**:
```javascript
// Read: Admin, Super User, Owner, or Shared User
allow read: if isAdmin() || 
  isSuperUser() || 
  (isAuthenticated() && resource.data.ownerUid == request.auth.uid);

// Create: Admin, Super User, or Owner
allow create: if isAdmin() ||
  isSuperUser() ||
  (isAuthenticated() && request.resource.data.ownerUid == request.auth.uid);

// Update: Admin (can share any tree), Super User, or Owner
allow update: if isAdmin() || 
  isSuperUser() ||
  (isAuthenticated() && resource.data.ownerUid == request.auth.uid);

// Delete: Admin, Super User, or Owner
allow delete: if isAdmin() ||
  isSuperUser() ||
  (isAuthenticated() && resource.data.ownerUid == request.auth.uid);
```

## Usage Examples

### Example 1: Regular User Sharing Own Trees
```javascript
import BulkTreeShareModal from './components/BulkTreeShareModal';

function MyTreesPage() {
  const [showShareModal, setShowShareModal] = useState(false);
  const currentUser = getCurrentUser(); // Your auth logic

  return (
    <>
      <button onClick={() => setShowShareModal(true)}>
        Share Trees
      </button>
      
      <BulkTreeShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onComplete={() => {
          console.log('Sharing complete!');
          setShowShareModal(false);
        }}
        userEmail={currentUser.email}
        userId={currentUser.uid}
        isAdmin={false}
      />
    </>
  );
}
```

### Example 2: Admin Sharing Any Trees
```javascript
function AdminTreesPage() {
  const [showShareModal, setShowShareModal] = useState(false);
  const currentUser = getCurrentUser(); // Your auth logic

  return (
    <>
      <button onClick={() => setShowShareModal(true)}>
        Share Trees (Admin)
      </button>
      
      <BulkTreeShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onComplete={() => {
          alert('Trees shared successfully!');
          refreshTreeList(); // Refresh your tree list
        }}
        userEmail={currentUser.email}
        userId={currentUser.uid}
        isAdmin={true} // Admin can see and share ALL trees
      />
    </>
  );
}
```

### Example 3: Direct API Usage
```javascript
import { shareBulkTreesWithUser } from '../services/BulkUploadService';

async function shareTrees() {
  const treeIds = ['tree1', 'tree2', 'tree3'];
  const recipientEmail = 'recipient@example.com';
  const permission = 'view'; // or 'edit'
  const ownerEmail = 'owner@example.com';

  const results = await shareBulkTreesWithUser(
    treeIds,
    recipientEmail,
    permission,
    ownerEmail
  );

  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed.length}`);
  if (results.errors.length > 0) {
    console.error('Errors:', results.errors);
  }
}
```

## Workflow

### User Flow
1. User clicks "Share Trees" button
2. Modal opens with list of available trees
3. User searches/filters trees (optional)
4. User selects trees using checkboxes
5. User enters recipient email address
6. User selects permission level (View/Edit)
7. User clicks "Share X Tree(s)" button
8. System validates input and performs sharing
9. Success message shows number of shared trees
10. Modal closes or stays open for more sharing

### System Flow
1. **Load Trees**:
   - Admin: Fetch ALL trees via `Trees.list(null, {includeDeleted: false})`
   - Regular User: Fetch owned trees via `Trees.list(userId, {includeDeleted: false})`

2. **Selection**:
   - User selects trees individually or via "Select All"
   - Filter updates selection pool dynamically

3. **Validation**:
   - Check at least one tree selected
   - Validate email format
   - Prevent self-sharing
   - Check recipient email not empty

4. **Sharing**:
   - Call `shareBulkTreesWithUser()` with selected tree IDs
   - Function loops through each tree
   - Updates `sharedWith` field for each tree
   - Returns success/failure counts

5. **Feedback**:
   - Display success message with count
   - Show errors if any trees failed
   - Call `onComplete()` callback
   - Reset form for next operation

## Troubleshooting

### Trees Not Loading
**Symptom**: Modal shows "Loading trees..." forever

**Possible Causes**:
- Firestore connection issues
- User not authenticated
- Missing userId or isAdmin prop

**Solution**:
- Check browser console for errors
- Verify user is logged in
- Ensure props are passed correctly

### Cannot Share Trees
**Symptom**: "Missing or insufficient permissions" error

**Possible Causes**:
- Firestore rules not deployed
- User trying to share trees they don't own
- Recipient email matches owner email

**Solution**:
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- Verify user owns the trees (regular users)
- Check recipient email is different from owner

### Shared Trees Not Appearing
**Symptom**: Recipient doesn't see shared trees

**Possible Causes**:
- Email mismatch (case sensitivity)
- Trees API not fetching shared trees
- Deleted trees included

**Solution**:
- Ensure emails are lowercase in both places
- Use `Trees.list(userId, {includeShared: true, userEmail: email})`
- Filter out deleted trees

### Select All Not Working
**Symptom**: Select All button doesn't select filtered trees

**Possible Causes**:
- Filter state not synchronized
- Checkbox state issue

**Solution**:
- Check filter state updates correctly
- Verify `getFilteredTrees()` returns correct trees
- Ensure selectedTrees state updates properly

## Best Practices

### 1. Email Normalization
Always lowercase emails for consistent matching:
```javascript
const email = recipientEmail.toLowerCase();
```

### 2. Error Handling
Handle partial failures gracefully:
```javascript
if (results.success > 0 && results.failed.length > 0) {
  // Some succeeded, some failed
  showWarning(`Shared ${results.success} trees, ${results.failed.length} failed`);
}
```

### 3. Loading States
Show loading indicators for better UX:
```javascript
{isLoading && <div className="tsm-loading">Sharing trees...</div>}
```

### 4. Permission Descriptions
Use clear, user-friendly permission descriptions:
- **View Only**: "Recipient can view tree details but cannot make changes"
- **Can Edit**: "Recipient can view and modify tree members, events, and relationships"

### 5. Batch Operations
Limit batch size for performance:
```javascript
if (selectedTrees.length > 50) {
  alert('Please select no more than 50 trees at once');
  return;
}
```

## Security Considerations

### 1. Admin Privileges
- Admins can share ANY tree in the system
- Use responsibly - don't share sensitive family trees without permission
- Consider adding audit logging for admin shares

### 2. Email Validation
- Always validate email format before sharing
- Prevent typos that could share with wrong person
- Consider email confirmation for high-value trees

### 3. Permission Levels
- Default to "View Only" for safety
- "Can Edit" should be used carefully
- Owners can always revoke access via TreeShareModal

### 4. Firestore Rules
- Rules enforce ownership and admin privileges
- Cannot bypass rules from client code
- All sharing operations validated server-side

## Testing Checklist

- [ ] Regular user can share own trees
- [ ] Regular user CANNOT share other users' trees
- [ ] Admin can share any tree in the system
- [ ] Search/filter works correctly
- [ ] Select All selects only filtered trees
- [ ] Email validation prevents invalid emails
- [ ] Self-sharing is prevented
- [ ] View permission works correctly
- [ ] Edit permission works correctly
- [ ] Shared trees appear for recipient
- [ ] Partial failures handled gracefully
- [ ] Modal resets state on close
- [ ] Loading states display correctly
- [ ] Error messages are clear and helpful
- [ ] Mobile responsive design works

## Related Documentation

- [Tree Sharing Utils](../src/utils/TreeSharingUtils.js)
- [Bulk Upload Service](../src/services/BulkUploadService.js)
- [Firestore Tree API](../src/components/TreeBuilder/utils/firestoreTreeApi.js)
- [Tree Share Modal (Single)](../src/components/TreeShareModal.js)
- [Firestore Security Rules](../firestore.rules)

## Future Enhancements

### Potential Features
1. **Sharing Groups**: Share with multiple emails at once
2. **Share Templates**: Save common sharing configurations
3. **Time-Limited Shares**: Set expiration dates for shares
4. **Share Notifications**: Email recipients when trees are shared
5. **Activity Log**: Track who shared what and when
6. **Bulk Permission Updates**: Change permissions for multiple shares at once
7. **Share Links**: Generate shareable links for public viewing
8. **Advanced Filters**: Filter by date, member count, location, etc.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Firestore rules deployment
3. Check browser console for errors
4. Verify user authentication status
5. Contact development team with error details
