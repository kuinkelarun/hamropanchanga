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
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
  increment
} from 'firebase/firestore';
import { SHARE_PERMISSIONS } from '../utils/TreeSharingUtils';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';
import { convertBsToAd, getTithisForMonth, nepaliMonths, convertAdToBs } from '../utils/nepaliDateUtils';
import { getTithiIndexByName, getTithiLunarMonthName, getTithiYearFromAdDate } from '../utils/nepaliDateUtils';
import { normalizeForCompare } from '../utils/textNormalize';

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
 * English to Nepali tithi name mapping
 */
const englishToNepaliTithiMap = {
  'Pratipada': 'प्रतिपदा',
  'Dwitiya': 'द्वितीया',
  'Tritiya': 'तृतीया',
  'Chaturthi': 'चतुर्थी',
  'Panchami': 'पञ्चमी',
  'Shashthi': 'षष्ठी',
  'Saptami': 'सप्तमी',
  'Ashtami': 'अष्टमी',
  'Navami': 'नवमी',
  'Dashami': 'दशमी',
  'Ekadashi': 'एकादशी',
  'Dvadashi': 'द्वादशी',
  'Trayodashi': 'त्रयोदशी',
  'Chaturdashi': 'चतुर्दशी',
  'Purnima': 'पूर्णिमा',
  'Amavasya': 'औंसी'
};

/**
 * English to Nepali script month mapping
 * Maps English month names to Nepali script names as used in nepaliMonths array
 */
