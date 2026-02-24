/**
 * firestoreCollections.js
 *
 * Single source of truth for all Firestore collection and subcollection names.
 * Import from here instead of using raw string literals to prevent typos
 * and make future renames easy.
 */

export const COLLECTIONS = Object.freeze({
  // Top-level collections
  TREES: 'trees',
  TITHIS: 'tithis',
  CALENDAR_EVENTS: 'calendarEvents',
  NEPALI_CALENDAR_YEARS: 'nepaliCalendarYears',
  USERS: 'users',
  ADMIN_LIST: 'adminList',
  USER_INVITATIONS: 'userInvitations',
  CUSTOMERS: 'customers',

  // Subcollections (under a tree document)
  MEMBERS: 'members',
  RELATIONSHIPS: 'relationships',
  MARRIAGE_POINTS: 'marriagePoints',
});
