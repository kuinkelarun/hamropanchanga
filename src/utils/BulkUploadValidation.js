// Clean BulkUploadValidation - no template literals
import { getTithisForMonth } from './nepaliDateUtils';
import { normalizeForCompare } from './textNormalize';
import { Members } from '../components/TreeBuilder/utils/firestoreTreeApi';
// Simple pakshya canonicalization (accepts Nepali/English variants)
const canonicalizePakshya = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s.includes('shuk') || s.includes('शुक') || s.includes('suk')) return 'Shukla';
  if (s.includes('krish') || s.includes('कृष्ण') || s.includes('krishna')) return 'Krishna';
  // Accept short forms
  if (s === 'shukla' || s === 'shuk') return 'Shukla';
  if (s === 'krishna' || s === 'krish' || s === 'kr') return 'Krishna';
  return null;
}

class ValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
  }
  addError(message, rowIndex = null) {
    this.errors.push({ type: 'error', message, rowIndex });
    this.isValid = false;
  }
  addWarning(message, rowIndex = null) {
    this.warnings.push({ type: 'warning', message, rowIndex });
  }
}

const englishMonths = ['Baishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Phalgun', 'Chaitra'];
const nepaliScriptMonths = ['वैशाख', 'ज्येष्ठ', 'आषाढ', 'श्रावण', 'भाद्र', 'आश्विन', 'कार्तिक', 'मार्ग', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'];
const englishToNepaliTithiMap = { Pratipada: 'प्रतिपदा', Dwitiya: 'द्वितीया', Tritiya: 'तृतीया', Chaturthi: 'चतुर्थी', Panchami: 'पञ्चमी', Shashthi: 'षष्ठी', Saptami: 'सप्तमी', Ashtami: 'अष्टमी', Navami: 'नवमी', Dashami: 'दशमी', Ekadashi: 'एकादशी', Dvadashi: 'द्वादशी', Trayodashi: 'त्रयोदशी', Chaturdashi: 'चतुर्दशी', Purnima: 'पूर्णिमा', Amavasya: 'औंसी' };
const tithiNames = Object.keys(englishToNepaliTithiMap);

export const validateTreeData = (data = [], existingTrees = []) => {
  const result = new ValidationResult();
  if (!Array.isArray(data) || data.length === 0) { 
    result.addError('No data provided'); 
    return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: 0, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
  }
  const seen = new Set();

  data.forEach((row, i) => {
    const r = i + 2;
    const name = String(row['Tree Name *'] || '').trim();
    if (!name) result.addError('Tree Name is required', r);
    else {
      if (seen.has(name)) result.addWarning('Duplicate tree name: ' + name, r);
      seen.add(name);
      if (existingTrees.includes(name)) result.addWarning('Tree ' + name + ' already exists. It will be skipped.', r);
      if (name.length > 255) result.addError('Tree Name exceeds 255 characters', r);
    }
  });
  return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: data.length, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
};

export const validateMemberData = (data = [], existingTrees = [], existingMembers = {}) => {
  const result = new ValidationResult();
  if (!Array.isArray(data) || data.length === 0) { 
    result.addError('No data provided'); 
    return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: 0, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
  }
  const seen = new Set();
  data.forEach((row, i) => {
    const r = i + 2;
    const tree = String(row['Tree Name *'] || '').trim();
    const member = String(row['Member Name *'] || '').trim();
    if (!tree) result.addError('Tree Name is required', r);
    if (!member) result.addError('Member Name is required', r);
    const key = tree + '||' + member;
    if (seen.has(key)) result.addWarning('Duplicate member: ' + member + ' for tree ' + tree, r);
    seen.add(key);
  });
  return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: data.length, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
};

export const validateEventData = async (data = [], existingTrees = [], existingMembers = {}, treeNameToId = {}) => {
  const result = new ValidationResult();
  if (!Array.isArray(data) || data.length === 0) { 
    result.addError('No data provided'); 
    return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: 0, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
  }
  const seen = new Set();

  // Precompute normalized map of existing trees to their original names for reliable lookup
  const existingTreeMap = {};
  (existingTrees || []).forEach(t => {
    existingTreeMap[normalizeForCompare(t)] = t;
  });

  // Build normalized map of existingMembers keyed by normalized tree name to avoid key-mismatch issues
  const existingMembersNormalized = {};
  Object.keys(existingMembers || {}).forEach(k => {
    try {
      const nk = normalizeForCompare(k);
      existingMembersNormalized[nk] = existingMembers[k] || [];
    } catch (e) {
      // ignore
    }
  });

  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const r = idx + 2;
    // Expect Unicode input only; use raw row values
    const rowData = { ...row };

    const treeRaw = String(row['Tree Name *'] || '').trim();
    const tree = String(rowData['Tree Name *'] || '').trim();
    const member = String(rowData['Member Name *'] || '').trim();
    const eventName = String(rowData['Event Name *'] || '').trim();

    // Prefer raw (unconverted) value for error messages so we don't show conversion garbage
    const displayTree = treeRaw || tree;

    // Try matching uploaded tree to existing trees using normalized forms.
    const normalizedRaw = normalizeForCompare(treeRaw);
    const normalizedConverted = normalizeForCompare(tree);
    const matchedExistingName = existingTreeMap[normalizedRaw] || existingTreeMap[normalizedConverted] || null;

    if (!tree && !treeRaw) result.addError('Tree Name is required', r);
    else if (!matchedExistingName) result.addWarning('Tree ' + displayTree + ' does not exist', r);

    // Member validation: try normalized match to handle Preeti/Unicode/English variants
    let matchedMemberName = null;
    if (!member) result.addError('Member Name is required', r);
    else if (matchedExistingName) {
      const members = existingMembers[matchedExistingName] || existingMembersNormalized[normalizeForCompare(matchedExistingName)] || [];
      // Build normalized map of existing members for this tree
      const membersNormalizedMap = {};
      members.forEach(m => { membersNormalizedMap[normalizeForCompare(m)] = m; });

      const memberRaw = String(row['Member Name *'] || '').trim();
      const normalizedMemberRaw = normalizeForCompare(memberRaw);
      const normalizedMemberConverted = normalizeForCompare(member);

      matchedMemberName = membersNormalizedMap[normalizedMemberRaw] || membersNormalizedMap[normalizedMemberConverted] || null;

      // Fallback: try substring/contains matching in normalized forms (helps when uploaded name omits surname)
      if (!matchedMemberName) {
        const keys = Object.keys(membersNormalizedMap || {});
        const foundKey = keys.find(k => (normalizedMemberRaw && k.includes(normalizedMemberRaw)) || (normalizedMemberRaw && normalizedMemberRaw.includes(k)));
        if (foundKey) {
          matchedMemberName = membersNormalizedMap[foundKey];
          result.addWarning(`Approximated member match for ${memberRaw} -> ${matchedMemberName} in tree ${displayTree}`, r);
        }
      }

      if (!matchedMemberName) {
        // Attempt an on-demand fetch from the DB for the expected tree and try to match live data.
        let didLiveMatch = false;
        try {
          if (treeNameToId) {
            const tid = treeNameToId[matchedExistingName] || treeNameToId[existingTreeMap[normalizeForCompare(matchedExistingName)]];
            if (tid) {
              const fetched = await Members.list(tid);
              const fetchedNames = (fetched || []).map(m => (m.name || '').toString().trim()).filter(Boolean);
              // build normalized map from fetched members
              const liveMap = {};
              fetchedNames.forEach(n => { liveMap[normalizeForCompare(n)] = n; });

              const candidate = liveMap[normalizedMemberRaw] || liveMap[normalizedMemberConverted] || null;
              if (!candidate) {
                const fk = Object.keys(liveMap || {});
                const foundKey = fk.find(k => (normalizedMemberRaw && k.includes(normalizedMemberRaw)) || (normalizedMemberRaw && normalizedMemberRaw.includes(k)));
                if (foundKey) {
                  matchedMemberName = liveMap[foundKey];
                  result.addWarning(`Matched member by live lookup for ${memberRaw} -> ${matchedMemberName} in tree ${displayTree}`, r);
                  didLiveMatch = true;
                }
              } else {
                matchedMemberName = candidate;
                result.addWarning(`Matched member by live lookup for ${memberRaw} -> ${matchedMemberName} in tree ${displayTree}`, r);
                didLiveMatch = true;
              }
            }
          }
        } catch (fetchErr) {
          // ignore fetch error for validation diagnostics
        }

        if (!didLiveMatch) {
          // Prepare diagnostic info: normalized forms tried and available normalized members for this tree
          const normalizedTried = [normalizedMemberRaw, normalizedMemberConverted].filter(Boolean).join(', ');
          let availableNormalized = Object.keys(membersNormalizedMap).slice(0,50).join(', ');
          const diag = `Member ${String(row['Member Name *'] || member)} not found in tree ${displayTree} (tried: ${normalizedTried}). Available (normalized, sample): ${availableNormalized}`;
          result.addError(diag, r);
        }
      }
    }
    if (!eventName) result.addError('Event Name is required', r);
    // Accept Nepali variants for Entry Mode (e.g., 'मिति', 'तिथि', 'मिति अनुसार', 'तिथि अनुसार') and Preeti
    const entryModeRaw = String(rowData['Entry Mode'] || '').trim();
    const normalizeEntryMode = (raw) => {
      if (!raw) return '';
      const s = raw.trim();
      const compact = s.replace(/\s+/g, '').toLowerCase();
      if (['date', 'bydate', 'miti', 'मिति', 'मितिअनुसार', 'मितिअनुसार'.replace(/\s+/g,'')].includes(compact)) return 'date';
      if (['tithi', 'bytithi', 'tithiaccording', 'तिथि', 'तिथि अनुसार', 'तिथिअनुसार'].includes(compact)) return 'tithi';
      // Nepali common words
      if (compact === 'मिति' || compact === 'मितिअनुसार' || compact === 'मिति अनुसार') return 'date';
      if (compact === 'तिथि' || compact === 'तिथि अनुसार' || compact === 'तिथिअनुसार') return 'tithi';
      // Basic ascii heuristics
      if (/miti|mriti|date/.test(compact)) return 'date';
      if (/tith|tithi/.test(compact)) return 'tithi';
      return '';
    };

    const entryMode = normalizeEntryMode(entryModeRaw);
    if (!entryMode || (entryMode !== 'date' && entryMode !== 'tithi')) {
      result.addError('Entry Mode is required and must be date or tithi', r);
    }

    if (entryMode === 'date') {
      const year = String(rowData['Event Year (Nepali)'] || '').trim();
      const month = String(rowData['Event Month (Nepali)'] || '').trim();
      const day = String(rowData['Event Day (Nepali)'] || '').trim();
      if (!year || !month || !day) result.addError('Date mode requires Year, Month, Day', r);
    } else if (entryMode === 'tithi') {
      const tithiMonthRaw = String(rowData['Tithi Month (Lunar)'] || '').trim();
      const tithiPakshya = String(rowData['Tithi Pakshya'] || '').trim();
      const tithiNameRaw = String(rowData['Tithi Name'] || '').trim();
      if (!tithiMonthRaw || !tithiPakshya || !tithiNameRaw) {
        result.addError('Tithi mode requires Month, Pakshya, and Name', r);
      } else {
        // Normalize month to Nepali script
        let nepaliMonth = null;
        if (nepaliScriptMonths.includes(tithiMonthRaw)) nepaliMonth = tithiMonthRaw;
        else {
          const idxM = englishMonths.findIndex(m => m.toLowerCase() === tithiMonthRaw.toLowerCase());
          if (idxM !== -1) nepaliMonth = nepaliScriptMonths[idxM];
        }
        if (!nepaliMonth) result.addError('Tithi Month must be valid', r);
        
        // Canonicalize pakshya to 'Shukla' or 'Krishna'
        const canonicalized = canonicalizePakshya(tithiPakshya);
        if (!canonicalized) {
          result.addError('Tithi Pakshya must be Shukla or Krishna', r);
        } else {
          // Use the canonicalized value for further processing
          row['Tithi Pakshya'] = canonicalized;
        }

        const isAscii = /^[\x00-\x7F]*$/.test(tithiNameRaw);
        const nepaliTithiName = isAscii ? (englishToNepaliTithiMap[tithiNameRaw] || tithiNameRaw) : tithiNameRaw;
        if (isAscii && !englishToNepaliTithiMap[tithiNameRaw] && !tithiNames.includes(tithiNameRaw)) {
          result.addError('Tithi Name must be valid', r);
        }

        // Check paksha membership using nepaliDateUtils
        if (nepaliMonth) {
          try {
            const monthNum = nepaliScriptMonths.indexOf(nepaliMonth) + 1;
            const tithis = getTithisForMonth(monthNum);
            const pakshaNepali = tithiPakshya === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';
            const pakshaTithis = tithis.filter(t => t.pakshya === pakshaNepali);
            const match = pakshaTithis.some(t => t.name === nepaliTithiName);
            if (!match) {
              result.addError('Tithi ' + tithiNameRaw + ' does not exist in ' + tithiPakshya + ' pakshya of month ' + tithiMonthRaw, r);
            }
          } catch (err) {
            result.addWarning('Could not fully validate tithi combination: ' + err.message, r);
          }
        }
      }
    }

    // Accept Nepali and variant repetition strings
    const rawRepeats = (rowData['Repeats'] || row['Repeats'] || '').toString().trim();
    const normalizeRepeats = (raw) => {
      if (!raw) return 'none';
      const s = raw.trim();
      const compact = s.replace(/\s+/g, '').toLowerCase();
      const map = {
        'none': 'none', 'no': 'none', 'blank': 'none', 'black': 'none',
        // Nepali non-repeating
        'नदोहोरिने': 'none', 'नदोहरिने': 'none', 'न दोहोरिने': 'none',
        // Monthly
        'monthly': 'monthly', 'maasik': 'monthly', 'masik': 'monthly', 'मासिक': 'monthly', 'मासीक': 'monthly',
        // Yearly
        'yearly': 'yearly', 'annual': 'yearly', 'वार्षिक': 'yearly', 'बार्षिक': 'yearly', 'बार्सिक': 'yearly'
      };
      if (map[compact]) return map[compact];
      if (/month|mas|maas/.test(compact)) return 'monthly';
      if (/year|वार|बार|bar/.test(compact)) return 'yearly';
      if (/न.*दोहोर/.test(s)) return 'none';
      return compact; // leave as-is for default error path
    };

    const repeats = normalizeRepeats(rawRepeats);
    if (repeats && !['none', 'monthly', 'yearly'].includes(repeats)) {
      result.addError('Repeats must be none, monthly, or yearly', r);
    }

    const keyTree = matchedExistingName || displayTree || tree;
    const keyMember = matchedMemberName || member || String(row['Member Name *'] || '').trim();
    const eventKey = keyTree + '||' + keyMember + '||' + eventName + '||' + String(rowData['Event Date (YYYY-MM-DD)'] || row['Event Date (YYYY-MM-DD)'] || '');
    if (seen.has(eventKey)) result.addWarning('Duplicate event detected', r);
    seen.add(eventKey);
  }

  return { isValid: result.isValid, errors: result.errors, warnings: result.warnings, summary: { totalRows: data.length, errorsCount: result.errors.length, warningsCount: result.warnings.length } };
};

