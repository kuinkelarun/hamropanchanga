import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';

/**
 * Get all users from Firestore
 * @returns {Promise<Array>} Array of user objects
 */
export async function getAllUsers() {
  try {
    const usersCollection = collection(db, COLLECTIONS.USERS);
    const snapshot = await getDocs(usersCollection);
    
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Get a specific user by UID
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
export async function getUserByUid(uid) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Create or update a user with role and permissions
 * @param {string} uid - User ID
 * @param {Object} userData - User data object
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role (admin, superuser, user)
 * @param {Object} userData.permissions - Permission overrides
 * @returns {Promise<void>}
 */
export async function createOrUpdateUser(uid, userData) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const existingUser = await getDoc(userDocRef);
    
    const role = userData.role || USER_ROLES.USER;
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER];
    
    const userDataToSave = {
      email: userData.email,
      displayName: userData.displayName || '',
      role: role,
      permissions: userData.permissions || defaultPermissions,
      active: userData.active !== undefined ? userData.active : true,
      updatedAt: new Date().toISOString(),
      ...(existingUser.exists() ? {} : { createdAt: new Date().toISOString() })
    };

    await setDoc(userDocRef, userDataToSave, { merge: true });

    // If user is being made admin, also add to adminList collection
    if (role === USER_ROLES.ADMIN) {
      const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, uid);
      await setDoc(adminDocRef, {
        email: userData.email,
        addedAt: new Date().toISOString()
      });
    } else {
      // If user is no longer admin, remove from adminList
      const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, uid);
      const adminDoc = await getDoc(adminDocRef);
      if (adminDoc.exists()) {
        await deleteDoc(adminDocRef);
      }
    }

    return userDataToSave;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * Update user permissions
 * @param {string} uid - User ID
 * @param {Object} permissions - Permissions object
 * @returns {Promise<void>}
 */
export async function updateUserPermissions(uid, permissions) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userDocRef, {
      permissions: permissions,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    throw error;
  }
}

/**
 * Update user role
 * @param {string} uid - User ID
 * @param {string} newRole - New role
 * @returns {Promise<void>}
 */
export async function updateUserRole(uid, newRole) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER];
    
    await updateDoc(userDocRef, {
      role: newRole,
      permissions: defaultPermissions,
      updatedAt: new Date().toISOString()
    });

    // Update adminList if necessary
    const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, uid);
    if (newRole === USER_ROLES.ADMIN) {
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      await setDoc(adminDocRef, {
        email: userData.email,
        addedAt: new Date().toISOString()
      });
    } else {
      const adminDoc = await getDoc(adminDocRef);
      if (adminDoc.exists()) {
        await deleteDoc(adminDocRef);
      }
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

/**
 * Deactivate/activate a user
 * @param {string} uid - User ID
 * @param {boolean} active - Active status
 * @returns {Promise<void>}
 */
export async function toggleUserActive(uid, active) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userDocRef, {
      active: active,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error toggling user active status:', error);
    throw error;
  }
}

/**
 * Delete a user (only removes from users collection, not Firebase Auth)
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
export async function removeUser(uid) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    await deleteDoc(userDocRef);

    // Also remove from adminList if present
    const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, uid);
    const adminDoc = await getDoc(adminDocRef);
    if (adminDoc.exists()) {
      await deleteDoc(adminDocRef);
    }
  } catch (error) {
    console.error('Error removing user:', error);
    throw error;
  }
}

/**
 * Check if a user has a specific permission
 * @param {string} uid - User ID
 * @param {string} permission - Permission key
 * @returns {Promise<boolean>}
 */
export async function checkUserPermission(uid, permission) {
  try {
    const user = await getUserByUid(uid);
    if (!user) return false;
    
    return user.permissions && user.permissions[permission] === true;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}
