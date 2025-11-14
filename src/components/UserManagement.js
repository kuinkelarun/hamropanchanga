import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  getAllUsers, 
  createOrUpdateUser, 
  updateUserRole, 
  updateUserPermissions,
  toggleUserActive,
  removeUser
} from '../utils/userManagement';
import { 
  USER_ROLES, 
  ROLE_LABELS, 
  PERMISSIONS, 
  PERMISSION_LABELS,
  CONFIGURABLE_SUPERUSER_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS 
} from '../constants/roles';
import { useUserPermissions } from '../hooks/usePermissions';
import './UserManagement.css';

export default function UserManagement({ currentUser, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // New user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState(USER_ROLES.USER);

  // Permission hook to check admin status
  const { isAdmin: isAdminFromHook, loading: permsLoading } = useUserPermissions(currentUser);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get all users from Firestore users collection
      const usersData = await getAllUsers();
      const userMap = new Map(usersData.map(user => [user.uid, user]));
      
      console.log('Loaded users from users collection:', usersData.map(u => ({ uid: u.uid, email: u.email })));
      
      // Get adminList to find users who may not be in users collection
      const adminListSnapshot = await getDocs(collection(db, 'adminList'));
      const adminUids = new Set();
      
      // Add admin users to the map if they don't exist
      adminListSnapshot.docs.forEach(doc => {
        adminUids.add(doc.id);
        const adminData = doc.data();
        
        if (!userMap.has(doc.id)) {
          // User is in adminList but not in users collection
          userMap.set(doc.id, {
            uid: doc.id,
            email: adminData.email || (doc.id === currentUser?.uid ? currentUser.email : 'Unknown'),
            displayName: adminData.displayName || (doc.id === currentUser?.uid ? currentUser.displayName : ''),
            role: 'admin',
            permissions: DEFAULT_ROLE_PERMISSIONS.admin,
            active: true,
            isInAdminList: true,
            createdAt: adminData.addedAt || new Date().toISOString(),
            needsSetup: !adminData.email
          });
        } else {
          // User exists, just mark as in admin list
          userMap.get(doc.id).isInAdminList = true;
        }
      });
      
      // Get pending invitations
      const invitationsSnapshot = await getDocs(collection(db, 'userInvitations'));
      invitationsSnapshot.docs.forEach(doc => {
        const inviteData = doc.data();
        
        // Check if invitation is still pending (not processed)
        if (!inviteData.processed) {
          // Check if a user with this email already exists (they may have logged in)
          const emailMatch = Array.from(userMap.values()).find(
            u => u.email?.toLowerCase() === inviteData.email?.toLowerCase()
          );
          
          // Only show as pending if no user with this email exists yet
          if (!emailMatch) {
            // Generate a unique temporary ID for the pending invitation
            const tempId = `pending_${doc.id}`;
            
            userMap.set(tempId, {
              uid: tempId,
              invitationEmail: doc.id, // Store the invitation document ID (email)
              email: inviteData.email,
              displayName: inviteData.displayName || '',
              role: inviteData.role,
              permissions: inviteData.permissions,
              active: true,
              isPending: true,
              createdAt: inviteData.createdAt,
              needsSetup: false
            });
          }
        }
      });
      
      // Get customers to find users who have created data
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customerUserIds = new Set(
        customersSnapshot.docs
          .map(doc => doc.data().userId)
          .filter(Boolean)
      );
      
      // Add users who have customers but aren't in users or adminList
      for (const userId of customerUserIds) {
        if (!userMap.has(userId)) {
          // Try to get user info from their first customer
          const userCustomers = customersSnapshot.docs.filter(
            doc => doc.data().userId === userId
          );
          
          const firstCustomer = userCustomers[0]?.data();
          
          userMap.set(userId, {
            uid: userId,
            email: userId === currentUser?.uid ? currentUser.email : (firstCustomer?.userEmail || userId),
            displayName: userId === currentUser?.uid ? currentUser.displayName : (firstCustomer?.userName || ''),
            role: 'user',
            permissions: DEFAULT_ROLE_PERMISSIONS.user,
            active: true,
            isInAdminList: false,
            createdAt: firstCustomer?.createdAt || new Date().toISOString(),
            hasCustomers: true,
            needsSetup: true
          });
        } else {
          userMap.get(userId).hasCustomers = true;
        }
      }
      
      // Update current user's email if available
      if (currentUser && userMap.has(currentUser.uid)) {
        const user = userMap.get(currentUser.uid);
        if (!user.email || user.email === 'Unknown') {
          user.email = currentUser.email || user.email;
          user.displayName = user.displayName || currentUser.displayName || '';
        }
      }
      
      // Convert map to array, normalize emails and set needsSetup when missing
      const allUsers = Array.from(userMap.values()).map(u => {
        let email = u.email;

        // If email is missing or clearly a UID (no @), try to resolve from customers
        if (!email || !email.includes('@')) {
          const custDoc = customersSnapshot?.docs.find(d => d.data().userId === u.uid);
          if (custDoc) {
            email = custDoc.data().userEmail || email;
          }
        }

        // Final fallback: if no usable email, mark as Unknown and needsSetup
        if (!email || !email.includes('@')) {
          email = u.email && typeof u.email === 'string' && u.email.includes('@') ? u.email : (u.invitationEmail ? u.email : 'Unknown');
        }

        return {
          ...u,
          email,
          needsSetup: !!(u.needsSetup || !email || !email.includes('@'))
        };
      }).sort((a, b) => (a.email || '').localeCompare(b.email || ''));

      setUsers(allUsers);
      setLoading(false);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users: ' + err.message);
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Create an invitation document that will be processed when the user logs in
      // This ensures the user document is created with the correct Firebase Auth UID
      const invitationRef = doc(db, 'userInvitations', newUserEmail.trim().toLowerCase());
      
      await setDoc(invitationRef, {
        email: newUserEmail.trim(),
        emailLower: newUserEmail.trim().toLowerCase(),
        displayName: newUserDisplayName.trim(),
        role: newUserRole,
        permissions: DEFAULT_ROLE_PERMISSIONS[newUserRole],
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        processed: false
      });

      setSuccess(`Invitation created for ${newUserEmail}. Their role and permissions will be set when they log in for the first time.`);
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserDisplayName('');
      setNewUserRole(USER_ROLES.USER);
      
      await loadUsers();
      setLoading(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating invitation:', err);
      setError('Failed to create invitation: ' + err.message);
      setLoading(false);
    }
  };

  const handleRoleChange = async (uid, newRole) => {
    try {
      setError('');
      await updateUserRole(uid, newRole);
      setSuccess('Role updated successfully!');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role: ' + err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    try {
      setError('');

      if (!isAdminFromHook) {
        setError('Only admins can delete users');
        return;
      }

      const confirmMsg = user.isPending
        ? `Permanently delete invitation for ${user.email}? This cannot be undone.`
        : `Permanently delete user ${user.email || user.uid}? This will remove their user record (not Firebase Auth).`;

      if (!window.confirm(confirmMsg)) return;

      if (user.isPending && user.invitationEmail) {
        await deleteDoc(doc(db, 'userInvitations', user.invitationEmail.toLowerCase()));
      } else {
        await removeUser(user.uid);
      }

      setSuccess('User deleted successfully');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user: ' + err.message);
    }
  };

  const handleUpdateUserInfo = async (uid, email, displayName) => {
    try {
      setError('');
      
      const user = users.find(u => u.uid === uid);
      if (!user) return;
      
      await createOrUpdateUser(uid, {
        email: email.trim(),
        displayName: displayName.trim(),
        role: user.role,
        permissions: user.permissions,
        active: user.active
      });
      
      setSuccess('User information updated successfully!');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user info:', err);
      setError('Failed to update user information: ' + err.message);
    }
  };

  const handlePermissionToggle = async (uid, permission, currentValue) => {
    try {
      setError('');
      
      const user = users.find(u => u.uid === uid);
      if (!user) return;

      const updatedPermissions = {
        ...user.permissions,
        [permission]: !currentValue
      };

      await updateUserPermissions(uid, updatedPermissions);
      setSuccess('Permissions updated successfully!');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError('Failed to update permissions: ' + err.message);
    }
  };

  const handleToggleActive = async (uid, currentActive) => {
    try {
      setError('');
      await toggleUserActive(uid, !currentActive);
      setSuccess('User status updated successfully!');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling user active status:', err);
      setError('Failed to update user status: ' + err.message);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user.uid === editingUser ? null : user.uid);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (loading && users.length === 0) {
    return (
      <div className="user-management">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <div className="header-top">
          <button onClick={onBack} className="back-button">
            ← Back to Admin Panel
          </button>
          <h2>User Management</h2>
        </div>
        
        {/* Info Note about email addresses and pending invitations */}
        <div className="info-note">
          <strong>📧 About Users:</strong> 
          <ul style={{margin: '8px 0 0 20px', paddingLeft: 0}}>
            <li><strong>⏳ Pending Invitation</strong> - User hasn't logged in yet. They'll be automatically set up when they log in for the first time.</li>
            <li><strong>Active Users</strong> - Users who have logged in. Their email comes from their Google account.</li>
            <li><strong>📊 Has Data</strong> - User has created customer records.</li>
          </ul>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="header-controls">
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="role-filter"
          >
            <option value="all">All Roles</option>
            <option value={USER_ROLES.ADMIN}>Admins</option>
            <option value={USER_ROLES.SUPER_USER}>Super Users</option>
            <option value={USER_ROLES.USER}>Regular Users</option>
          </select>

          <button 
            onClick={() => setShowAddUser(!showAddUser)}
            className="add-user-button"
          >
            {showAddUser ? 'Cancel' : '+ Add New User'}
          </button>
        </div>
      </div>

      {showAddUser && (
        <div className="add-user-form">
          <h3>Add New User</h3>
          <p className="form-note">
            Note: In production, this should integrate with Firebase Authentication. 
            Currently creates a Firestore user document only.
          </p>
          
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={newUserDisplayName}
              onChange={(e) => setNewUserDisplayName(e.target.value)}
              placeholder="John Doe"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Role *</label>
            <select 
              value={newUserRole} 
              onChange={(e) => setNewUserRole(e.target.value)}
              className="form-select"
            >
              <option value={USER_ROLES.USER}>{ROLE_LABELS[USER_ROLES.USER]}</option>
              <option value={USER_ROLES.SUPER_USER}>{ROLE_LABELS[USER_ROLES.SUPER_USER]}</option>
              <option value={USER_ROLES.ADMIN}>{ROLE_LABELS[USER_ROLES.ADMIN]}</option>
            </select>
          </div>

          <div className="form-actions">
            <button onClick={handleAddUser} className="submit-button">
              Add User
            </button>
            <button onClick={() => setShowAddUser(false)} className="cancel-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="users-list">
        <div className="users-count">
          Showing {filteredUsers.length} of {users.length} users
        </div>

        {filteredUsers.length === 0 ? (
          <div className="no-users">No users found</div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.uid} className={`user-card ${!user.active ? 'inactive' : ''}`}>
              <div className="user-basic-info">
                <div className="user-details">
                  <div className="user-name">
                    {user.displayName || 'No Name'}
                    {user.uid === currentUser?.uid && (
                      <span className="current-user-badge">You</span>
                    )}
                    {user.isPending && (
                      <span className="pending-badge" title="User invitation pending - will be activated when they log in">
                        ⏳ Pending Invitation
                      </span>
                    )}
                    {!user.active && !user.isPending && <span className="inactive-badge">Inactive</span>}
                    {user.needsSetup && !user.isPending && (
                      <span className="needs-setup-badge" title="User profile needs email/name setup">
                        ⚠️ Needs Setup
                      </span>
                    )}
                    {user.hasCustomers && (
                      <span className="has-data-badge" title="This user has customer data">
                        📊 Has Data
                      </span>
                    )}
                  </div>
                  <div className="user-email">
                    {user.email}
                    {user.needsSetup && user.email !== 'Unknown' && user.email.includes('auth') && (
                      <span className="uid-hint" title="User ID for reference"> (UID: {user.uid.substring(0, 8)}...)</span>
                    )}
                  </div>
                  <div className="user-meta">
                    <span className={`role-badge role-${user.role}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    {user.createdAt && (
                      <span className="created-date">
                        Added: {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="user-actions">
                  {user.isPending && (
                    <div className="pending-message" style={{color: '#6b7280', fontSize: '13px', fontStyle: 'italic'}}>
                      User will be activated when they log in
                    </div>
                  )}
                  {user.uid !== currentUser?.uid && !user.isPending && (
                    <>
                      <button
                        onClick={() => handleToggleActive(user.uid, user.active)}
                        className={`toggle-active-button ${user.active ? 'deactivate' : 'activate'}`}
                        title={user.active ? 'Deactivate user' : 'Activate user'}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="edit-button"
                      >
                        {editingUser === user.uid ? 'Close' : 'Edit Permissions'}
                      </button>
                    </>
                  )}
                  {isAdminFromHook && user.uid !== currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="delete-button"
                      title="Permanently delete user"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {editingUser === user.uid && (
                <div className="user-permissions-panel">
                  <div className="permissions-section">
                    <h4>Role</h4>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                      className="role-select"
                      disabled={user.uid === currentUser?.uid}
                    >
                      <option value={USER_ROLES.USER}>{ROLE_LABELS[USER_ROLES.USER]}</option>
                      <option value={USER_ROLES.SUPER_USER}>{ROLE_LABELS[USER_ROLES.SUPER_USER]}</option>
                      <option value={USER_ROLES.ADMIN}>{ROLE_LABELS[USER_ROLES.ADMIN]}</option>
                    </select>
                  </div>

                  {user.role === USER_ROLES.SUPER_USER && (
                    <div className="permissions-section">
                      <h4>Configurable Permissions</h4>
                      <p className="permissions-note">
                        Toggle specific permissions for this Super User. 
                        Super Users cannot access other users' customer data or manage users.
                      </p>
                      
                      <div className="permissions-grid">
                        {CONFIGURABLE_SUPERUSER_PERMISSIONS.map(permission => (
                          <div key={permission} className="permission-item">
                            <label className="permission-label">
                              <input
                                type="checkbox"
                                checked={user.permissions?.[permission] === true}
                                onChange={() => handlePermissionToggle(
                                  user.uid, 
                                  permission, 
                                  user.permissions?.[permission]
                                )}
                                className="permission-checkbox"
                              />
                              <span>{PERMISSION_LABELS[permission]}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {user.role === USER_ROLES.ADMIN && (
                    <div className="permissions-section">
                      <div className="admin-permissions-note">
                        <strong>Admin users</strong> have full access to all features, 
                        including user management and viewing all customer data.
                      </div>
                    </div>
                  )}

                  {user.role === USER_ROLES.USER && (
                    <div className="permissions-section">
                      <div className="user-permissions-note">
                        <strong>Regular users</strong> can only manage their own customers 
                        and view their own data.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
