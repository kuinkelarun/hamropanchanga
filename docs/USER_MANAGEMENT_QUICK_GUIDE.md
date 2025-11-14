# Super User & User Management - Quick Start Guide

## For Administrators

### Quick Access
**Settings Menu** → **Admin Management** → **User Management** tab

---

## Common Tasks

### 1. Create a Super User

```
1. Click "+ Add New User"
2. Enter:
   - Email: superuser@example.com
   - Display Name: John Doe
   - Role: Super User
3. Click "Add User"
4. Find user in list, click "Edit Permissions"
5. Toggle permissions as needed:
   ☐ Manage Home Page Cards
   ☐ Bulk Upload Management
   ☐ Manage Tithis
   ☐ Manage Events
   ☐ Manual Management Dashboard
6. Done! User can now access granted features
```

### 2. Change User Role

```
1. Find user in list
2. Click "Edit Permissions"
3. Change role dropdown:
   - Regular User
   - Super User
   - Admin
4. Auto-saves and updates permissions
```

### 3. Grant Specific Permissions to Super User

```
1. User must have "Super User" role first
2. Click "Edit Permissions"
3. Toggle checkboxes for desired permissions
4. Changes save automatically
```

### 4. Deactivate a User

```
1. Find user in list
2. Click "Deactivate"
3. User loses access immediately
4. Data is preserved
5. Click "Activate" to restore access
```

---

## Role Comparison

| Feature | Admin | Super User | Regular User |
|---------|-------|------------|--------------|
| Manage Users | ✅ Always | ❌ Never | ❌ Never |
| View All Customers | ✅ Always | ❌ Never | ❌ Never |
| Manage Home Cards | ✅ Always | ⚙️ Configurable | ❌ Never |
| Bulk Upload | ✅ Always | ⚙️ Configurable | ❌ Never |
| Manage Tithis | ✅ Always | ⚙️ Configurable | ❌ Never |
| Manage Events | ✅ Always | ⚙️ Configurable | ❌ Never |
| Manual Dashboard | ✅ Always | ⚙️ Configurable | ❌ Never |
| Own Customers | ✅ Always | ✅ Always | ✅ Always |

**Legend:**
- ✅ Always available
- ❌ Never available
- ⚙️ Can be toggled by Admin

---

## Key Restrictions for Super Users

### ❌ Cannot Access:
- User Management page
- Other users' customer data
- Other users' family members
- Permission management

### ✅ Can Access (if granted):
- Home page cards management
- Bulk upload tools
- Tithi management
- Event management
- Data management dashboard
- Their own customer data (always)

---

## Search & Filter

### Search Box
Type email or name to find users quickly

### Role Filter
- **All Roles** - Show everyone
- **Admins** - Only administrators
- **Super Users** - Only super users
- **Regular Users** - Only regular users

---

## Bootstrap: Creating First Admin

**Option 1: Firestore Console**
```
1. Firebase Console → Firestore
2. Go to adminList collection
3. Add document:
   - Document ID: [your-user-uid]
   - Fields:
     * email: "your@email.com"
     * addedAt: [current timestamp]
4. Refresh app
```

**Option 2: users Collection**
```
1. Firebase Console → Firestore
2. Go to users collection
3. Add/update document:
   - Document ID: [your-user-uid]
   - Fields:
     * role: "admin"
     * email: "your@email.com"
4. Refresh app
```

---

## Permission Descriptions

| Permission | What It Allows |
|------------|----------------|
| **Manage Users** | Create, edit, delete users and assign roles (Admin only) |
| **View All Customers** | See all users' customer data (Admin only) |
| **Manage Home Cards** | Edit featured cards on home page |
| **Bulk Upload** | Upload Tithis/Events via Excel files |
| **Manage Tithis** | Create, edit, delete Tithis (calendar events) |
| **Manage Events** | Create, edit, delete calendar events |
| **Manual Dashboard** | Access data management and cleanup tools |
| **Manage Own Customers** | Edit your own customer data (Everyone) |
| **View Own Customers** | See your own customer data (Everyone) |

---

## Best Practices

### 1. Principle of Least Privilege
- Only grant permissions users actually need
- Start with minimal permissions
- Add more as needed

### 2. Regular Audits
- Review user list monthly
- Remove inactive users
- Update permissions as roles change

### 3. Super User Usage
- Use for power users who need some admin features
- Don't grant all permissions automatically
- Consider each permission carefully

### 4. Admin Account Security
- Limit number of admin accounts
- Use strong passwords
- Enable 2FA (when available)

---

## Troubleshooting

### User can't see a feature
1. Check their role in User Management
2. If Super User, verify permission is toggled ON
3. Ask user to log out and log back in
4. Check browser console for errors

### Permission changes not taking effect
1. User must log out and back in
2. Clear browser cache
3. Verify permission saved in Firestore
4. Check Firestore rules are deployed

### Super User sees all customers
1. **This shouldn't happen!**
2. Check user's role is exactly "superuser"
3. Verify Firestore rules are deployed
4. Check users/{uid}/role field
5. Remove from adminList if present

---

## Quick Reference: User States

```
┌─────────────┐
│  New User   │ → Default: Regular User
└─────────────┘
      ↓
┌─────────────┐
│  Assign     │ → Admin sets role
│  Role       │
└─────────────┘
      ↓
┌─────────────┐
│ Configure   │ → If Super User, toggle permissions
│ Permissions │
└─────────────┘
      ↓
┌─────────────┐
│   Active    │ → User can access system
└─────────────┘
      ↓ (optional)
┌─────────────┐
│  Deactivate │ → Remove access, keep data
└─────────────┘
      ↓ (optional)
┌─────────────┐
│ Reactivate  │ → Restore access
└─────────────┘
```

---

## Need Help?

- 📚 Full documentation: `docs/SUPER_USER_IMPLEMENTATION.md`
- 🔍 Check Firestore Console for user data
- 🛡️ Review security rules in Firebase Console
- 💬 Contact system administrator

---

**Last Updated:** November 14, 2025
