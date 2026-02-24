/**
 * Firebase Backend Services for Bulk Upload and Tree Sharing
 * These functions handle database operations for:
 * - Bulk tree creation
 * - Bulk member addition
 * - Bulk event addition
 * - Tree sharing and permissions
 */

import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  FieldPath,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
  increment,
  deleteField,
  arrayUnion
} from 'firebase/firestore';
import { SHARE_PERMISSIONS } from '../utils/TreeSharingUtils';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';
import { convertBsToAd, getTithisForMonth, nepaliMonths, convertAdToBs } from '../utils/nepaliDateUtils';
import { getTithiIndexByName, getTithiLunarMonthName, getTithiYearFromAdDate } from '../utils/nepaliDateUtils';
import { normalizeForCompare } from '../utils/textNormalize';
import { ENGLISH_TO_NEPALI_TITHI_MAP, ENGLISH_TO_NEPALI_MONTH_MAP, normalizePakshaToEnglish, normalizePakshaToNepali } from '../constants/calendarConstants';

// Helper function to build structured member lookup keys
// Uses JSON to avoid delimiter conflicts when tree/member names contain colons or other special chars
function buildMemberKey(treeName, memberName) {
  return JSON.stringify({ 
    tree: normalizeForCompare(treeName), 
    member: normalizeForCompare(memberName) 
  });
}

// Normalize repetition strings (accept English and Nepali variants)
function normalizeRepetition(raw) {
  if (raw === null || raw === undefined) return 'none';
  const s = String(raw).trim();
  if (s === '') return 'none';

  // Normalize ASCII to lowercase and remove spaces
  const ascii = s.toLowerCase().replace(/\s+/g, '');
  const compact = s.replace(/\s+/g, ''); // for Nepali phrases keep original case

  const map = {
    // None / no repeat
    'none': 'none',
    'no': 'none',
    'nodat': 'none',
    'blank': 'none',
    'black': 'none', // tolerate typo
    // Nepali non-repeating variants
    'नदोहोरिने': 'none',
    'नदोहोरिन': 'none',
    'नदोहरिने': 'none',
    'न दोहोरिने': 'none',
    'न दोहरिने': 'none',

    // Monthly
    'monthly': 'monthly',
    'maasik': 'monthly',
    'masik': 'monthly',
    'मासिक': 'monthly',
    'मासीक': 'monthly',
    'मासीक ': 'monthly',

    // Yearly
    'yearly': 'yearly',
    'annual': 'yearly',
    'वार्षिक': 'yearly',
    'वार्षिकता': 'yearly',
    'बार्षिक': 'yearly',
    'बार्षिक': 'yearly',
    'बार्सिक': 'yearly'
  };

  if (map[ascii]) return map[ascii];
  if (map[compact]) return map[compact];

  // Fallback heuristics
  if (ascii.includes('month') || ascii.includes('mas') || ascii.includes('maas')) return 'monthly';
  if (ascii.includes('year') || ascii.includes('varsh') || ascii.includes('bar')) return 'yearly';
  if (compact.includes('न') && compact.includes('दोहोर')) return 'none';

  return 'none';
}

/**
 * English to Nepali tithi name mapping — imported from centralized constants
 */
const englishToNepaliTithiMap = ENGLISH_TO_NEPALI_TITHI_MAP;

/**
 * English to Nepali script month mapping — imported from centralized constants
 * Extended with additional aliases specific to bulk upload
 */
const englishToNepaliMonthMap = {
  ...ENGLISH_TO_NEPALI_MONTH_MAP,
  // Bulk-upload-specific aliases not in the shared constants
  'Shravana': 'श्रावण',
  'Sravana': 'श्रावण',
  'Bhado': 'भाद्र',
  'Aswini': 'आश्विन',
  'Kartick': 'कार्तिक',
  'Kartikk': 'कार्तिक',
  'Phalguna': 'फाल्गुन',
  'Margshirsha': 'मार्ग',
  'Margshir': 'मार्ग',
};

/**
 * Map English tithi name to the app's tithiId format
 * Intelligently finds the correct tithi based on month, pakshya, and tithi name
 * @param {String} englishTithiName - English tithi name (e.g., "Pratipada", "Amavasya")
 * @param {String} monthName - Tithi month name (e.g., "Kartik") - will be normalized
 * @param {String} pakshya - Lunar pakshya: "Shukla" or "Krishna"
 * @returns {Object|null} {tithiId: "shukla-...", nepaliName: "...", pakshya: "Shukla"}
 */
const mapTithiNameToId = (englishTithiName, monthName, pakshya) => {
  // Validate pakshya
  const validPakshya = ['Shukla', 'Krishna'];
  if (!pakshya || !validPakshya.includes(pakshya)) {
    console.warn(`Invalid pakshya "${pakshya}". Must be "Shukla" or "Krishna"`);
    return null;
  }

  // Accept Nepali-month input directly or convert English month name to Nepali script
  const rawMonth = monthName?.trim();
  let nepaliScriptMonth = null;
  if (!rawMonth) {
    console.warn(`Tithi month not provided`);
    return null;
  }
  if (nepaliMonths.includes(rawMonth)) {
    nepaliScriptMonth = rawMonth;
  } else {
    nepaliScriptMonth = englishToNepaliMonthMap[rawMonth];
  }
  if (!nepaliScriptMonth) {
    console.warn(`Tithi month "${monthName}" not recognized as English or Nepali month`);
    return null;
  }

  // Get the Nepali month number using Nepali script name
  const monthNum = nepaliMonths.indexOf(nepaliScriptMonth) + 1;
  if (monthNum === 0) {
    console.warn(`Nepali month "${nepaliScriptMonth}" not found in nepaliMonths array`);
    return null;
  }

  // Get available tithis for this month
  const availableTithis = getTithisForMonth(monthNum);

  // Determine Nepali tithi name: accept Nepali input or map English input
  const rawTithi = englishTithiName?.trim();
  if (!rawTithi) {
    console.warn('Tithi name not provided');
    return null;
  }
  let nepaliName = null;
  // If input contains Devanagari characters, treat it as Nepali name
    if (/[\u0900-\u097F]/.test(rawTithi)) {
    nepaliName = rawTithi;
  } else {
    nepaliName = englishToNepaliTithiMap[rawTithi];
  }
  if (!nepaliName) {
    console.warn(`Tithi "${englishTithiName}" not recognized`);
    return null;
  }

  // Filter tithis by pakshya
  const tithisInPakshya = availableTithis.filter(t => {
    // pakshya parameter uses "Shukla"/"Krishna", but tithiId uses "shukla-"/"krishna-"
    const pakshyaPrefix = pakshya.toLowerCase();
    return t.tithiId.startsWith(pakshyaPrefix + '-');
  });

  // Find matching tithi in the specified pakshya
  const matchingTithi = tithisInPakshya.find(t => t.name === nepaliName);
  if (!matchingTithi) {
    console.warn(`Tithi "${nepaliName}" not found in ${pakshya} pakshya of month "${monthName}"`);
    return null;
  }

  return { 
    tithiId: matchingTithi.tithiId, 
    nepaliName: matchingTithi.name,
    pakshya: pakshya
  };
};

