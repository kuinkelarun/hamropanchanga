import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { USER_ROLES, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';

/**
 * Hook to fetch and manage user role and permissions
 * @param {Object} user - Firebase auth user object
 * @returns {Object} { role, permissions, loading, error, hasPermission, isAdmin, isSuperUser, isRegularUser, refetch }
 */
export function useUserPermissions(user) {
  const [role, setRole] = useState(USER_ROLES.USER);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserPermissions = useCallback(async () => {
    if (!user) {
      setRole(USER_ROLES.USER);
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if user is in adminList collection (primary admin check)
      const adminDocRef = doc(db, 'adminList', user.uid);
      const adminDocSnap = await getDoc(adminDocRef);
      
      if (adminDocSnap.exists()) {
        setRole(USER_ROLES.ADMIN);
        setPermissions(DEFAULT_ROLE_PERMISSIONS[USER_ROLES.ADMIN]);
        setLoading(false);
        return;
      }

      // Check users collection for role and permissions
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRole = userData.role || USER_ROLES.USER;
        const userPermissions = userData.permissions || {};

        setRole(userRole);
        
        // Merge default permissions with user-specific overrides
        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER];
        setPermissions({ ...defaultPerms, ...userPermissions });
      } else {
        // User document doesn't exist - default to regular user
        setRole(USER_ROLES.USER);
        setPermissions(DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      setError(err.message);
      // Default to regular user on error
      setRole(USER_ROLES.USER);
      setPermissions(DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission key from PERMISSIONS constant
   * @returns {boolean}
   */
  const hasPermission = useCallback((permission) => {
    return permissions[permission] === true;
  }, [permissions]);

  /**
   * Check if user has ALL of the specified permissions
   * @param {string[]} permissionList - Array of permission keys
   * @returns {boolean}
   */
  const hasAllPermissions = useCallback((permissionList) => {
    return permissionList.every(perm => permissions[perm] === true);
  }, [permissions]);

  /**
   * Check if user has ANY of the specified permissions
   * @param {string[]} permissionList - Array of permission keys
   * @returns {boolean}
   */
  const hasAnyPermission = useCallback((permissionList) => {
    return permissionList.some(perm => permissions[perm] === true);
  }, [permissions]);

  return {
    role,
    permissions,
    loading,
    error,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isAdmin: role === USER_ROLES.ADMIN,
    isSuperUser: role === USER_ROLES.SUPER_USER,
    isRegularUser: role === USER_ROLES.USER,
    refetch: fetchUserPermissions
  };
}

/**
 * Simple hook to check if user is admin (for backward compatibility)
 * @param {Object} user - Firebase auth user object
 * @returns {Object} { isAdmin, loading }
 */
export function useIsAdmin(user) {
  const { isAdmin, loading } = useUserPermissions(user);
  return { isAdmin, loading };
}