export const isValidDate = (dateValue) => {
  if (!dateValue) return false;
  if (typeof dateValue === 'string') {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(dateValue)) {
      const date = new Date(dateValue);
      return !isNaN(date.getTime());
    }
  }
  if (typeof dateValue === 'number') return dateValue > 0 && dateValue < 60000;
  return false;
};

export const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const isValidPhone = (phone) => {
  const cleaned = String(phone || '').replace(/[\s\-\+\(\)]/g, '');
  return /^\d{7,15}$/.test(cleaned);
};

export const isValidDateParts = (year, month, day) => {
  const y = String(year).trim(); 
  const m = String(month).trim(); 
  const d = String(day).trim();
  if (!/^\d+$/.test(y) || !/^\d+$/.test(m) || !/^\d+$/.test(d)) return false;
  const yN = parseInt(y, 10); 
  const mN = parseInt(m, 10); 
  const dN = parseInt(d, 10);
  if (yN < 1900 || yN > 2100) return false; 
  if (mN < 1 || mN > 12) return false; 
  if (dN < 1 || dN > 31) return false;
  const dateStr = y.padStart(4, '0') + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
  const date = new Date(dateStr); 
  return !isNaN(date.getTime());
};

export default { validateTreeData, validateMemberData, validateEventData, isValidDate, isValidDateParts, isValidEmail, isValidPhone, ValidationResult };