/**
 * Create trees from bulk upload data
 * @param {Array} treeData - Array of tree objects with {Tree Name, Description}
 * @param {String} userId - ID of user creating trees
 * @param {String} userEmail - Email of user creating trees
 * @returns {Promise<Object>} {success: Array, failed: Array, results: Object}
 */
export const createTreesFromBulkUpload = async (treeData, userId, userEmail) => {
  const results = {
    success: [],
    failed: [],
    stats: {
      total: treeData.length,
      created: 0,
      skipped: 0,
      errors: 0
    }
  };

  try {
    // Ensure user document exists before attempting to create trees
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
    let userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      // Attempt to create a default user document
      console.log('User document not found. Attempting to create default user document.');
      try {
        await setDoc(userDocRef, {
          email: userEmail || '',
          displayName: '',
          role: USER_ROLES.USER,
          permissions: DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER],
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log('Default user document created successfully.');
        userDocSnap = await getDoc(userDocRef);
      } catch (createUserErr) {
        console.error('Failed to create user document:', createUserErr);
        throw new Error(`User setup incomplete. Please refresh the page and try again. Details: ${createUserErr.message}`);
      }
    }

    // Check for existing trees - build both exact and normalized name sets
    // Filter out soft-deleted trees so re-uploading after "Delete All" works
    const existingTreesSnap = await getDocs(
      query(collection(db, COLLECTIONS.TREES), where('ownerUid', '==', userId))
    );
    const activeDocs = existingTreesSnap.docs.filter(d => !d.data().deleted);
    const existingTreeNames = new Set(
      activeDocs.map(d => d.data().title || d.data().name)
    );
    const existingTreeNamesNormalized = new Set(
      activeDocs.map(d => 
        d.data().titleNormalized || d.data().nameNormalized || 
        normalizeForCompare(d.data().title || d.data().name || '')
      )
    );

    for (const treeItem of treeData) {
      try {
        const treeName = treeItem['Tree Name *']?.trim();
        const primaryName = treeItem['Primary Member Name *']?.trim();
        const contact = treeItem['Contact Information *']?.trim();
        const location = treeItem['Location *']?.trim();
        
        if (!treeName || !primaryName || !contact || !location) {
          results.failed.push({
            name: treeItem['Tree Name *'],
            reason: 'All fields (Tree Name, Primary Member Name, Contact, Location) are required'
          });
          results.stats.errors++;
          continue;
        }

        // Check if tree already exists (exact match or normalized match)
        const normalizedTreeName = normalizeForCompare(treeName);
        if (existingTreeNames.has(treeName) || 
            existingTreeNamesNormalized.has(normalizedTreeName)) {
          results.failed.push({
            name: treeName,
            reason: 'Tree already exists (or name too similar to existing tree)',
            isDuplicate: true
          });
          results.stats.skipped++;
          continue;
        }

        // Create new tree
        const newTree = {
          title: treeName,  // Primary field used by UI components
          titleNormalized: normalizeForCompare(treeName),
          name: treeName,   // Kept for backwards compatibility
          nameNormalized: normalizeForCompare(treeName),
          primaryMemberName: primaryName,
          primaryMemberNameNormalized: normalizeForCompare(primaryName || ''),
          contact: contact,
          location: location,
          contactNormalized: normalizeForCompare(contact || ''),
          locationNormalized: normalizeForCompare(location || ''),
          ownerUid: userId,  // Primary field for Firestore security rules
          owner: userId,     // Kept for backwards compatibility
          ownerEmail: userEmail,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          memberCount: 0,
          eventCount: 0,
          isActive: true,
          deleted: false,
          sharedWith: {}
        };

        const docRef = await addDoc(collection(db, COLLECTIONS.TREES), newTree);

        results.success.push({
          name: treeName,
          primaryMember: primaryName,
          treeId: docRef.id,
          created: true
        });
        results.stats.created++;
        existingTreeNames.add(treeName); // Add to set to prevent duplicates in same batch
        existingTreeNamesNormalized.add(normalizedTreeName); // Add normalized form too
      } catch (error) {
        console.error('Error creating individual tree:', {
          treeName: treeItem['Tree Name *'],
          errorMessage: error.message,
          errorCode: error.code,
          fullError: error
        });
        results.failed.push({
          name: treeItem['Tree Name'],
          reason: error.message || 'Unknown error occurred'
        });
        results.stats.errors++;
      }
    }

    return results;
  } catch (error) {
    console.error('Error in createTreesFromBulkUpload:', {
      errorMessage: error.message,
      errorCode: error.code,
      userId: userId,
      fullError: error
    });
    throw new Error(`Bulk tree creation failed: ${error.message}`);
  }
};

/**
 * Add family members from bulk upload
 * @param {Array} memberData - Array of member objects
 * @param {String} userId - ID of user adding members
 * @param {Map} treeMap - Map of tree names to tree IDs
 * @returns {Promise<Object>} Results object
 */
