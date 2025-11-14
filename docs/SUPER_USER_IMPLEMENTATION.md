# Super User Role & User Management System

## Overview

This document describes the implementation of a comprehensive role-based access control (RBAC) system for the Family Tree CRM application, including the new **Super User** role and a dedicated **User Management** interface.

## Implementation Date
November 14, 2025

---

## Table of Contents

1. [Roles & Permissions](#roles--permissions)
2. [User Management Interface](#user-management-interface)
3. [Data Isolation](#data-isolation)
4. [Security Rules](#security-rules)
5. [Implementation Details](#implementation-details)
6. [Usage Guide](#usage-guide)
7. [API Reference](#api-reference)

---

## Roles & Permissions

### Three-Tier Role System

#### 1. **Admin**
- Full unrestricted access to all features
- Can view ALL users' customer data
- Can manage other users (create, edit, delete, assign roles)
- Can access User Management page
- All permissions enabled by default

**Default Permissions:**
- ✅ Manage Users
- ✅ View All Customers
- ✅ Manage Home Cards
- ✅ Bulk Upload
- ✅ Manage Tithis
- ✅ Manage Events
- ✅ Manual Dashboard
- ✅ Manage Own Customers
- ✅ View Own Customers

#### 2. **Super User** (NEW)
- Admin-level capabilities for system management
- **CANNOT** view other users' customer data
- **CANNOT** manage users or assign roles
- Permissions can be selectively granted by Admins

**Configurable Permissions:**
- ⚙️ Manage Home Cards (togglable)
- ⚙️ Bulk Upload Management (togglable)
- ⚙️ Manage Tithis (togglable)
- ⚙️ Manage Events (togglable)
- ⚙️ Manual Management Dashboard (togglable)

**Fixed Permissions:**
- ❌ Manage Users (always disabled)
- ❌ View All Customers (always disabled)
- ✅ Manage Own Customers (always enabled)
- ✅ View Own Customers (always enabled)

#### 3. **Regular User**
- Basic access level
- Can only manage their own customer data
- No admin features

**Default Permissions:**
- ✅ Manage Own Customers
- ✅ View Own Customers
- ❌ All other permissions disabled

---

## User Management Interface

### Access
- **Location:** Admin Management → User Management tab
- **Access Level:** Admin only (Super Users cannot access)

### Features

#### a. **Add New Users**
Admins can create new users with the following options:
- Email address (required)
- Display name (optional)
- Role selection:
  - Regular User
  - Super User
  - Admin

**Note:** Current implementation creates Firestore user documents. In production, this should be integrated with Firebase Authentication via Cloud Functions.

#### b. **Edit User Roles**
- Change user roles via dropdown
- Role changes automatically update permissions
- Admins cannot modify their own role (safety feature)

#### c. **Fine-Grained Permission Management**
For **Super Users**, Admins can toggle individual permissions:

```
┌─────────────────────────────────────────┐
│  Configurable Permissions               │
├─────────────────────────────────────────┤
│  ☐ Manage Home Page Cards               │
│  ☐ Bulk Upload Management               │
│  ☐ Manage Tithis                        │
│  ☐ Manage Events                        │
│  ☐ Manual Management Dashboard          │
└─────────────────────────────────────────┘
```

Each permission appears as a checkbox/toggle that can be independently controlled.

#### d. **User Status Management**
- Activate/Deactivate users
- Inactive users maintain their data but lose access
- Visual indicators for inactive accounts

#### e. **Search & Filter**
- Search by email or display name
- Filter by role (All, Admin, Super User, Regular User)
- Real-time filtering

---

## Data Isolation

### Super User Restrictions

Super Users are **explicitly prevented** from accessing:

1. **Other Users' Customer Lists**
   - Firestore queries filtered by `userId`
   - Only returns customers where `userId === currentUser.uid`

2. **Other Users' Family Members**
   - All family member data scoped to customer owner

3. **User Management Interface**
   - UI navigation hidden from Super Users
   - Server-side rules prevent unauthorized access

### Implementation

**Client-Side (App.js):**
```javascript
// Admins see all customers, Super Users see only their own
if (isAdmin || hasPermission(PERMISSIONS.VIEW_ALL_CUSTOMERS)) {
    q = collection(db, 'customers');
} else {
    q = query(collection(db, 'customers'), where('userId', '==', user.uid));
}
```

**Server-Side (firestore.rules):**
```javascript
match /customers/{customerId} {
    // Admins can read/write any customer
    // Super Users and regular users can only access their own customers
    allow read, write: if isAdmin() || (
        (request.resource != null && isOwnerOfUserId(request.resource.data.userId)) ||
        (resource != null && isOwnerOfUserId(resource.data.userId))
    );
}
```

---

## Security Rules

### Firestore Security Rules

New helper functions added to `firestore.rules`:

```javascript
// Check if user is a Super User
function isSuperUser() {
    return isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superuser';
}

// Check if user has a specific permission
function hasPermission(permission) {
    return isAuthenticated() && (
        isAdmin() || // Admins have all permissions
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions[permission] == true)
    );
}
```

### Collection Rules Updated

- **tithis:** Write access requires `manageTithis` permission
- **homeCards:** Read/write requires `manageHomeCards` permission
- **calendarEvents:** Create/update requires `manageEvents` permission or ownership
- **users:** Only admins can write, users can read their own document

---

## Implementation Details

### File Structure

```
src/
├── constants/
│   └── roles.js                    # Role and permission constants
├── hooks/
│   └── usePermissions.js           # Permission checking hooks
├── utils/
│   └── userManagement.js           # User CRUD operations
├── components/
│   ├── UserManagement.js           # User management UI
│   ├── UserManagement.css          # Styling
│   ├── AdminManagement.js          # Updated with permissions
│   ├── AdminEditCards.js           # Updated with permissions
│   └── SettingsMenu.js             # Updated with permissions
└── App.js                          # Updated customer filtering
```

### Key Files Created

#### 1. `src/constants/roles.js`
Defines:
- `USER_ROLES` - Role constants
- `PERMISSIONS` - Permission keys
- `DEFAULT_ROLE_PERMISSIONS` - Default permission sets
- `CONFIGURABLE_SUPERUSER_PERMISSIONS` - Permissions that can be toggled
- `PERMISSION_LABELS` - UI labels for permissions
- `ROLE_LABELS` - UI labels for roles

#### 2. `src/hooks/usePermissions.js`
Provides:
- `useUserPermissions(user)` - Main hook for permission checking
- `useIsAdmin(user)` - Backward compatibility hook

Returns:
```javascript
{
    role,              // User's role
    permissions,       // Object of all permissions
    loading,           // Loading state
    error,            // Error state
    hasPermission,     // Function to check single permission
    hasAllPermissions, // Function to check multiple permissions
    hasAnyPermission,  // Function to check if user has any of the permissions
    isAdmin,          // Boolean
    isSuperUser,      // Boolean
    isRegularUser,    // Boolean
    refetch           // Function to reload permissions
}
```

#### 3. `src/utils/userManagement.js`
Functions:
- `getAllUsers()` - Fetch all users
- `getUserByUid(uid)` - Get specific user
- `createOrUpdateUser(uid, userData)` - Create/update user
- `updateUserPermissions(uid, permissions)` - Update permissions
- `updateUserRole(uid, newRole)` - Change user role
- `toggleUserActive(uid, active)` - Activate/deactivate user
- `removeUser(uid)` - Delete user
- `checkUserPermission(uid, permission)` - Check permission

#### 4. `src/components/UserManagement.js`
Full-featured user management interface with:
- User list with search and filtering
- Add new user form
- Role editing
- Permission toggles for Super Users
- User activation/deactivation

---

## Usage Guide

### For Admins

#### Creating a Super User

1. Navigate to **Admin Management** → **User Management**
2. Click **"+ Add New User"**
3. Enter email and display name
4. Select role: **"Super User"**
5. Click **"Add User"**
6. Click **"Edit Permissions"** on the new user
7. Toggle desired permissions:
   - ☑️ Manage Home Cards
   - ☑️ Bulk Upload Management
   - ☑️ Manage Tithis
   - ☑️ Manage Events
   - ☑️ Manual Management Dashboard

#### Managing Permissions

1. Find the user in the list
2. Click **"Edit Permissions"**
3. For Super Users:
   - Toggle individual permissions as needed
   - Changes save automatically
4. For changing roles:
   - Select new role from dropdown
   - Permissions reset to role defaults

#### Deactivating a User

1. Find the user in the list
2. Click **"Deactivate"**
3. User loses access but data is preserved
4. Click **"Activate"** to restore access

### For Super Users

Super Users with appropriate permissions can:

1. **Manage Home Cards** (if permission granted)
   - Access via Settings → Manage Home Cards
   - Create, edit, delete feature cards
   - Publish/unpublish cards

2. **Bulk Upload** (if permission granted)
   - Access via Settings → Admin Management
   - Upload Tithis and Events via Excel
   - View Tithis and Events tabs
   - Access Data Management (if permission granted)

3. **Manage Calendar** (if permission granted)
   - Enable Edit Mode in Settings
   - Add/edit/delete Tithis
   - Add/edit/delete Events

4. **Own Customer Data** (always available)
   - View and manage their own customers
   - Add/edit family members
   - Schedule events

**Super Users CANNOT:**
- View other users' customer data
- Access User Management page
- Change their own or others' permissions
- Promote themselves to Admin

### For Regular Users

Regular users can only:
- View and manage their own customer data
- Add/edit their own family members
- Create personal events
- View public Tithis and Events

---

## API Reference

### useUserPermissions Hook

```javascript
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

function MyComponent({ user }) {
    const { hasPermission, isAdmin, isSuperUser } = useUserPermissions(user);
    
    // Check single permission
    if (hasPermission(PERMISSIONS.MANAGE_HOME_CARDS)) {
        // Show home cards management UI
    }
    
    // Check role
    if (isAdmin) {
        // Show admin-only features
    }
    
    if (isSuperUser) {
        // Show super user features
    }
}
```

### User Management Functions

```javascript
import { 
    getAllUsers, 
    createOrUpdateUser, 
    updateUserPermissions 
} from '../utils/userManagement';
import { USER_ROLES, PERMISSIONS } from '../constants/roles';

// Create a super user
await createOrUpdateUser('user-uid-123', {
    email: 'superuser@example.com',
    displayName: 'John Doe',
    role: USER_ROLES.SUPER_USER,
    permissions: {
        [PERMISSIONS.MANAGE_TITHIS]: true,
        [PERMISSIONS.MANAGE_EVENTS]: true,
        [PERMISSIONS.BULK_UPLOAD]: true
    }
});

// Update permissions
await updateUserPermissions('user-uid-123', {
    [PERMISSIONS.MANAGE_HOME_CARDS]: true,
    [PERMISSIONS.MANAGE_TITHIS]: false
});
```

---

## Firestore Data Model

### users Collection

```javascript
/users/{uid}
{
    email: "user@example.com",
    displayName: "John Doe",
    role: "superuser",  // "admin" | "superuser" | "user"
    permissions: {
        manageUsers: false,
        viewAllCustomers: false,
        manageHomeCards: true,
        bulkUpload: true,
        manageTithis: true,
        manageEvents: true,
        manualDashboard: false,
        manageOwnCustomers: true,
        viewOwnCustomers: true
    },
    active: true,
    createdAt: "2025-11-14T10:30:00Z",
    updatedAt: "2025-11-14T10:30:00Z"
}
```

### adminList Collection

```javascript
/adminList/{uid}
{
    email: "admin@example.com",
    addedAt: "2025-11-14T10:30:00Z"
}
```

**Note:** Users in `adminList` collection are automatically treated as admins regardless of their role in the `users` collection.

---

## Migration & Bootstrap

### Creating the First Admin

Option 1: Via Firestore Console
1. Go to Firebase Console → Firestore
2. Navigate to `adminList` collection
3. Create a document with ID = user's UID
4. Add field: `email` = user's email
5. Add field: `addedAt` = current timestamp

Option 2: Via users Collection
1. Go to `users` collection
2. Create/update document with ID = user's UID
3. Set `role` = "admin"
4. Set `permissions` = all true

### Migrating Existing Users

Existing users will default to "Regular User" role until their role is explicitly set in the `users` collection. Admins should:

1. Access User Management page
2. Review all users
3. Assign appropriate roles
4. Configure Super User permissions as needed

---

## Testing Checklist

### Admin Testing
- [ ] Can access User Management page
- [ ] Can create new users
- [ ] Can change user roles
- [ ] Can toggle Super User permissions
- [ ] Can activate/deactivate users
- [ ] Can view all customer data
- [ ] Can access all admin features

### Super User Testing
- [ ] Cannot access User Management page
- [ ] Cannot view other users' customers
- [ ] Can access features based on granted permissions
- [ ] Can manage own customers
- [ ] Permission toggles work correctly
- [ ] Role changes apply immediately

### Regular User Testing
- [ ] Cannot access any admin features
- [ ] Can only see own customers
- [ ] Can manage own data
- [ ] Cannot see admin menu items

### Security Testing
- [ ] Firestore rules prevent unauthorized access
- [ ] Super Users blocked from /customers where userId != own
- [ ] Permission checks work on both client and server
- [ ] Inactive users cannot access system

---

## Future Enhancements

### Recommended Additions

1. **Firebase Authentication Integration**
   - Cloud Function to create Firebase Auth users
   - Email invitation system
   - Password reset flow

2. **Audit Logging**
   - Track permission changes
   - Log user role modifications
   - Monitor admin activities

3. **Advanced Permissions**
   - Time-based permissions (expire after date)
   - Resource-level permissions (specific customers only)
   - IP-based restrictions

4. **User Groups**
   - Create permission groups
   - Assign users to groups
   - Bulk permission management

5. **API Keys for Integrations**
   - Generate API keys for external access
   - Scope-based API permissions
   - Rate limiting

6. **Two-Factor Authentication**
   - Require 2FA for Admin accounts
   - SMS/Email verification
   - Authenticator app support

---

## Troubleshooting

### Common Issues

**Issue:** Super User can see all customers
- **Solution:** Check Firestore rules are deployed
- **Solution:** Verify user document has correct role
- **Solution:** Clear browser cache and re-login

**Issue:** Permissions not updating
- **Solution:** Check permissions object in users/{uid}
- **Solution:** Verify adminList document doesn't override
- **Solution:** Call refetch() in usePermissions hook

**Issue:** User Management page shows "Access Denied"
- **Solution:** Verify user is in adminList collection
- **Solution:** Check users/{uid}.role === 'admin'
- **Solution:** Verify Firestore rules allow admin read

**Issue:** New users can't log in
- **Solution:** Create Firebase Auth account first
- **Solution:** Ensure user document exists in Firestore
- **Solution:** Verify email matches between Auth and Firestore

---

## Support & Maintenance

For issues or questions regarding the role-based access control system:

1. Check this documentation first
2. Review Firestore security rules in Firebase Console
3. Check browser console for permission errors
4. Verify user documents in Firestore
5. Test with different user accounts

### Key Contacts
- System Administrator: [Configure in production]
- Technical Support: [Configure in production]

---

## Changelog

### v1.0.0 - November 14, 2025
- ✨ Initial implementation of Super User role
- ✨ Added User Management interface
- ✨ Implemented granular permissions system
- ✨ Updated Firestore security rules
- ✨ Added permission-based UI filtering
- ✨ Implemented data isolation for Super Users
- 🔒 Enhanced security with permission checks
- 📚 Created comprehensive documentation

---

## License & Credits

Part of Family Tree CRM Application
Implementation Date: November 14, 2025
