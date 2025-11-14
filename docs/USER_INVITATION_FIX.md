# User Invitation System - Fix Documentation

## Problem Identified

When adding users through the User Management page, the system was creating user documents with **temporary UIDs** instead of waiting for the actual Firebase Authentication UID. This caused a critical issue:

1. Admin adds user "john@example.com" → Creates document at `users/user_123456789_abc123`
2. John logs in with Gmail → Firebase Auth assigns UID `c9ryh3OMQ6btnQGK9Fa4ou2A1Bf2`
3. System looks for user document at `users/c9ryh3OMQ6btnQGK9Fa4ou2A1Bf2` → **NOT FOUND**
4. Result: John gets default "user" role instead of assigned "superuser" role

## Solution Implemented

### 1. User Invitation System
Instead of creating user documents with temporary UIDs, the system now:
- Creates an **invitation document** in the `userInvitations` collection (keyed by email)
- Stores the desired role and permissions in the invitation
- Shows invitation as "Pending" in User Management UI
- When the user logs in for the first time, processes the invitation and creates the proper user document with their real Firebase Auth UID

### 2. Files Modified

#### `src/components/UserManagement.js`
- **handleAddUser()**: Now creates invitation documents instead of user documents
- **loadUsers()**: Loads and displays pending invitations
- **Visual indicators**: Added "⏳ Pending Invitation" badge for users who haven't logged in yet

#### `src/App.js`
- **useEffect (onAuthStateChanged)**: Added STEP 1 to check for pending invitations
- When user logs in, checks if their email has a pending invitation
- If yes, creates user document with correct UID and assigned role/permissions
- Marks invitation as processed

#### `firestore.rules`
- Added security rules for `userInvitations` collection
- Only admins can create/read/write invitations
- Users can read their own invitation (by email match)

#### `src/components/UserManagement.css`
- Added `.pending-badge` style with pulsing animation

### 3. How It Works Now

```
BEFORE (Broken):
1. Admin adds john@example.com as Super User
2. System creates: users/temp_uid_12345 (wrong!)
3. John logs in → Gets UID: abc123xyz
4. System looks for: users/abc123xyz (doesn't exist)
5. John gets default "user" role ❌

AFTER (Fixed):
1. Admin adds john@example.com as Super User
2. System creates: userInvitations/john@example.com { role: "superuser", permissions: {...} }
3. UI shows: "⏳ Pending Invitation"
4. John logs in → Gets UID: abc123xyz
5. System finds invitation for john@example.com
6. System creates: users/abc123xyz { role: "superuser", permissions: {...} } ✅
7. Marks invitation as processed
8. John immediately has Super User access!
```

## Cleanup Instructions

### Remove Incorrectly Created User Documents

If you previously added users and they have temp UIDs (like `user_1234567890_abc123`), you need to clean them up:

#### Option 1: Using Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database
4. Open the `users` collection
5. Look for documents with UIDs starting with `user_` followed by numbers
6. Delete these documents (they're invalid)

#### Option 2: Using Node.js Script
Create a file `tools/cleanup-temp-users.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTempUsers() {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    const tempUsers = [];
    usersSnapshot.forEach(doc => {
      // Temp UIDs start with "user_" followed by timestamp
      if (doc.id.startsWith('user_')) {
        tempUsers.push(doc.id);
      }
    });
    
    console.log(`Found ${tempUsers.length} temporary user documents to delete:`);
    tempUsers.forEach(uid => console.log(`  - ${uid}`));
    
    // Delete them
    for (const uid of tempUsers) {
      await db.collection('users').doc(uid).delete();
      console.log(`✓ Deleted: ${uid}`);
    }
    
    console.log(`\n✅ Cleanup complete! Deleted ${tempUsers.length} temporary users.`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupTempUsers();
```

Run with:
```bash
cd tools
node cleanup-temp-users.js
```

## Re-Adding Users

For the user you mentioned (`c9ryh3OMQ6btnQGK9Fa4ou2A1Bf2`):

### If they have already logged in:
1. Go to User Management
2. Find their entry (will show their UID or email)
3. Click "Edit" on their user card
4. Change their role from "User" to "Super User"
5. Toggle the required permissions (all should auto-enable for Super User)
6. Save changes
7. User needs to **refresh their browser** to see new permissions

### If they haven't logged in yet:
1. Delete any existing temp user document for them (via Firebase Console)
2. Go to User Management → "Add New User"
3. Enter their email address
4. Select "Super User" role
5. Click "Add User"
6. System will create an invitation
7. When they log in, their account will automatically be set up with Super User permissions

## Verification Steps

After fixing a user's role:

1. **User should log out and log back in** (to refresh their auth token and permissions)
2. Check that they can see:
   - Settings menu with extra options (if they have permissions)
   - All customers if they have `viewAllCustomers` permission
   - Admin panel tabs based on their permissions
3. In User Management, their badge should show "Super User" not "User"

## Important Notes

- **Existing users need to re-login** after their role/permissions are updated
- The invitation system only applies to NEW users added going forward
- Users created before this fix may need manual role updates via User Management
- Temp user documents (starting with `user_`) are safe to delete - they're orphaned data

## Testing

To test the new invitation system:

1. Add a new user with email `test@example.com` as Super User
2. Check User Management - should show "⏳ Pending Invitation"
3. Log in with `test@example.com` (or have them log in)
4. Check that:
   - User document is created at `users/{their-real-firebase-uid}`
   - Role is "superuser"
   - Permissions are correctly set
   - Invitation is marked as processed
   - User can access Super User features immediately

## Related Files

- `src/components/UserManagement.js` - User invitation creation
- `src/App.js` - Invitation processing on login
- `firestore.rules` - Security rules for invitations
- `src/hooks/usePermissions.js` - Permission checking logic
- `src/constants/roles.js` - Role and permission definitions

---

**Date Fixed**: November 14, 2025  
**Issue**: User roles not applying due to UID mismatch  
**Solution**: Invitation-based user creation with automatic processing on first login