export const addFamilyMembersFromBulkUpload = async (memberData, userId, treeMap) => {
  const results = {
    success: [],
    failed: [],
    stats: {
      total: memberData.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    }
  };

  let batch = writeBatch(db);
  // Firestore limits: max 500 operations per batch. Each member add here uses
  // 2 operations (set member doc + update tree doc). Track operations, not rows.
  const MAX_BATCH_OPS = 500;
  const OPS_PER_MEMBER = 2;
  let currentBatchOps = 0;

  // Commit helper: commits once, then always creates a fresh batch.
  // Firestore v9 SDK invalidates a batch after commit() (success or failure),
  // so retrying commit() on the same batch object is not possible.
  const commitBatch = async (label = '') => {
    if (currentBatchOps === 0) return;
    try {
      await batch.commit();
      console.log(`Committed member batch (ops=${currentBatchOps})${label ? ' ' + label : ''}`);
    } catch (err) {
      console.error(`Member batch commit failed${label ? ' ' + label : ''}:`, err.message || err);
      throw err;
    } finally {
      // Always create a fresh batch regardless of success/failure
      batch = writeBatch(db);
      currentBatchOps = 0;
    }
  };

  try {
    // Ensure user document exists before attempting to add members
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      throw new Error('User setup incomplete. Please refresh the page and try again.');
    }

    // Build normalized lookup for tree names -> ids (tolerate minor variations)
    const normalizedTreeIdByName = new Map();
    for (const [k, v] of treeMap.entries()) {
      normalizedTreeIdByName.set(normalizeForCompare(k), v);
    }

    // Prefetch existing members for all referenced trees to avoid per-row queries
    const referencedTreeIds = new Set();
    for (const row of memberData) {
      const treeNameRaw = (row['Tree Name *'] || row['Tree Name'] || '').trim();
      if (!treeNameRaw) continue;
      const resolved = treeMap.get(treeNameRaw) || normalizedTreeIdByName.get(normalizeForCompare(treeNameRaw));
      if (resolved) referencedTreeIds.add(resolved);
    }

    const existingMembersByTree = new Map(); // treeId -> Map(normalized member name -> { id, notes })
    for (const tId of referencedTreeIds) {
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.TREES, tId, COLLECTIONS.MEMBERS));
        const map = new Map();
        snap.docs.forEach(d => {
          const name = (d.data()?.name || '').toString();
          if (name) map.set(normalizeForCompare(name), { id: d.id, notes: d.data()?.notes || '' });
        });
        existingMembersByTree.set(tId, map);
      } catch (err) {
        // If fetching members fails, continue; we'll fall back to per-row query
        console.warn('Failed to prefetch members for tree', tId, err.message);
      }
    }

    // Prefetch tree owner UIDs for referenced trees so admin uploads can be recorded as owner-created
    const treeOwnerById = new Map();
    for (const tId of referencedTreeIds) {
      try {
        const treeDoc = await getDoc(doc(db, COLLECTIONS.TREES, tId));
        if (treeDoc.exists()) {
          const td = treeDoc.data() || {};
          const ownerUid = td.ownerUid || td.owner || null;
          treeOwnerById.set(tId, ownerUid);
        }
      } catch (err) {
        console.warn('Failed to fetch tree doc for owner lookup', tId, err.message || err);
      }
    }

    for (const memberItem of memberData) {
      try {
        const treeName = memberItem['Tree Name *']?.trim();
        const memberName = memberItem['Member Name *']?.trim();

        if (!treeName || !memberName) {
          results.failed.push({
            name: memberName,
            tree: treeName,
            reason: 'Tree Name and Member Name are required'
          });
          results.stats.errors++;
          continue;
        }

        // Resolve treeId using exact match first, then normalized lookup to tolerate formatting
        const treeId = treeMap.get(treeName) || normalizedTreeIdByName.get(normalizeForCompare(treeName));
        if (!treeId) {
          results.failed.push({
            name: memberName,
            tree: treeName,
            reason: `Tree "${treeName}" not found`
          });
          results.stats.errors++;
          continue;
        }

        // Check if member already exists in this tree using prefetched map (normalized)
        const normalizedMemberName = normalizeForCompare(memberName);
        const existingMap = existingMembersByTree.get(treeId);
        if (existingMap && existingMap.has(normalizedMemberName)) {
          // Member exists: if Notes column provided, update notes; otherwise skip
          const existing = existingMap.get(normalizedMemberName);
          const notesValue = (memberItem['Notes'] || memberItem['Note'] || '').toString().trim();

          if (notesValue) {
            // Ensure batch has room for single update
            if (currentBatchOps + 1 > MAX_BATCH_OPS) {
              await commitBatch('before member-update');
            }

            const memberDocRef = doc(db, COLLECTIONS.TREES, treeId, COLLECTIONS.MEMBERS, existing.id);
            batch.update(memberDocRef, { notes: notesValue, updatedAt: Timestamp.now() });
            results.success.push({ name: memberName, tree: treeName, memberId: existing.id, updated: true });
            results.stats.updated++;
            // count as skipped for creation as well
            results.stats.skipped++;
            currentBatchOps += 1;

            // Update cached value so subsequent rows see updated notes
            existingMap.set(normalizedMemberName, { id: existing.id, notes: notesValue });
            continue;
          } else {
            results.failed.push({
              name: memberName,
              tree: treeName,
              reason: 'Member already exists in this tree',
              isDuplicate: true
            });
            results.stats.skipped++;
            continue;
          }
        } else if (!existingMap) {
          // Fallback to direct query if prefetch wasn't available
          const existingMembers = await getDocs(
            query(
              collection(db, COLLECTIONS.TREES, treeId, COLLECTIONS.MEMBERS),
              where('name', '==', memberName)
            )
          );
          if (existingMembers.size > 0) {
            const d = existingMembers.docs[0];
            const existingId = d.id;
            const notesValue = (memberItem['Notes'] || memberItem['Note'] || '').toString().trim();
            if (notesValue) {
              if (currentBatchOps + 1 > MAX_BATCH_OPS) {
                await commitBatch('before fallback member-update');
              }

              const memberDocRef = doc(db, COLLECTIONS.TREES, treeId, COLLECTIONS.MEMBERS, existingId);
              batch.update(memberDocRef, { notes: notesValue, updatedAt: Timestamp.now() });
              results.success.push({ name: memberName, tree: treeName, memberId: existingId, updated: true });
              results.stats.updated++;
              currentBatchOps += 1;
              continue;
            } else {
              results.failed.push({
                name: memberName,
                tree: treeName,
                reason: 'Member already exists in this tree',
                isDuplicate: true
              });
              results.stats.skipped++;
              continue;
            }
          }
        }

        // Generate member ID
        const memberId = `MEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Build DOB from separate parts if provided
        let dob = null;
        const dobYear = memberItem['DOB Year']?.trim();
        const dobMonth = memberItem['DOB Month']?.trim();
        const dobDay = memberItem['DOB Day']?.trim();
        if (dobYear && dobMonth && dobDay) {
          dob = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
        }

        // Build DOD from separate parts if provided
        let dod = null;
        const dodYear = memberItem['DOD Year']?.trim();
        const dodMonth = memberItem['DOD Month']?.trim();
        const dodDay = memberItem['DOD Day']?.trim();
        if (dodYear && dodMonth && dodDay) {
          dod = `${dodYear}-${String(dodMonth).padStart(2, '0')}-${String(dodDay).padStart(2, '0')}`;
        }

        // Determine status
        const status = memberItem['Status']?.trim() || 'alive';
        
        // Normalize gender value (handle various formats)
        let genderValue = memberItem['Gender']?.trim().toLowerCase() || 'unknown';
        // Map common variations to standard values
        const genderMap = {
          'male': 'male',
          'm': 'male',
          'boy': 'male',
          'female': 'female',
          'f': 'female',
          'girl': 'female',
          'non-binary': 'non-binary',
          'non binary': 'non-binary',
          'other': 'non-binary',
          'prefer not to say': 'prefer not to say',
          'prefer not to': 'prefer not to say',
          'undisclosed': 'unknown'
        };
        genderValue = genderMap[genderValue] || genderValue;
        if (!['male', 'female', 'non-binary', 'prefer not to say', 'unknown'].includes(genderValue)) {
          genderValue = 'unknown';
        }

        // Create member document with ALL fields from MemberModal
        const ownerForThisTree = treeOwnerById.get(treeId) || null;
        const newMember = {
          treeId,
          memberId,
          name: memberName,
          nameNormalized: normalizeForCompare(memberName || ''),
          nickname: memberItem['Nickname']?.trim() || '',
          notes: (memberItem['Notes'] || memberItem['Note'] || '').toString().trim(),
          gender: genderValue,
          dob: dob || null,
          status: status.toLowerCase() === 'passed away' ? 'deceased' : 'alive',
          dod: dod || null,
          location: memberItem['Location']?.trim() || '',
          photo: memberItem['Photo URL']?.trim() || '',
          // notes removed from member payload per template simplification
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          // If admin is uploading on behalf of owner, record createdBy as ownerUid so owner sees records as their own
          createdBy: ownerForThisTree || userId
        };

        // If adding this member would exceed Firestore's per-batch operation
        // limit, commit the current batch first and start a fresh one.
        if (currentBatchOps + OPS_PER_MEMBER > MAX_BATCH_OPS) {
          await commitBatch();
        }

        const memberRef = doc(collection(db, COLLECTIONS.TREES, treeId, COLLECTIONS.MEMBERS));
        batch.set(memberRef, newMember);

        // Increment member count on tree (use set+merge so it works even if tree
        // doc was deleted between validation and commit)
        const treeRef = doc(db, COLLECTIONS.TREES, treeId);
        batch.set(treeRef, {
          memberCount: increment(1),
          updatedAt: Timestamp.now()
        }, { merge: true });

        results.success.push({
          name: memberName,
          tree: treeName,
          memberId,
          created: true
        });
        results.stats.created++;

        // Add to prefetched map so subsequent rows in the same upload don't duplicate.
        // Use memberRef.id (actual Firestore doc ID) — NOT the custom memberId field
        // — so that any later batch.update() targets the correct document path.
        if (!existingMembersByTree.has(treeId)) existingMembersByTree.set(treeId, new Map());
        existingMembersByTree.get(treeId).set(normalizeForCompare(memberName), { id: memberRef.id, notes: '' });

        // Track ops consumed by this member (set + update)
        currentBatchOps += OPS_PER_MEMBER;
      } catch (error) {
        console.error('Error creating individual member:', {
          memberName: memberItem['Member Name *'],
          treeName: memberItem['Tree Name *'],
          errorMessage: error.message,
          errorCode: error.code
        });
        results.failed.push({
          name: memberItem['Member Name *'],
          tree: memberItem['Tree Name *'],
          reason: error.message || 'Unknown error occurred'
        });
        results.stats.errors++;
      }
    }

    // Commit remaining batch (if any)
    await commitBatch('(final)');

    console.log('Member creation completed:', results.stats);
    return results;
  } catch (error) {
    console.error('Error in addFamilyMembersFromBulkUpload:', {
      errorMessage: error.message,
      errorCode: error.code,
      fullError: error
    });
    throw new Error(`Bulk member addition failed: ${error.message}`);
  }
};

/**
 * Add events from bulk upload
 * @param {Array} eventData - Array of event objects
 * @param {String} userId - ID of user adding events
 * @param {Map} treeMap - Map of tree names to tree IDs
 * @param {Map} memberMap - Map of tree+member names to member IDs
 * @returns {Promise<Object>} Results object
 */
export const addEventsFromBulkUpload = async (eventData, userId, treeMap, memberMap) => {
  const results = {
    success: [],
    failed: [],
    stats: {
      total: eventData.length,
      created: 0,
      updated: 0,
      errors: 0
    }
  };

  try {
    // Ensure user document exists before attempting to add events
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      throw new Error('User setup incomplete. Please refresh the page and try again.');
    }

    // Build normalized lookup maps to tolerate Preeti/Unicode/English variants
    const normalizedTreeIdByName = new Map();
    for (const [k, v] of treeMap.entries()) {
      normalizedTreeIdByName.set(normalizeForCompare(k), v);
    }

    const normalizedMemberIdByKey = new Map();
    for (const [k, v] of memberMap.entries()) {
      try {
        // Try to parse as JSON structured key (new format)
        const parsed = JSON.parse(k);
        // Keys are already normalized, so just use as-is
        normalizedMemberIdByKey.set(k, v);
      } catch (e) {
        // Fallback for old-style colon-delimited keys (backwards compatibility)
        const parts = k.split('|||');
        if (parts.length >= 2) {
          const t = parts[0];
          const m = parts.slice(1).join('|||');
          const structured = buildMemberKey(t, m);
          normalizedMemberIdByKey.set(structured, v);
        } else {
          // Try single colon split as last resort
          const colonParts = k.split(':');
          if (colonParts.length >= 2) {
            const t = colonParts[0];
            const m = colonParts.slice(1).join(':');
            const structured = buildMemberKey(t, m);
            normalizedMemberIdByKey.set(structured, v);
          }
        }
      }
    }

    // Prefetch tree owner UIDs for all trees referenced in the provided treeMap
    const treeOwnerById = new Map();
    try {
      const treeIds = new Set(Array.from(treeMap.values()));
      for (const tId of treeIds) {
        try {
          const treeDoc = await getDoc(doc(db, COLLECTIONS.TREES, tId));
          if (treeDoc.exists()) {
            const td = treeDoc.data() || {};
            const ownerUid = td.ownerUid || td.owner || null;
            treeOwnerById.set(tId, ownerUid);
          }
        } catch (e) {
          console.warn('[BulkUpload] Failed to prefetch tree owner for', tId, e?.message || e);
        }
      }
    } catch (e) {
      console.warn('[BulkUpload] Error building tree owner cache', e?.message || e);
    }

    // Prefetch existing events for referenced tree/member pairs to avoid per-row queries
    const existingEventsByTreeMember = new Map(); // key: `${treeId}:${memberId}` -> Map(eventKey -> { id, data })
    try {
      const referenced = new Map(); // treeId -> Set(memberId)
      for (const ev of eventData) {
        const treeName = (ev['Tree Name *'] || ev['Tree Name'] || '').toString().trim();
        const memberName = (ev['Member Name *'] || ev['Member Name'] || '').toString().trim();
        if (!treeName || !memberName) continue;

        let treeId = treeMap.get(treeName) || treeMap.get((ev['Tree Name *'] || ev['Tree Name'] || '').toString().trim());
        if (!treeId) treeId = normalizedTreeIdByName.get(normalizeForCompare(treeName)) || normalizedTreeIdByName.get(normalizeForCompare((ev['Tree Name *'] || ev['Tree Name'] || '').toString().trim()));
        if (!treeId) continue;

        let memberId = memberMap.get(`${treeName}:${memberName}`) || memberMap.get(`${(ev['Tree Name *'] || ev['Tree Name'] || '').toString().trim()}:${(ev['Member Name *'] || ev['Member Name'] || '').toString().trim()}`);
        if (!memberId) {
          const nk = `${normalizeForCompare(treeName)}:${normalizeForCompare(memberName)}`;
          memberId = normalizedMemberIdByKey.get(nk);
        }
        if (!memberId) continue;

        if (!referenced.has(treeId)) referenced.set(treeId, new Set());
        referenced.get(treeId).add(memberId);
      }

      // For each tree, fetch events for memberId chunks (Firestore 'in' supports up to 10)
      const CHUNK_SIZE = 10;
      for (const [tId, memberSet] of referenced.entries()) {
        const memberArr = Array.from(memberSet);
        for (let i = 0; i < memberArr.length; i += CHUNK_SIZE) {
          const chunk = memberArr.slice(i, i + CHUNK_SIZE);
          try {
            const q = query(collection(db, COLLECTIONS.CALENDAR_EVENTS), where('treeId', '==', tId), where('memberId', 'in', chunk));
            const snap = await getDocs(q);
            snap.docs.forEach(d => {
              const data = d.data() || {};
              const keyBase = `${tId}:${data.memberId}`;
              if (!existingEventsByTreeMember.has(keyBase)) existingEventsByTreeMember.set(keyBase, new Map());
              const titleNorm = normalizeForCompare(data.titleNormalized || data.title || '');
              const dateKey = data.dateKey || '';
              const tithiId = data.tithi?.id || '';
              const tithiMonth = data.tithi?.month || '';
              const eKey = `${titleNorm}::${dateKey}::${tithiId}::${tithiMonth}`;
              existingEventsByTreeMember.get(keyBase).set(eKey, { id: d.id, data });
            });
          } catch (e) {
            console.warn('[BulkUpload] Failed to prefetch events for tree', tId, 'chunk', e?.message || e);
          }
        }
      }
    } catch (e) {
      console.warn('[BulkUpload] Error building event prefetch cache', e?.message || e);
    }

    // Prepare batching for events to support large uploads (1k+ rows)
    let batch = writeBatch(db);
    const MAX_BATCH_OPS = 500; // Firestore limit
    const OPS_PER_EVENT = 1; // single set per event
    let currentBatchOps = 0;

    // Commit helper: commits once, then always creates a fresh batch.
    // Firestore v9 SDK invalidates a batch after commit() (success or failure),
    // so retrying commit() on the same batch object is not possible.
    const commitBatch = async () => {
      if (currentBatchOps === 0) return;
      try {
        await batch.commit();
        console.log(`[BulkUpload] Committed event batch (ops=${currentBatchOps})`);
      } catch (err) {
        console.error('[BulkUpload] Event batch commit failed:', err.message || err);
        throw err;
      } finally {
        batch = writeBatch(db);
        currentBatchOps = 0;
      }
    };

    // Cache for tithi query results to avoid repeated DB queries for same tithi
    const tithiQueryCache = new Map();

    for (const eventItem of eventData) {
      try {
        // Expect Unicode-only input; use raw row values
        const rowData = { ...eventItem };

        const treeName = (rowData['Tree Name *'] || '').trim();
        const memberName = (rowData['Member Name *'] || '').trim();
        const rawTreeName = (eventItem['Tree Name *'] || eventItem['Tree Name'] || '').trim();
        const rawMemberName = (eventItem['Member Name *'] || eventItem['Member Name'] || '').trim();
        // Prefer the raw user-entered event name (avoid automatic conversion that may produce garbage)
        const eventName = (eventItem['Event Name *'] || eventItem['Event Name'] || rowData['Event Name *'] || '').trim();
        const description = (eventItem['Description'] || eventItem['Event Description'] || rowData['Description'] || rowData['Event Description'] || '').trim();

        // Normalize entry mode (accept Nepali variants)
        const entryModeRaw = (rowData['Entry Mode'] || eventItem['Entry Mode'] || '').toString().trim();
        const normalizeEntryMode = (raw) => {
          if (!raw) return 'date';
          const s = String(raw || '').trim();
          const compact = s.replace(/\s+/g, '').toLowerCase();
          if (['date','miti','मिति','मितिअनुसार','मितिअनुसार'].includes(compact)) return 'date';
          if (['tithi','तिथि','तिथिअनुसार','तिथि अनुसार'].includes(compact)) return 'tithi';
          if (/miti|date/.test(compact)) return 'date';
          if (/tith|tithi/.test(compact)) return 'tithi';
          return 'date';
        };
        const entryMode = normalizeEntryMode(entryModeRaw);

        // Normalize repeats to canonical values ('none','monthly','yearly')
        const rawRepeats = (rowData['Repeats'] || eventItem['Repeats'] || '').toString().trim();
        const repeats = normalizeRepetition(rawRepeats);
        // Notes removed from event handling; description is used instead

        if (!treeName || !memberName || !eventName) {
          results.failed.push({
            member: memberName,
            event: eventName,
            reason: 'Tree Name, Member Name, and Event Name are required'
          });
          results.stats.errors++;
          continue;
        }

        // Validate entry mode
        if (entryMode !== 'date' && entryMode !== 'tithi') {
          results.failed.push({
            member: memberName,
            event: eventName,
            reason: 'Entry Mode must be "date" or "tithi"'
          });
          results.stats.errors++;
          continue;
        }

        // Resolve treeId using direct, raw, and normalized lookups
        let treeId = treeMap.get(treeName) || treeMap.get(rawTreeName);
        if (!treeId) {
          treeId = normalizedTreeIdByName.get(normalizeForCompare(treeName)) || normalizedTreeIdByName.get(normalizeForCompare(rawTreeName));
          if (treeId) console.log('[BulkUpload] Resolved treeId via normalized fallback for', { treeName, rawTreeName });
        }
        if (!treeId) {
          console.warn('[BulkUpload] Tree lookup failed for:', { treeName, normalized: normalizeForCompare(treeName), availableNormalizedTrees: Array.from(normalizedTreeIdByName.keys()) });
          results.failed.push({
            member: memberName,
            event: eventName,
            reason: `Tree "${treeName}" not found`
          });
          results.stats.errors++;
          continue;
        }

        // Resolve memberId using structured keys
        const memberKey = buildMemberKey(treeName, memberName);
        const memberKeyRaw = buildMemberKey(rawTreeName, rawMemberName);
        let memberId = memberMap.get(memberKey) || memberMap.get(memberKeyRaw);
        if (!memberId) {
          // Try normalized lookup (should be the same as memberKey since buildMemberKey normalizes)
          memberId = normalizedMemberIdByKey.get(memberKey) || normalizedMemberIdByKey.get(memberKeyRaw);
          if (memberId) console.log('[BulkUpload] Resolved memberId via normalized fallback for', { memberName, rawMemberName });
        }
        if (!memberId) {
          console.warn('[BulkUpload] Member lookup failed for:', { 
            treeName, 
            memberName, 
            attemptedKey: memberKey,
            normalizedTreeName: normalizeForCompare(treeName),
            normalizedMemberName: normalizeForCompare(memberName),
            availableKeys: Array.from(normalizedMemberIdByKey.keys()).slice(0, 10),
            hexDump: {
              treeNameHex: Array.from(treeName).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' '),
              memberNameHex: Array.from(memberName).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ')
            }
          });
          results.failed.push({
            member: memberName,
            event: eventName,
            reason: `Member "${memberName}" not found in tree "${treeName}"`
          });
          results.stats.errors++;
          continue;
        }

        // Build event object based on entry mode
        // Preserve raw user-entered title/description (Unicode only expected)
        const titleRaw = (eventItem['Event Name *'] || eventItem['Event Name'] || eventName || '').trim();
        const descriptionRaw = (eventItem['Description'] || eventItem['Event Description'] || description || '').trim();
        const finalTitle = titleRaw;
        const finalDescription = descriptionRaw;

        const ownerForThisTree = treeOwnerById.get(treeId) || null;

        let eventPayload = {
          treeId,
          memberId,
          // Use finalTitle (converted if reasonable, otherwise raw)
          title: finalTitle,
          titleRaw: titleRaw,
          titleNormalized: normalizeForCompare(finalTitle),
          description: finalDescription,
          descriptionRaw: descriptionRaw,
          descriptionNormalized: normalizeForCompare(finalDescription),
          repetition: repeats,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          // Record createdBy as tree owner when available so admin uploads appear as owner-created
          createdBy: ownerForThisTree || userId,
          isPublic: false
        };

        if (entryMode === 'date') {
          // Parse Nepali date and convert to Gregorian
          const year = eventItem['Event Year (Nepali)']?.trim();
          const month = eventItem['Event Month (Nepali)']?.trim();
          const day = eventItem['Event Day (Nepali)']?.trim();

          if (!year || !month || !day) {
            results.failed.push({
              member: memberName,
              event: eventName,
              reason: 'Date mode requires Event Year (Nepali), Event Month (Nepali), and Event Day (Nepali)'
            });
            results.stats.errors++;
            continue;
          }

          const yearNum = parseInt(year, 10);
          const monthNum = parseInt(month, 10);
          const dayNum = parseInt(day, 10);

          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            results.failed.push({
              member: memberName,
              event: eventName,
              reason: 'Date values must be valid numbers'
            });
            results.stats.errors++;
            continue;
          }

          // Convert Nepali (BS) date to Gregorian (AD) date
          try {
            const adDate = convertBsToAd(yearNum, monthNum, dayNum);
            const adYear = adDate.year;
            // convertBsToAd returns 0-indexed month (0-11), so add 1 for dateKey format
            const adMonth = String(adDate.month + 1).padStart(2, '0');
            const adDay = String(adDate.day).padStart(2, '0');
            const dateKey = `${adYear}-${adMonth}-${adDay}`;
            
            eventPayload.dateKey = dateKey;
            eventPayload.entryMode = 'date';
            eventPayload.date = dateKey;
          } catch (err) {
            results.failed.push({
              member: memberName,
              event: eventName,
              reason: `Failed to convert Nepali date to Gregorian: ${err.message}`
            });
            results.stats.errors++;
            continue;
          }
        } else {
          // Parse Tithi
          let tithiMonth = eventItem['Tithi Month (Lunar)']?.trim();
          let tithiPakshya = eventItem['Tithi Pakshya']?.trim();
          let tithiName = eventItem['Tithi Name']?.trim();

          if (!tithiMonth || !tithiPakshya || !tithiName) {
            results.failed.push({
              member: memberName,
              event: eventName,
              reason: 'Tithi mode requires Tithi Month (Lunar), Tithi Pakshya, and Tithi Name'
            });
            results.stats.errors++;
            continue;
          }

          // Intelligently map English tithi name to app's tithiId format (now with pakshya)
          const tithiMapping = mapTithiNameToId(tithiName, tithiMonth, tithiPakshya);
          
          if (!tithiMapping) {
            console.error('Tithi mapping failed:', {
              tithiName,
              tithiMonth,
              englishToNepaliTithiMap,
              englishToNepaliMonthMap
            });
            results.failed.push({
              member: memberName,
              event: eventName,
              reason: `Could not map tithi "${tithiName}" for month "${tithiMonth}". Please ensure values match available options.`
            });
            results.stats.errors++;
            continue;
          }

          // Store tithi with proper structure matching app expectations
          // month should be Nepali script (e.g., 'कार्तिक') as used in nepaliMonths array
          // Extract paksha from tithiId (e.g., "shukla-प्रतिपदा" → "Shukla")
          const pakshaFromId = tithiMapping.tithiId.split('-')[0];
          const paksha = normalizePakshaToEnglish(pakshaFromId);
          
          // Resolve tithi date matching the manual form logic
          // The manual form matches by: current BS year + selected month + paksha + tithi name
          try {
            const today = new Date();
            const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
            const currentBsYear = bsToday.year;
            const selectedMonthName = englishToNepaliMonthMap[tithiMonth.trim()] || tithiMonth;
            
            const pakshaNepali = normalizePakshaToNepali(paksha);
            const cacheKey = `${pakshaNepali}::${tithiMapping.nepaliName}::${currentBsYear}`;
            let snapshotDocs = tithiQueryCache.get(cacheKey);
            if (!snapshotDocs) {
              // Query both new fields and legacy name prefix — merge results
              const qNew = query(collection(db, COLLECTIONS.TITHIS), where('pakshya', '==', pakshaNepali), where('tithiName', '==', tithiMapping.nepaliName));
              const old2PartName = `${pakshaNepali} ${tithiMapping.nepaliName}`;
              const qOld = query(collection(db, COLLECTIONS.TITHIS), where('name', '>=', old2PartName), where('name', '<=', old2PartName + '\uf8ff'));
              const [snapNew, snapOld] = await Promise.all([getDocs(qNew), getDocs(qOld)]);
              
              // Merge by doc ID
              const merged = new Map();
              snapNew.docs.forEach(d => merged.set(d.id, d));
              snapOld.docs.forEach(d => { if (!merged.has(d.id)) merged.set(d.id, d); });
              snapshotDocs = Array.from(merged.values());
              tithiQueryCache.set(cacheKey, snapshotDocs);
            }

            let matchingTithi = null;
            let actualTithiLunarMonth = null;

            snapshotDocs.forEach(docSnap => {
              const t = docSnap.data ? docSnap.data() : docSnap;
              if (!t.name.includes(tithiMapping.nepaliName) || !t.name.includes(pakshaNepali)) return;

              const tithiIndex = getTithiIndexByName(tithiMapping.nepaliName, { fallbackToOne: false });
              if (!tithiIndex) return;

              const lunarMonthName = getTithiLunarMonthName(paksha, tithiIndex, t.startDate);
              const tithiYearInfo = getTithiYearFromAdDate(t.startDate, null, paksha, tithiIndex);

              // Match by: lunar month name + BS year
              if (lunarMonthName === selectedMonthName && tithiYearInfo.tithiYear === currentBsYear) {
                matchingTithi = t;
                actualTithiLunarMonth = lunarMonthName;
              }
            });
            
            if (matchingTithi && actualTithiLunarMonth) {
              eventPayload.dateKey = matchingTithi.startDate;
              eventPayload.date = matchingTithi.startDate;
              
              eventPayload.tithi = {
                month: actualTithiLunarMonth,
                id: tithiMapping.tithiId,  // Include the tithiId for consistency with manual form
                name: tithiMapping.nepaliName,
                paksha: paksha
              };
            } else {
              // Fallback: if no matching tithi found for current year, don't set dateKey
              // The event will be saved without a specific date (tithi-only mode)
              eventPayload.tithi = {
                month: selectedMonthName,
                id: tithiMapping.tithiId,
                name: tithiMapping.nepaliName,
                paksha: paksha
              };
              console.warn(`[BulkUpload] Could not resolve concrete date for ${pakshaNepali} ${tithiMapping.nepaliName} in year ${currentBsYear}. Event saved in tithi-only mode.`);
            }
          } catch (tErr) {
            console.error('[BulkUpload] Error while resolving tithi date:', tErr);
            // Save with tithi info but no concrete date
            eventPayload.tithi = {
              month: englishToNepaliMonthMap[tithiMonth.trim()] || tithiMonth,
              id: tithiMapping.tithiId,
              name: tithiMapping.nepaliName,
              paksha: paksha
            };
          }
          
          eventPayload.entryMode = 'tithi';
          
          // Set empty dateKey sentinel if not resolved (tithi-only mode).
          // This ensures the field always exists on the Firestore document so
          // it is never silently excluded by orderBy('dateKey') queries.
          if (!('dateKey' in eventPayload)) {
            eventPayload.dateKey = '';
          }
          
          // Minimal log indicating tithi event creation (do not log full payload)
          console.log('[BulkUpload] Creating tithi event:', { eventName, memberName, tithi: { month: eventPayload.tithi.month, paksha: eventPayload.tithi.paksha, name: eventPayload.tithi.name } });
        }

        // Attempt to find an existing matching event using prefetched cache (same treeId, memberId, titleNormalized)
        try {
          const pairKey = `${treeId}:${memberId}`;
          const titleKey = normalizeForCompare(eventPayload.titleNormalized || '');
          const dateKey = eventPayload.dateKey || '';
          const tithiId = eventPayload.tithi?.id || '';
          const tithiMonth = eventPayload.tithi?.month || '';
          const lookupKey = `${titleKey}::${dateKey}::${tithiId}::${tithiMonth}`;

          const mapForPair = existingEventsByTreeMember.get(pairKey);
          if (mapForPair && mapForPair.has(lookupKey)) {
            const evEntry = mapForPair.get(lookupKey);
            const existingId = evEntry.id;
            const descValue = (finalDescription || '').trim();
            if (descValue) {
              if (currentBatchOps + 1 > MAX_BATCH_OPS) {
                await commitBatch();
              }
              const existingRef = doc(db, COLLECTIONS.CALENDAR_EVENTS, existingId);
              batch.update(existingRef, {
                description: descValue,
                descriptionRaw: descriptionRaw,
                descriptionNormalized: normalizeForCompare(descValue),
                updatedAt: Timestamp.now()
              });
              currentBatchOps += 1;
              results.success.push({ member: memberName, event: eventName, eventId: existingId, updated: true });
              results.stats.updated = (results.stats.updated || 0) + 1;
              continue;
            }
            results.failed.push({ member: memberName, event: eventName, reason: 'Event already exists' });
            results.stats.errors++;
            continue;
          }
        } catch (cacheErr) {
          console.warn('[BulkUpload] Event cache lookup failed:', cacheErr?.message || cacheErr);
          // fall through and create new event
        }

        // Prepare event write via batch (avoid immediate setDoc for bulk)
        // Commit current batch first if this event would exceed batch op limits
        if (currentBatchOps + OPS_PER_EVENT > MAX_BATCH_OPS) {
          await commitBatch();
        }

        const eventRef = doc(collection(db, COLLECTIONS.CALENDAR_EVENTS));
        batch.set(eventRef, eventPayload);
        currentBatchOps += OPS_PER_EVENT;

        // Record success (event will be created on commit)
        results.success.push({
          member: memberName,
          event: eventName,
          entryMode,
          eventId: eventRef.id,
          created: true
        });
        results.stats.created++;
      } catch (error) {
        console.error('Error creating individual event:', {
          memberName: eventItem['Member Name *'],
          eventName: eventItem['Event Name *'],
          errorMessage: error.message,
          errorCode: error.code
        });
        results.failed.push({
          member: eventItem['Member Name *'],
          event: eventItem['Event Name *'],
          reason: error.message || 'Unknown error occurred'
        });
        results.stats.errors++;
      }
    }

    // Commit any remaining event writes
    try {
      await commitBatch();
    } catch (err) {
      console.error('[BulkUpload] Error committing final event batch:', err);
      throw err;
    }

    console.log('Event creation completed:', results.stats);
    return results;
  } catch (error) {
    console.error('Error in addEventsFromBulkUpload:', {
      errorMessage: error.message,
      errorCode: error.code,
      errorMessage: error.message,
      errorCode: error.code,
      fullError: error
    });
    throw new Error(`Bulk event addition failed: ${error.message}`);
  }
};

/**
 * Share tree with another user
 * @param {String} treeId - ID of tree to share
 * @param {String} recipientEmail - Email of recipient
 * @param {String} permission - Permission level (view or edit)
 * @param {String} ownerEmail - Email of tree owner
 * @returns {Promise<Boolean>} True if successful
 */
export const shareTreeWithUser = async (treeId, recipientEmail, permission, ownerEmail) => {
  try {
    const treeRef = doc(db, COLLECTIONS.TREES, treeId);

    const normalizedEmail = (recipientEmail || '').toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Recipient email is required');
    }

    // IMPORTANT: use FieldPath so emails containing '.' are treated as a single map key segment.
    await updateDoc(
      treeRef,
      new FieldPath('sharedWith', normalizedEmail),
      {
        permission: permission || SHARE_PERMISSIONS.VIEW,
        sharedAt: Timestamp.now(),
        sharedBy: ownerEmail
      },
      'sharedWithEmails',
      arrayUnion(normalizedEmail)
    );

    return true;
  } catch (error) {
    console.error('Error sharing tree:', error);
    throw new Error(`Failed to share tree: ${error.message}`);
  }
};

/**
 * Update tree share permission
 * @param {String} treeId - ID of tree
 * @param {String} recipientEmail - Email of recipient
 * @param {String} newPermission - New permission level
 * @returns {Promise<Boolean>} True if successful
 */
export const updateSharePermission = async (treeId, recipientEmail, newPermission) => {
  try {
    const treeRef = doc(db, COLLECTIONS.TREES, treeId);

    const normalizedEmail = (recipientEmail || '').toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Recipient email is required');
    }

    await updateDoc(
      treeRef,
      new FieldPath('sharedWith', normalizedEmail, 'permission'),
      newPermission
    );

    return true;
  } catch (error) {
    console.error('Error updating share permission:', error);
    throw new Error(`Failed to update permission: ${error.message}`);
  }
};

/**
 * Remove tree share with user
 * @param {String} treeId - ID of tree
 * @param {String} recipientEmail - Email of recipient
 * @returns {Promise<Boolean>} True if successful
 */
export const removeTreeShare = async (treeId, recipientEmail) => {
  try {
    const treeRef = doc(db, COLLECTIONS.TREES, treeId);
    const normalizedEmail = (recipientEmail || '').toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Recipient email is required');
    }

    // Get current tree to update sharedWithEmails array
    const treeSnap = await getDoc(treeRef);
    if (!treeSnap.exists()) {
      throw new Error('Tree not found');
    }

    const treeData = treeSnap.data() || {};

    // Remove email from array (case-insensitive) to clean up any legacy mixed-case entries.
    const currentSharedEmails = Array.isArray(treeData.sharedWithEmails) ? treeData.sharedWithEmails : [];
    const updatedEmails = currentSharedEmails
      .filter((email) => String(email || '').toLowerCase().trim() !== normalizedEmail)
      .map((email) => String(email || '').toLowerCase().trim())
      .filter(Boolean);

    // Remove from sharedWith map (case-insensitive) while handling '.' in email via FieldPath.
    const sharedWith = treeData.sharedWith && typeof treeData.sharedWith === 'object' ? treeData.sharedWith : {};
    const keysToDelete = Object.keys(sharedWith)
      .filter((key) => String(key || '').toLowerCase().trim() === normalizedEmail);

    const updateArgs = [];
    for (const key of keysToDelete) {
      updateArgs.push(new FieldPath('sharedWith', key), deleteField());
    }

    // Always attempt to delete the normalized key as well (safe even if it doesn't exist).
    updateArgs.push(new FieldPath('sharedWith', normalizedEmail), deleteField());
    updateArgs.push('sharedWithEmails', Array.from(new Set(updatedEmails)));

    await updateDoc(treeRef, ...updateArgs);

    return true;
  } catch (error) {
    console.error('Error removing share:', error);
    throw new Error(`Failed to remove share: ${error.message}`);
  }
};

/**
 * Share multiple trees with a user
 * @param {Array<String>} treeIds - Array of tree IDs to share
 * @param {String} recipientEmail - Email of recipient
 * @param {String} permission - Permission level ('view' or 'edit')
 * @param {String} ownerEmail - Email of user sharing the trees
 * @returns {Promise<Object>} Results {success: number, failed: Array}
 */
export const shareBulkTreesWithUser = async (treeIds, recipientEmail, permission, ownerEmail) => {
  const results = {
    success: 0,
    failed: [],
    errors: []
  };

  try {
    for (const treeId of treeIds) {
      try {
        await shareTreeWithUser(treeId, recipientEmail, permission, ownerEmail);
        results.success++;
      } catch (error) {
        results.failed.push(treeId);
        results.errors.push({ treeId, error: error.message });
      }
    }
    return results;
  } catch (error) {
    console.error('Error in bulk share:', error);
    throw new Error(`Bulk sharing failed: ${error.message}`);
  }
};

/**
 * Get shared trees for a user
 * @param {String} userEmail - Email of user
 * @returns {Promise<Array>} Array of shared trees
 */
export const getSharedTreesForUser = async (userEmail) => {
  try {
    const normalizedEmail = (userEmail || '').toLowerCase().trim();
    if (!normalizedEmail) return [];

    const treesSnap = await getDocs(
      query(collection(db, COLLECTIONS.TREES), where('sharedWithEmails', 'array-contains', normalizedEmail))
    );

    return treesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching shared trees:', error);
    return [];
  }
};

export default {
  createTreesFromBulkUpload,
  addFamilyMembersFromBulkUpload,
  addEventsFromBulkUpload,
  shareTreeWithUser,
  updateSharePermission,
  removeTreeShare,
  shareBulkTreesWithUser,
  getSharedTreesForUser
};
