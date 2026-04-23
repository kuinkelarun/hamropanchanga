/**
 * Tree Sharing Utilities
 * Handle tree sharing logic and permissions
 */

/**
 * Permission levels for tree sharing
 */
export const SHARE_PERMISSIONS = {
  VIEW: 'view',
  EDIT: 'edit'
};

/**
 * Get permission description
 * @param {String} permission - Permission level
 * @returns {String} Human-readable description
 */
export const getPermissionDescription = (permission) => {
  switch (permission) {
    case SHARE_PERMISSIONS.VIEW:
      return 'View only - Can view tree, builder, and events but cannot edit';
    case SHARE_PERMISSIONS.EDIT:
      return 'Can edit - Can view and edit everything except delete/share';
    default:
      return 'Unknown permission';
  }
};

/**
 * Check if user has permission for action
 * @param {String} permission - User permission level
 * @param {String} action - Action to perform (view, edit, delete, share)
 * @returns {Boolean} True if permission allows
 */
export const hasPermission = (permission, action) => {
  const permissions = {
    [SHARE_PERMISSIONS.VIEW]: ['view'],
    [SHARE_PERMISSIONS.EDIT]: ['view', 'edit']
  };

  return (permissions[permission] || []).includes(action);
};

/**
 * Create share object
 * @param {String} recipientEmail - Email of recipient
 * @param {String} permission - Permission level
 * @param {String} ownerEmail - Email of tree owner
 * @returns {Object} Share object
 */
export const createShareObject = (recipientEmail, permission, ownerEmail) => {
  return {
    permission: permission || SHARE_PERMISSIONS.VIEW,
    sharedAt: new Date().toISOString(),
    sharedBy: ownerEmail
  };
};

/**
 * Format share info for display
 * @param {Object} shareData - Share object
 * @param {String} email - Email of shared user
 * @returns {Object} Formatted share info
 */
export const formatShareInfo = (shareData, email) => {
  return {
    email,
    permission: shareData.permission,
    permissionLabel: shareData.permission === SHARE_PERMISSIONS.VIEW ? '👁️ View' : '✏️ Edit',
    sharedAt: new Date(shareData.sharedAt).toLocaleDateString(),
    sharedBy: shareData.sharedBy
  };
};

/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean} True if valid
 */
export const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.toLowerCase());
};

/**
 * Get tree access type
 * @param {String} ownerId - ID of tree owner
 * @param {String} currentUserId - ID of current user
 * @param {Object} sharedWith - sharedWith object from tree
 * @returns {Object} Access info {type: 'owner'|'shared', permission: 'view'|'edit'|null, sharedBy: email|null}
 */
export const getTreeAccessType = (ownerId, currentUserId, currentUserEmail, sharedWith = {}) => {
  // User is the owner
  if (ownerId === currentUserId) {
    return {
      type: 'owner',
      permission: null,
      sharedBy: null,
      canEdit: true,
      canDelete: true,
      canShare: true
    };
  }

  // Check if shared with this user (emails are stored normalized in Firestore)
  const normalizedEmail = String(currentUserEmail || '').toLowerCase().trim();
  const shareData = normalizedEmail ? sharedWith[normalizedEmail] : null;
  if (shareData) {
    return {
      type: 'shared',
      permission: shareData.permission,
      sharedBy: shareData.sharedBy,
      canEdit: shareData.permission === SHARE_PERMISSIONS.EDIT,
      canDelete: false,
      canShare: false
    };
  }

  // No access
  return {
    type: 'none',
    permission: null,
    sharedBy: null,
    canEdit: false,
    canDelete: false,
    canShare: false
  };
};

/**
 * Get shared tree badge text
 * @param {String} ownerEmail - Email of tree owner
 * @returns {String} Badge text
 */
export const getSharedBadgeText = (ownerEmail) => {
  return `📤 Shared by ${ownerEmail}`;
};

/**
 * Filter trees by access type
 * @param {Array} trees - Array of tree objects with owner and sharedWith
 * @param {String} currentUserId - Current user ID
 * @param {String} currentUserEmail - Current user email
 * @param {String} filterType - 'my' | 'shared' | 'all'
 * @returns {Array} Filtered trees
 */
export const filterTreesByAccess = (trees, currentUserId, currentUserEmail, filterType = 'all') => {
  return trees.filter(tree => {
    const access = getTreeAccessType(tree.owner, currentUserId, currentUserEmail, tree.sharedWith);

    switch (filterType) {
      case 'my':
        return access.type === 'owner';
      case 'shared':
        return access.type === 'shared';
      case 'all':
      default:
        return access.type === 'owner' || access.type === 'shared';
    }
  });
};

/**
 * Sort trees with owned first, then shared
 * @param {Array} trees - Trees to sort
 * @param {String} currentUserId - Current user ID
 * @param {String} currentUserEmail - Current user email
 * @returns {Array} Sorted trees
 */
export const sortTreesByAccess = (trees, currentUserId, currentUserEmail) => {
  return trees.sort((a, b) => {
    const accessA = getTreeAccessType(a.owner, currentUserId, currentUserEmail, a.sharedWith);
    const accessB = getTreeAccessType(b.owner, currentUserId, currentUserEmail, b.sharedWith);

    // Owner trees first
    if (accessA.type === 'owner' && accessB.type !== 'owner') return -1;
    if (accessA.type !== 'owner' && accessB.type === 'owner') return 1;

    // Then by name
    return (a.name || '').localeCompare(b.name || '');
  });
};

const TreeSharingUtils = {
  SHARE_PERMISSIONS,
  getPermissionDescription,
  hasPermission,
  createShareObject,
  formatShareInfo,
  isValidEmail,
  getTreeAccessType,
  getSharedBadgeText,
  filterTreesByAccess,
  sortTreesByAccess
};

export default TreeSharingUtils;
