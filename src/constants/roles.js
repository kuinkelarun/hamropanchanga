// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  SUPER_USER: 'superuser',
  USER: 'user'
};

// Permission Keys - granular permissions that can be toggled per user
export const PERMISSIONS = {
  // Admin-only permissions (not assignable to super users)
  MANAGE_USERS: 'manageUsers',
  VIEW_ALL_CUSTOMERS: 'viewAllCustomers',
  
  // Permissions that can be assigned to super users
  MANAGE_HOME_CARDS: 'manageHomeCards',
  BULK_UPLOAD: 'bulkUpload',
  MANAGE_TITHIS: 'manageTithis',
  MANAGE_EVENTS: 'manageEvents',
  MANUAL_DASHBOARD: 'manualDashboard',
  
  // User-level permissions (everyone gets these)
  MANAGE_OWN_CUSTOMERS: 'manageOwnCustomers',
  VIEW_OWN_CUSTOMERS: 'viewOwnCustomers'
};

// Default permissions by role
export const DEFAULT_ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: {
    [PERMISSIONS.MANAGE_USERS]: true,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: true,
    [PERMISSIONS.MANAGE_HOME_CARDS]: true,
    [PERMISSIONS.BULK_UPLOAD]: true,
    [PERMISSIONS.MANAGE_TITHIS]: true,
    [PERMISSIONS.MANAGE_EVENTS]: true,
    [PERMISSIONS.MANUAL_DASHBOARD]: true,
    [PERMISSIONS.MANAGE_OWN_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_OWN_CUSTOMERS]: true
  },
  [USER_ROLES.SUPER_USER]: {
    [PERMISSIONS.MANAGE_USERS]: false, // Super users cannot manage other users
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: false, // Cannot see other users' customers
    [PERMISSIONS.MANAGE_HOME_CARDS]: false, // Configurable by admin
    [PERMISSIONS.BULK_UPLOAD]: false, // Configurable by admin
    [PERMISSIONS.MANAGE_TITHIS]: false, // Configurable by admin
    [PERMISSIONS.MANAGE_EVENTS]: false, // Configurable by admin
    [PERMISSIONS.MANUAL_DASHBOARD]: false, // Configurable by admin
    [PERMISSIONS.MANAGE_OWN_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_OWN_CUSTOMERS]: true
  },
  [USER_ROLES.USER]: {
    [PERMISSIONS.MANAGE_USERS]: false,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: false,
    [PERMISSIONS.MANAGE_HOME_CARDS]: false,
    [PERMISSIONS.BULK_UPLOAD]: false,
    [PERMISSIONS.MANAGE_TITHIS]: false,
    [PERMISSIONS.MANAGE_EVENTS]: false,
    [PERMISSIONS.MANUAL_DASHBOARD]: false,
    [PERMISSIONS.MANAGE_OWN_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_OWN_CUSTOMERS]: true
  }
};

// Permissions that can be configured for super users
export const CONFIGURABLE_SUPERUSER_PERMISSIONS = [
  PERMISSIONS.MANAGE_HOME_CARDS,
  PERMISSIONS.BULK_UPLOAD,
  PERMISSIONS.MANAGE_TITHIS,
  PERMISSIONS.MANAGE_EVENTS,
  PERMISSIONS.MANUAL_DASHBOARD
];

// Permission labels for UI display
export const PERMISSION_LABELS = {
  [PERMISSIONS.MANAGE_USERS]: 'Manage Users',
  [PERMISSIONS.VIEW_ALL_CUSTOMERS]: 'View All Users\' Customers',
  [PERMISSIONS.MANAGE_HOME_CARDS]: 'Manage Home Page Cards',
  [PERMISSIONS.BULK_UPLOAD]: 'Bulk Upload Management',
  [PERMISSIONS.MANAGE_TITHIS]: 'Manage Tithis',
  [PERMISSIONS.MANAGE_EVENTS]: 'Manage Events',
  [PERMISSIONS.MANUAL_DASHBOARD]: 'Manual Management Dashboard',
  [PERMISSIONS.MANAGE_OWN_CUSTOMERS]: 'Manage Own Customers',
  [PERMISSIONS.VIEW_OWN_CUSTOMERS]: 'View Own Customers'
};

// Role labels for UI display
export const ROLE_LABELS = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.SUPER_USER]: 'Super User',
  [USER_ROLES.USER]: 'Regular User'
};