const englishToNepaliMonthMap = {
  // Standard names
  'Baishakh': 'वैशाख',
  'Jyeshtha': 'ज्येष्ठ',
  'Ashadh': 'आषाढ',
  'Shravan': 'श्रावण',
  'Bhadra': 'भाद्र',
  'Ashwin': 'आश्विन',
  'Kartik': 'कार्तिक',
  'Mangsir': 'मार्ग',
  'Poush': 'पौष',
  'Magh': 'माघ',
  'Phalgun': 'फाल्गुन',
  'Chaitra': 'चैत्र',
  
  // Common variations/aliases
  'Baisakh': 'वैशाख',
  'Baisak': 'वैशाख',
  'Baisekh': 'वैशाख',
  'Vaisakh': 'वैशाख',
  'Jyaistha': 'ज्येष्ठ',
  'Jestha': 'ज्येष्ठ',
  'Asadh': 'आषाढ',
  'Asarh': 'आषाढ',
  'Shravana': 'श्रावण',
  'Sravana': 'श्रावण',
  'Bhadau': 'भाद्र',
  'Bhado': 'भाद्र',
  'Asoj': 'आश्विन',
  'Aswini': 'आश्विन',
  'Kartick': 'कार्तिक',
  'Kartikk': 'कार्तिक',
  'Mansir': 'मार्ग',
  'Mangseer': 'मार्ग',
  'Paush': 'पौष',
  'Push': 'पौष',
  'Phalguna': 'फाल्गुन',
  'Margshirsha': 'मार्ग',
  'Margshir': 'मार्ग'
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
    const userDocRef = doc(db, 'users', userId);
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

    // Check for existing trees
    const existingTreesSnap = await getDocs(
      query(collection(db, 'trees'), where('owner', '==', userId))
    );
    const existingTreeNames = new Set(existingTreesSnap.docs.map(doc => doc.data().name));

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

        // Check if tree already exists
        if (existingTreeNames.has(treeName)) {
          results.failed.push({
            name: treeName,
            reason: 'Tree already exists',
            isDuplicate: true
          });
          results.stats.skipped++;
          continue;
        }

        // Create new tree
        const newTree = {
          title: treeName,
          primaryMemberName: primaryName,
          contact: contact,
          contactInfo: contact,
          location: location,
          owner: userId,
          ownerEmail: userEmail,
          ownerUid: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          memberCount: 0,
          eventCount: 0,
          isActive: true,
          deleted: false,
          sharedWith: {}
        };

        const docRef = await addDoc(collection(db, 'trees'), newTree);

        results.success.push({
          name: treeName,
          primaryMember: primaryName,
          treeId: docRef.id,
          created: true
        });
        results.stats.created++;
        existingTreeNames.add(treeName); // Add to set to prevent duplicates in same batch
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
      skipped: 0,
      errors: 0
    }
  };

  const batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_SIZE = 500;

  try {
    // Ensure user document exists before attempting to add members
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      throw new Error('User setup incomplete. Please refresh the page and try again.');
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

        const treeId = treeMap.get(treeName);
        if (!treeId) {
          results.failed.push({
            name: memberName,
            tree: treeName,
            reason: `Tree "${treeName}" not found`
          });
          results.stats.errors++;
          continue;
        }

        // Check if member already exists in this tree
        const existingMembers = await getDocs(
          query(
            collection(db, 'trees', treeId, 'members'),
            where('name', '==', memberName)
          )
        );

        if (existingMembers.size > 0) {
          results.failed.push({
            name: memberName,
            tree: treeName,
            reason: 'Member already exists in this tree',
            isDuplicate: true
          });
          results.stats.skipped++;
          continue;
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
        const newMember = {
          treeId,
          memberId,
          name: memberName,
          nickname: memberItem['Nickname']?.trim() || '',
          gender: genderValue,
          dob: dob || null,
          status: status.toLowerCase() === 'passed away' ? 'deceased' : 'alive',
          dod: dod || null,
          location: memberItem['Location']?.trim() || '',
          photo: memberItem['Photo URL']?.trim() || '',
          // notes removed from member payload per template simplification
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: userId
        };

        const memberRef = doc(collection(db, 'trees', treeId, 'members'));
        batch.set(memberRef, newMember);

        // Increment member count on tree
        const treeRef = doc(db, 'trees', treeId);
        batch.update(treeRef, {
          memberCount: increment(1),
          updatedAt: Timestamp.now()
        });

        results.success.push({
          name: memberName,
          tree: treeName,
          memberId,
          created: true
        });
        results.stats.created++;

        batchCount++;

        // Commit batch if reaches limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
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

    // Commit remaining batch
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`Final batch committed with ${batchCount} members`);
      } catch (commitErr) {
        console.error('Error committing final batch:', commitErr);
        throw new Error(`Failed to commit members: ${commitErr.message}`);
      }
    }

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
    const userDocRef = doc(db, 'users', userId);
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
      const parts = k.split(':');
      const t = parts[0] || '';
      const m = parts.slice(1).join(':') || '';
      const nk = `${normalizeForCompare(t)}:${normalizeForCompare(m)}`;
      normalizedMemberIdByKey.set(nk, v);
    }

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

        // Resolve memberId using direct, raw, and normalized lookups
        const memberKey = `${treeName}:${memberName}`;
        const memberKeyRaw = `${rawTreeName}:${rawMemberName}`;
        let memberId = memberMap.get(memberKey) || memberMap.get(memberKeyRaw);
        if (!memberId) {
          const normalizedKey = `${normalizeForCompare(treeName)}:${normalizeForCompare(memberName)}`;
          const normalizedKeyRaw = `${normalizeForCompare(rawTreeName)}:${normalizeForCompare(rawMemberName)}`;
          memberId = normalizedMemberIdByKey.get(normalizedKey) || normalizedMemberIdByKey.get(normalizedKeyRaw);
          if (memberId) console.log('[BulkUpload] Resolved memberId via normalized fallback for', { memberName, rawMemberName });
        }
        if (!memberId) {
          const normalizedKey = `${normalizeForCompare(treeName)}:${normalizeForCompare(memberName)}`;
          console.warn('[BulkUpload] Member lookup failed for:', { treeName, memberName, memberKey, normalizedKey, availableNormalizedMembers: Array.from(normalizedMemberIdByKey.keys()).slice(0,50) });
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
          createdBy: userId,
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
          const paksha = pakshaFromId === 'shukla' ? 'Shukla' : pakshaFromId === 'krishna' ? 'Krishna' : pakshaFromId;
          
          // Resolve tithi date matching the manual form logic
          // The manual form matches by: current BS year + selected month + paksha + tithi name
          try {
            const today = new Date();
            const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
            const currentBsYear = bsToday.year;
            const selectedMonthName = englishToNepaliMonthMap[tithiMonth.trim()] || tithiMonth;
            
            const pakshaNepali = paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';
            const fullName = `${pakshaNepali} ${tithiMapping.nepaliName}`;
            const q = query(collection(db, 'tithis'), where('name', '>=', fullName), where('name', '<=', fullName + '\uf8ff'));
            const snapshot = await getDocs(q);
            
            let matchingTithi = null;
            let actualTithiLunarMonth = null;
            
            snapshot.docs.forEach(doc => {
              const t = doc.data();
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
              console.warn(`[BulkUpload] Could not resolve concrete date for ${fullName} in year ${currentBsYear}. Event saved in tithi-only mode.`);
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
          
          // Delete dateKey if not set (tithi-only mode)
          if (!('dateKey' in eventPayload)) {
            delete eventPayload.dateKey;
          }
          
          // Minimal log indicating tithi event creation (do not log full payload)
          console.log('[BulkUpload] Creating tithi event:', { eventName, memberName, tithi: { month: eventPayload.tithi.month, paksha: eventPayload.tithi.paksha, name: eventPayload.tithi.name } });
        }

        // Create event in calendarEvents collection
        const eventRef = doc(collection(db, 'calendarEvents'));
        // Minimal safe log: avoid sensitive/full payload dumps in console
        console.log('[BulkUpload] Saving event:', { eventName, entryMode, repetition: eventPayload.repetition, hasTithi: 'tithi' in eventPayload });
        await setDoc(eventRef, eventPayload);

        // Read back the saved document to verify persisted fields (debugging)
        try {
          const savedSnap = await getDoc(eventRef);
          if (savedSnap.exists()) {
            // Log full saved document as string to ensure visibility in console
            try {
              const savedData = savedSnap.data();
              // Log only id and keys to avoid exposing full payload in console
              console.log('[BulkUpload] Saved event id:', savedSnap.id, 'fields:', Object.keys(savedData || {}));
              if (!savedData || !savedData.tithi) {
                console.warn('[BulkUpload] No tithi object found in saved event');
              }
            } catch (sErr) {
              console.log('[BulkUpload] Saved event readback failed to stringify keys:', sErr);
            }
          } else {
            console.warn('[BulkUpload] Saved event not found after write (unexpected)');
          }
        } catch (readErr) {
          console.error('[BulkUpload] Error reading back saved event:', readErr);
        }

        results.success.push({
          member: memberName,
          event: eventName,
          entryMode,
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
    const treeRef = doc(db, 'trees', treeId);
    const sharedWith = {};
    sharedWith[recipientEmail] = {
      permission: permission || SHARE_PERMISSIONS.VIEW,
      sharedAt: Timestamp.now(),
      sharedBy: ownerEmail
    };

    await updateDoc(treeRef, {
      [`sharedWith.${recipientEmail}`]: {
        permission: permission || SHARE_PERMISSIONS.VIEW,
        sharedAt: Timestamp.now(),
        sharedBy: ownerEmail
      }
    });

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
    const treeRef = doc(db, 'trees', treeId);

    await updateDoc(treeRef, {
      [`sharedWith.${recipientEmail}.permission`]: newPermission
    });

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
    const treeRef = doc(db, 'trees', treeId);

    // Use array-union to remove by setting to null, then filtering
    // Firebase doesn't support deleting nested fields directly, so we fetch and update
    const treeSnap = await getDocs(
      query(collection(db, 'trees'), where('__name__', '==', treeId))
    );

    if (treeSnap.empty) {
      throw new Error('Tree not found');
    }

    const treeData = treeSnap.docs[0].data();
    const updatedSharedWith = { ...treeData.sharedWith };
    delete updatedSharedWith[recipientEmail];

    await updateDoc(treeRef, {
      sharedWith: updatedSharedWith
    });

    return true;
  } catch (error) {
    console.error('Error removing share:', error);
    throw new Error(`Failed to remove share: ${error.message}`);
  }
};

/**
 * Get shared trees for a user
 * @param {String} userEmail - Email of user
 * @returns {Promise<Array>} Array of shared trees
 */
export const getSharedTreesForUser = async (userEmail) => {
  try {
    const treesSnap = await getDocs(
      query(collection(db, 'trees'), where(`sharedWith.${userEmail}`, '!=', null))
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
  getSharedTreesForUser
};
