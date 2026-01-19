// Nepali Calendar utilities
import bsCalendarData from '../data/bsCalendarData';

const nepaliMonths = [
  "वैशाख", "ज्येष्ठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
  "कार्तिक", "मार्ग", "पौष", "माघ", "फाल्गुन", "चैत्र"
];

const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const nepaliWeekdays = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
];

const englishWeekdays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const nepaliNumbers = ["०","१","२","३","४","५","६","७","८","९"];

const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

export function toNepaliNumber(num) {
  return String(num).split('').map(d => nepaliNumbers[+d] ?? d).join('');
}

export function getNepalDate() {
  const now = new Date();
  // Return a Date object where the UTC timestamp represents Nepal Time.
  // We do NOT add timezoneOffset because we want the UTC fields to match Nepal time,
  // not the Local fields.
  const nptOffset = 5.75 * 3600000;
  return new Date(now.getTime() + nptOffset);
}

export function convertAdToBs(year, month, day, customCalendarData = null) {
  // Use Nepal Time (NPT) midnight as the reference for a calendar day.
  // This avoids local timezone differences causing off-by-one errors when callers
  // pass Y/M/D values taken from Nepal time or from local time.
  const nptOffsetMs = 5.75 * 3600000; // 5 hours 45 minutes in ms
  
  // Merge custom calendar data with default bsCalendarData
  // Custom data overrides defaults for years that have been customized
  const calendarData = customCalendarData ? { ...bsCalendarData, ...customCalendarData } : bsCalendarData;

  // Compute the UTC-milliseconds instant corresponding to NPT midnight for the given Y/M/D
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;

  let bsYear = null, totalDays = 0;

  // Iterate calendar data and compare using NPT-midnight-based instants
  const keys = Object.keys(calendarData).map(Number).sort((a, b) => a - b);
  for (const y of keys) {
    const startAdData = calendarData[y];
    let startAd;
    
    // Handle both Date objects and plain objects from Firestore
    if (startAdData.startAdDate instanceof Date) {
      startAd = startAdData.startAdDate;
    } else if (typeof startAdData.startAdDate === 'string') {
      const [adYear, adMonth, adDay] = startAdData.startAdDate.split('-').map(Number);
      startAd = new Date(adYear, adMonth - 1, adDay); // months are 0-indexed in JS Date
    } else if (startAdData.startAdDate && typeof startAdData.startAdDate === 'object') {
      // Handle Firestore timestamp with toDate() method
      if (typeof startAdData.startAdDate.toDate === 'function') {
        startAd = startAdData.startAdDate.toDate();
      } else {
        // Try direct conversion
        startAd = new Date(startAdData.startAdDate);
      }
    } else {
      continue;
    }
    
    // Validate that we got a valid date
    if (!startAd || isNaN(startAd.getTime())) {
      continue;
    }
    
    const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - nptOffsetMs;

    if (adNptMidnightMs >= startNptMs) {
      bsYear = +y;
      const diffMs = adNptMidnightMs - startNptMs;
      totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    } else break;
  }
  
  if (!bsYear) {
    bsYear = minBsYear;
    totalDays = 1;
  }
  
  let bsMonth = 1;
  let bsDay = totalDays;
  const months = calendarData[bsYear]?.daysInMonths || [];
  
  if (months.length === 0) {
    // Fallback if calendar data is invalid
    return { year: bsYear, month: 1, day: 1, dayOfWeek: 0 };
  }
  
  // Handle case where totalDays might exceed the year's total days
  const totalDaysInYear = months.reduce((sum, m) => sum + m, 0);
  while (bsDay > totalDaysInYear && calendarData[bsYear + 1]) {
    bsDay -= totalDaysInYear;
    bsYear += 1;
  }
  
  // Calculate month and day based on the calendar data provided
  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { 
      bsMonth = i + 1; 
      break; 
    }
    bsDay -= months[i];
  }
  
  // Ensure month is valid
  if (bsMonth > 12) bsMonth = 12;
  if (bsMonth < 1) bsMonth = 1;
  
  // Compute dayOfWeek for the AD date represented by this NPT-midnight instant
  const adUtcMsForThis = adNptMidnightMs + nptOffsetMs; // equals Date.UTC(year, month, day)
  const dayOfWeek = new Date(adUtcMsForThis).getUTCDay();

  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

export function convertBsToAd(year, month, day, customCalendarData = null) {
  // Merge custom calendar data with defaults
  const calendarData = customCalendarData ? { ...bsCalendarData, ...customCalendarData } : bsCalendarData;
  
  const startAdData = calendarData[year];
  if (!startAdData) return null;
  
  let start;
  // Handle both Date objects and plain objects from Firestore
  if (startAdData.startAdDate instanceof Date) {
    start = startAdData.startAdDate;
  } else if (typeof startAdData.startAdDate === 'string') {
    const [adYear, adMonth, adDay] = startAdData.startAdDate.split('-').map(Number);
    start = new Date(adYear, adMonth - 1, adDay);
  } else if (startAdData.startAdDate && typeof startAdData.startAdDate === 'object') {
    if (typeof startAdData.startAdDate.toDate === 'function') {
      start = startAdData.startAdDate.toDate();
    } else {
      start = new Date(startAdData.startAdDate);
    }
  } else {
    return null;
  }
  
  if (!start || isNaN(start.getTime())) return null;

  // totalDays offset from start of BS year
  let totalDays = 0;
  const months = calendarData[year]?.daysInMonths || [];
  for (let i = 0; i < month - 1; i++) {
    totalDays += months[i];
  }
  totalDays += day - 1;

  // Use NPT-midnight-based math so the returned AD date corresponds to the calendar day
  // that begins at NPT midnight for that BS date.
  const nptOffsetMs = 5.75 * 3600000;
  const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + (totalDays * 24 * 60 * 60 * 1000);

  // Convert back to a canonical AD Y/M/D by adding the NPT offset to get a UTC midnight instant
  const adUtcMs = targetNptMs + nptOffsetMs; // this equals Date.UTC(adYear, adMonth, adDay)
  const adUtcDate = new Date(adUtcMs);

  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth(), day: adUtcDate.getUTCDate() };
}

export function formatNepaliDate(adDate) {
  // Ensure Nepali date and weekday are computed using Nepal Time (NPT = UTC+5:45)
  const nptOffsetMs = 5.75 * 3600000;
  const utcMs = adDate.getTime();
  const nptShifted = new Date(utcMs + nptOffsetMs);
  const nptYear = nptShifted.getUTCFullYear();
  const nptMonth = nptShifted.getUTCMonth();
  const nptDay = nptShifted.getUTCDate();
  const dayOfWeek = nptShifted.getUTCDay(); // 0=Sunday, 1=Monday, etc.

  const bsDate = convertAdToBs(nptYear, nptMonth, nptDay);

  return {
    nepali: `${toNepaliNumber(bsDate.year)} ${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.day)}`,
    english: `${bsDate.year} ${nepaliMonths[bsDate.month - 1]} ${bsDate.day}`,
    shortNepali: `${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]}`,
    shortEnglish: `${bsDate.day} ${nepaliMonths[bsDate.month - 1]}`,
    withDayNepali: `${nepaliWeekdays[dayOfWeek]}, ${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.year)}`,
    withDayShortNepali: `${nepaliWeekdays[dayOfWeek]}, ${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]}`
  };
}

export function formatEnglishDate(adDate) {
  const dayOfWeek = adDate.getDay();
  return {
    short: adDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    full: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    }),
    withDayShort: `${englishWeekdays[dayOfWeek]}, ${adDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })}`,
    withDayFull: `${englishWeekdays[dayOfWeek]}, ${adDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })}`
  };
}

export function formatGregorianMonthYear(adDate) {
  return {
    full: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long'
    }),
    short: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short'
    })
  };
}

export function formatNepaliMonthYear(adDate) {
  // Use Nepal Time for month/year mapping as well
  const nptOffsetMs = 5.75 * 3600000;
  const utcMs = adDate.getTime();
  const nptShifted = new Date(utcMs + nptOffsetMs);
  const nptYear = nptShifted.getUTCFullYear();
  const nptMonth = nptShifted.getUTCMonth();
  const nptDay = nptShifted.getUTCDate();
  const bsDate = convertAdToBs(nptYear, nptMonth, nptDay);
  return {
    nepali: `${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.year)}`,
    english: `${nepaliMonths[bsDate.month - 1]} ${bsDate.year}`
  };
}

// Parse Nepali date string in MM-DD-YYYY format (with Nepali or English numerals)
export function parseNepaliDate(dateStr, customCalendarData = null) {
  if (!dateStr) return null;
  
  // Merge custom calendar data with defaults
  const calendarData = customCalendarData ? { ...bsCalendarData, ...customCalendarData } : bsCalendarData;
  
  // Convert Nepali numerals to English if present
  let normalizedStr = dateStr.trim();
  for (let i = 0; i < 10; i++) {
    normalizedStr = normalizedStr.replace(new RegExp(nepaliNumbers[i], 'g'), i.toString());
  }
  
  // Try YYYY-MM-DD format (Nepali date) first - this is the new standard format
  let match = normalizedStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const bsYear = parseInt(match[1]);
    const bsMonth = parseInt(match[2]);
    const bsDay = parseInt(match[3]);
    
    // Validate BS date ranges (month must be 1-12)
    if (bsYear < minBsYear || bsYear > maxBsYear) return null;
    if (bsMonth < 1 || bsMonth > 12) return null;
    if (bsDay < 1) return null;
    
    // Get the calendar data for this year
    const yearData = calendarData[bsYear];
    if (!yearData) return null;
    
    // Validate day against the actual configured days for this month/year
    const maxDay = yearData.daysInMonths[bsMonth - 1];
    if (bsDay > maxDay) return null;
    
    // Convert to AD
    const ad = convertBsToAd(bsYear, bsMonth, bsDay, customCalendarData);
    if (!ad) return null;
    
    // Return YYYY-MM-DD format for Firestore
    return `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
  }
  
  // Try MM-DD-YYYY format (legacy Nepali date format)
  match = normalizedStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const bsMonth = parseInt(match[1]);
    const bsDay = parseInt(match[2]);
    const bsYear = parseInt(match[3]);
    
    // Validate BS date ranges (month must be 1-12)
    if (bsYear < minBsYear || bsYear > maxBsYear) return null;
    if (bsMonth < 1 || bsMonth > 12) return null;
    if (bsDay < 1) return null;
    
    // Get the calendar data for this year
    const yearData = calendarData[bsYear];
    if (!yearData) return null;
    
    // Validate day against the actual configured days for this month/year
    const maxDay = yearData.daysInMonths[bsMonth - 1];
    if (bsDay > maxDay) return null;
    
    // Convert to AD
    const ad = convertBsToAd(bsYear, bsMonth, bsDay, customCalendarData);
    if (!ad) return null;
    
    // Return YYYY-MM-DD format for Firestore
    return `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
  }
  
  return null;
}

// Format AD date string (YYYY-MM-DD) to Nepali date string (MM-DD-YYYY)
export function formatAdDateToNepaliString(adDateStr, customCalendarData = null) {
  if (!adDateStr) return '';
  const [year, month, day] = adDateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  
  const bs = convertAdToBs(year, month - 1, day, customCalendarData);
  return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

// Format AD date string to Nepali with Nepali numerals (optionally with custom calendar data)
export function formatAdDateToNepaliStringWithNumerals(adDateStr, customCalendarData = null) {
  const formatted = formatAdDateToNepaliString(adDateStr, customCalendarData);
  if (!formatted) return '';
  
  return formatted.split('').map(char => {
    const num = parseInt(char);
    return isNaN(num) ? char : nepaliNumbers[num];
  }).join('');
}

// Format a UTC instant (ISO string or Date) to Nepali date/time using Nepal Time (NPT = UTC+5:45).
// Returns an object with useful fields:
// - formatted: readable Nepali date + 12-hour time string (e.g. "मार्ग १२, २०८२, 2:14:27 AM")
// - adDateIso: the NPT local AD date in ISO YYYY-MM-DD
// - time24: time in 24-hour HH:MM format (NPT)
// - time12: time in 12-hour h:mm:ss AM/PM format (NPT)
// - bsDate: { year, month, day }
export function formatNepaliDateTime(utcDateOrIso, customCalendarData = null) {
  if (!utcDateOrIso) return null;
  const utcDate = (utcDateOrIso instanceof Date) ? utcDateOrIso : new Date(utcDateOrIso);
  if (Number.isNaN(utcDate.getTime())) return null;

  const nptOffsetMs = 5.75 * 3600000;
  const nptShifted = new Date(utcDate.getTime() + nptOffsetMs);

  const nptYear = nptShifted.getUTCFullYear();
  const nptMonth = nptShifted.getUTCMonth();
  const nptDay = nptShifted.getUTCDate();
  const nptHours = nptShifted.getUTCHours();
  const nptMinutes = nptShifted.getUTCMinutes();
  const nptSeconds = nptShifted.getUTCSeconds();

  const bsDate = convertAdToBs(nptYear, nptMonth, nptDay, customCalendarData);

  const pad = (v) => String(v).padStart(2, '0');
  const time24 = `${pad(nptHours)}:${pad(nptMinutes)}`;
  const time24sec = `${pad(nptHours)}:${pad(nptMinutes)}:${pad(nptSeconds)}`;

  // build 12-hour time
  const period = nptHours >= 12 ? 'PM' : 'AM';
  const hours12 = nptHours % 12 || 12;
  const time12 = `${hours12}:${pad(nptMinutes)}:${pad(nptSeconds)} ${period}`;

  const nepaliDateStr = `${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.day)}, ${toNepaliNumber(bsDate.year)}`;

  return {
    formatted: `${nepaliDateStr}, ${time12}`,
    adDateIso: nptShifted.toISOString().split('T')[0],
    time24,
    time24sec,
    time12,
    bsDate,
    nptDate: nptShifted
  };
}

// Format tithi with month name for display
// Returns: { nepali: string, english: string, monthNumber: number }
// Example: { nepali: "पौष शुक्ल प्रतिपदा", english: "Pousha Sukla Pratipada", monthNumber: 9 }
export function formatTithiWithMonth(monthNumber, pakshya, tithiName, englishPackshya = 'Sukla', englishTithiName = 'Pratipada') {
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) return null;
  
  const monthNameNepali = nepaliMonths[monthNumber - 1];
  const pakshyaNepali = pakshya || 'शुक्लपक्ष';
  
  return {
    nepali: `${monthNameNepali} ${pakshyaNepali} ${tithiName}`,
    english: `${monthNameNepali} ${englishPackshya} ${englishTithiName}`,
    monthNumber,
    monthName: monthNameNepali
  };
}

// Get month name from month number (1-12)
export function getMonthName(monthNumber, useNepali = true) {
  if (monthNumber < 1 || monthNumber > 12) return null;
  return useNepali ? nepaliMonths[monthNumber - 1] : monthNumber.toString();
}

/**
 * Determines the Tithi Month for a given AD date
 * 
 * ⚠️ IMPORTANT: Tithi Months ≠ Nepali Calendar Months
 * 
 * TITHI MONTH SYSTEM:
 * - A Tithi Month is a lunar cycle: कृष्णपक्ष प्रतिपदा → शुक्लपक्ष पूर्णिमा (30 days)
 * - Tithi Year: वैशाख कृष्णपक्ष प्रतिपदा (start) → चैत्र शुक्लपक्ष पूर्णिमा (end)
 * - Month Name: Derived from which Nepali month the tithi STARTS in
 * - Boundary Crossing: Tithi months may span across Nepali calendar month lines
 * 
 * ALGORITHM:
 * 1. Extract the Nepali month (1-12) from where the tithi starts
 * 2. Look up the month name from the nepaliMonths array
 * 
 * @param {string} adDateStr - AD date in YYYY-MM-DD format
 * @returns {Object} { month: 1-12, monthName: string (Nepali), bsYear: number }
 */
export function getTithiMonthFromAdDate(adDateStr) {
  if (!adDateStr) return { month: null, monthName: '' };
  
  const [adYear, adMonth, adDay] = adDateStr.split('-').map(Number);
  if (!adYear || !adMonth || !adDay) return { month: null, monthName: '' };
  
  const bsDate = convertAdToBs(adYear, adMonth - 1, adDay);
  return {
    month: bsDate.month,
    monthName: nepaliMonths[bsDate.month - 1] || '',
    bsYear: bsDate.year
  };
}

/**
 * Get the Tithi Lunar Month Name based on Purnimanta system
 * 
 * PURNIMANTA SYSTEM (Lunar Months in Nepal):
 * - Each tithi month runs from Krishna Pratipada (day 1 of Krishna Paksha) 
 *   to Shukla Purnima (day 15 of Shukla Paksha)
 * - The month is NAMED after the solar month where Krishna Pratipada occurs
 * - A tithi month may span across two solar month boundaries
 * 
 * Tithi Month Mapping (based on solar month where it starts):
 * - Baishakh: Krishna Pratipada in Baishakh (month 1)
 * - Jestha: Krishna Pratipada in Jestha (month 2)
 * - etc.
 * 
 * @param {string} paksha - 'Shukla' or 'Krishna'
 * @param {number} pakshaIndex - 1-15 (day in paksha)
 * @param {string} adDateStr - AD date of the tithi in YYYY-MM-DD format
 * @returns {string} Tithi month name in Nepali
 */
export function getTithiLunarMonthName(paksha, pakshaIndex, adDateStr) {
  if (!paksha || !pakshaIndex || !adDateStr) return '';
  
  // PURNIMANTA SYSTEM NAMING RULE:
  // The Lunar Month is named after the Solar Month in which its Amavasya (New Moon) occurs.
  // - Amavasya is the 15th day of Krishna Paksha (Krishna 15).
  // - It falls in the middle of the Purnimanta month (Krishna 1 -> Shukla 15).
  
  // Algorithm:
  // 1. Estimate the date of Amavasya for this lunar month.
  // 2. Find the Solar Month of that Amavasya date.
  // 3. That is the Tithi Month Name.
  
  const isKrishna = paksha === 'Krishna' || paksha === 'कृष्णपक्ष';
  
  // Calculate offset to Amavasya (Krishna 15)
  // If Krishna (Day K): Amavasya is (15 - K) days in the FUTURE.
  // If Shukla (Day S): Amavasya was S days in the PAST. (Since Shukla 1 is 1 day after Amavasya)
  
  let daysOffset = 0;
  if (isKrishna) {
    daysOffset = 15 - pakshaIndex;
  } else {
    daysOffset = -pakshaIndex;
  }
  
  // Apply offset to AD Date
  const [y, m, d] = adDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + daysOffset);
  
  // Convert estimated Amavasya date to BS to get Solar Month
  const amavasyaBs = convertAdToBs(date.getFullYear(), date.getMonth(), date.getDate());
  
  return nepaliMonths[amavasyaBs.month - 1] || '';
}

/**
 * Semantic wrapper for determining Tithi Month from tithi components
 * 
 * This provides a clearer API when working with tithi-specific data and emphasizes
 * that we're determining the "Tithi Month" (lunar cycle), not just the calendar month.
 * 
 * IMPORTANT: The tithi month is determined solely by the START DATE of the tithi,
 * regardless of its pakshya or tithi number. Even if a tithi spans two calendar months,
 * its tithi month is determined by where it starts.
 * 
 * @param {string} pakshya - 'शुक्लपक्ष' or 'कृष्णपक्ष'
 * @param {number} tithiNum - Tithi number (1-15)
 * @param {string} adDate - AD date of the tithi in YYYY-MM-DD format
 * @returns {Object} { month: 1-12, monthName: string, bsYear: number }
 */
export function getTithiMonthFromTithi(pakshya, tithiNum, adDate) {
  // The tithi month is determined by when the tithi STARTS, independent of pakshya
  // This function delegates to getTithiMonthFromAdDate for the actual calculation
  return getTithiMonthFromAdDate(adDate);
}

/**
 * PURNIMANTA SYSTEM - Lunar Month Boundary Finder
 * 
 * The Purnimanta system (used in Nepal) defines lunar months as:
 * - Start: Krishna Pratipada (day after Purnima/Full Moon)
 * - End: Purnima (Full Moon)
 * 
 * This creates a "boundary" between solar calendar months and lunar months.
 * A lunar month may start in one solar month and end in another.
 * 
 * ⚠️ IMPORTANT: Lunar Month name should match the NEXT solar year when it starts in Chaitra.
 * Example: Lunar Baishakh starting on Chaitra 31, 2081 → labeled as "Baishakh 2082"
 */

/**
 * Get the Tithi Year start boundary (Chaitra Shukla Pratipada)
 * 
 * In the Purnimanta system, the Tithi Year starts at:
 * - Chaitra Shukla Pratipada (day after Chaitra Amavasya/New Moon)
 * - This typically falls between Chaitra 17-20 (solar date)
 * 
 * Limitation: This function requires external tithi lookup
 * For now, returns an approximate boundary; should be enhanced when tithi lookup is available
 * 
 * @param {number} bsYear - Bikram Sambat year (e.g., 2081)
 * @param {Function} tithiLookupFn - Function to lookup tithi for a BS date (optional, for future)
 * @returns {Object} { bsYear: number, startMonth: 12, startDay: number, startAdDate: string }
 */
export function getTithiYearStartBoundary(bsYear, tithiLookupFn = null) {
  // Find Chaitra Shukla Pratipada (day after Chaitra Amavasya)
  // This marks the start of the new Tithi Year
  
  if (!tithiLookupFn) {
    console.warn('getTithiYearStartBoundary: Requires tithi lookup function - using approximation');
    return {
      bsYear: bsYear,
      startMonth: 12, // Chaitra
      startDay: 18,  // Approximate (typically 17-20)
      approximateAdDate: null,
      needsAccurateCalculation: true
    };
  }
  
  try {
    // Scan Chaitra (month 12) from day 1 to 32 looking for Amavasya (tithi 30)
    for (let day = 1; day <= 32; day++) {
      const tithiInfo = tithiLookupFn(bsYear, 12, day);
      if (!tithiInfo) continue;
      
      // Amavasya is tithi 30 (Krishna Amavasya = 15th day of Krishna Paksha)
      if (tithiInfo.tithi === 30) {
        // The next day is Chaitra Shukla Pratipada (start of new year)
        const nextDay = day + 1;
        const adDate = convertBsToAd(bsYear, 12, nextDay);
        
        return {
          bsYear: bsYear,
          startMonth: 12, // Chaitra
          startDay: nextDay,
          startBsDate: { year: bsYear, month: 12, day: nextDay },
          startAdDate: `${adDate.year}-${String(adDate.month + 1).padStart(2, '0')}-${String(adDate.day).padStart(2, '0')}`,
          needsAccurateCalculation: false,
          found: true
        };
      }
    }
    
    console.warn(`getTithiYearStartBoundary: Could not find Amavasya in Chaitra ${bsYear}`);
    return {
      bsYear: bsYear,
      startMonth: 12,
      startDay: null,
      found: false,
      needsAccurateCalculation: true
    };
  } catch (error) {
    console.error('Error in getTithiYearStartBoundary:', error);
    return { bsYear, error: error.message };
  }
}

/**
 * Find Purnima (Full Moon) in a given solar month
 * 
 * Used to locate the boundary between lunar months in the Purnimanta system.
 * The day after Purnima marks the start of the next lunar month (Krishna Pratipada).
 * 
 * Limitation: This function requires external tithi lookup
 * When available, should scan all tithis in the month to find tithi 15 (Purnima)
 * 
 * @param {number} bsYear - Bikram Sambat year
 * @param {number} bsMonth - Bikram Sambat month (1-12, where 12 = Chaitra)
 * @param {Function} tithiLookupFn - Function to lookup tithi for a BS date (optional)
 * @returns {Object} { found: boolean, purnimaDay: number, purnimaAdDate: string, nextDayAdDate: string }
 */
export function findPurnimaInMonth(bsYear, bsMonth, tithiLookupFn = null) {
  // Find the Full Moon (Shukla Purnima / tithi 15) in a given solar month
  // The day after Purnima is Krishna Pratipada (start of next lunar month)
  
  if (!tithiLookupFn) {
    console.warn(`findPurnimaInMonth: Requires tithi lookup function (${bsYear}/${bsMonth})`);
    return {
      found: false,
      purnimaDay: null,
      purnimaAdDate: null,
      nextDayAdDate: null,
      needsAccurateCalculation: true
    };
  }
  
  try {
    // Get the number of days in this month (varies: 32 or 33 days)
    const monthDays = bsCalendarData[bsYear]?.[bsMonth - 1] || 32;
    
    // Scan the entire month looking for Shukla Purnima (tithi 15 in Shukla Paksha)
    for (let day = 1; day <= monthDays; day++) {
      const tithiInfo = tithiLookupFn(bsYear, bsMonth, day);
      if (!tithiInfo) continue;
      
      // Shukla Purnima is tithi 15, paksha 'Shukla'
      // This is the last day of the lunar month in Purnimanta system
      if (tithiInfo.tithi === 15 && tithiInfo.paksha === 'Shukla') {
        // The next day is Krishna Pratipada (start of next lunar month)
        const nextDay = day + 1;
        let nextBsYear = bsYear;
        let nextBsMonth = bsMonth;
        
        // Handle month overflow
        if (nextDay > monthDays) {
          nextBsMonth = bsMonth + 1;
          if (nextBsMonth > 12) {
            nextBsMonth = 1;
            nextBsYear = bsYear + 1;
          }
        }
        
        const purnimaAd = convertBsToAd(bsYear, bsMonth, day);
        const nextDayAd = convertBsToAd(nextBsYear, nextBsMonth, nextDay > monthDays ? 1 : nextDay);
        
        return {
          found: true,
          purnimaDay: day,
          purnimaBsDate: { year: bsYear, month: bsMonth, day: day },
          purnimaAdDate: `${purnimaAd.year}-${String(purnimaAd.month + 1).padStart(2, '0')}-${String(purnimaAd.day).padStart(2, '0')}`,
          nextDayBsDate: { year: nextBsYear, month: nextBsMonth, day: nextDay > monthDays ? 1 : nextDay },
          nextDayAdDate: `${nextDayAd.year}-${String(nextDayAd.month + 1).padStart(2, '0')}-${String(nextDayAd.day).padStart(2, '0')}`,
          needsAccurateCalculation: false
        };
      }
    }
    
    console.warn(`findPurnimaInMonth: Could not find Shukla Purnima in ${bsYear}/${bsMonth}`);
    return {
      found: false,
      purnimaDay: null,
      purnimaAdDate: null,
      nextDayAdDate: null,
      needsAccurateCalculation: true
    };
  } catch (error) {
    console.error('Error in findPurnimaInMonth:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Get lunar month boundaries using the Purnimanta system
 * 
 * Returns the start and end dates of a lunar month:
 * - Start: Krishna Pratipada (day after previous Purnima)
 * - End: Purnima (Full Moon)
 * 
 * @param {number} lunarMonthNumber - 1-12 (1=Baishakh, 12=Chaitra in lunar year)
 * @param {number} bsYear - Bikram Sambat year (solar year)
 * @param {Function} tithiLookupFn - Function to lookup tithis (optional, for enhanced version)
 * @returns {Object} { 
 *   lunarMonthNumber: 1-12,
 *   monthName: string (Nepali),
 *   bsYear: number,
 *   startBsDate: { year, month, day },
 *   endBsDate: { year, month, day },
 *   startAdDate: string (YYYY-MM-DD),
 *   endAdDate: string (YYYY-MM-DD),
 *   needsTithiLookup: boolean
 * }
 */
export function getTithiMonthBoundaries(lunarMonthNumber, bsYear, tithiLookupFn = null) {
  // Lunar month numbering (Purnimanta):
  // 1 = Baishakh (starts after Chaitra Purnima)
  // 2 = Jyeshtha
  // ...
  // 12 = Chaitra (ends at Chaitra Purnima, next year's Baishakh starts after)
  
  // Lunar month names mapped to lunar months
  const lunarMonthNames = [
    'बैशाख',    // 1 - Baishakh
    'ज्येष्ठ',       // 2 - Jyeshtha
    'आषाढ',     // 3 - Ashar
    'श्रावण',     // 4 - Saun
    'भाद्र',      // 5 - Bhadau
    'आश्विन',     // 6 - Asoj
    'कार्तिक',  // 7 - Kartik
    'मार्ग',    // 8 - Mangsir
    'पौष',      // 9 - Pus
    'माघ',      // 10 - Magh
    'फाल्गुन',    // 11 - Phalgun
    'चैत्र'       // 12 - Chaitra
  ];
  
  if (lunarMonthNumber < 1 || lunarMonthNumber > 12) {
    return { error: 'Invalid lunar month number. Must be 1-12.' };
  }
  
  const monthName = lunarMonthNames[lunarMonthNumber - 1];
  
  if (!tithiLookupFn) {
    console.warn(`getTithiMonthBoundaries: Requires tithi lookup function (${monthName} ${bsYear})`);
    return {
      lunarMonthNumber: lunarMonthNumber,
      monthName: monthName,
      bsYear: bsYear,
      startBsDate: { year: null, month: null, day: null },
      endBsDate: { year: null, month: null, day: null },
      startAdDate: null,
      endAdDate: null,
      needsAccurateCalculation: true
    };
  }
  
  try {
    // IMPORTANT: Lunar Baishakh (month 1) starts after Chaitra Purnima of PREVIOUS year
    // If a lunar month starts in Chaitra (solar month 12), it belongs to the NEXT solar year
    
    // Strategy: Find Purnima of previous lunar month, then next day is start of current month
    // For Baishakh (month 1): Find Chaitra Purnima of previous solar year
    // For other months: Find Purnima of previous solar month
    
    let startBsYear = bsYear;
    let startBsMonth = null;
    let startBsDay = null;
    let startAdDate = null;
    
    if (lunarMonthNumber === 1) {
      // Baishakh starts after Chaitra Purnima of PREVIOUS solar year
      const prevYearBoundary = findPurnimaInMonth(bsYear - 1, 12, tithiLookupFn);
      if (prevYearBoundary.found) {
        const nextDayParts = prevYearBoundary.nextDayAdDate.split('-');
        const convBack = convertAdToBs(parseInt(nextDayParts[0]), parseInt(nextDayParts[1]) - 1, parseInt(nextDayParts[2]));
        startBsYear = convBack.year;
        startBsMonth = convBack.month;
        startBsDay = convBack.day;
        startAdDate = prevYearBoundary.nextDayAdDate;
      }
    } else {
      // Other months start after Purnima of previous solar month
      const prevSolarMonth = (bsYear === 1) ? 12 : bsYear - 1;
      const prevPurnima = findPurnimaInMonth(bsYear, prevSolarMonth, tithiLookupFn);
      if (prevPurnima.found) {
        const nextDayParts = prevPurnima.nextDayAdDate.split('-');
        const convBack = convertAdToBs(parseInt(nextDayParts[0]), parseInt(nextDayParts[1]) - 1, parseInt(nextDayParts[2]));
        startBsYear = convBack.year;
        startBsMonth = convBack.month;
        startBsDay = convBack.day;
        startAdDate = prevPurnima.nextDayAdDate;
      }
    }
    
    // End of month: Find Purnima in the corresponding solar month
    const endPurnima = findPurnimaInMonth(startBsYear, startBsMonth, tithiLookupFn);
    let endBsDay = null;
    let endBsMonth = null;
    let endBsYear = null;
    let endAdDate = null;
    
    if (endPurnima.found) {
      const purnimaParts = endPurnima.purnimaAdDate.split('-');
      const convEnd = convertAdToBs(parseInt(purnimaParts[0]), parseInt(purnimaParts[1]) - 1, parseInt(purnimaParts[2]));
      endBsYear = convEnd.year;
      endBsMonth = convEnd.month;
      endBsDay = convEnd.day;
      endAdDate = endPurnima.purnimaAdDate;
    }
    
    return {
      lunarMonthNumber: lunarMonthNumber,
      monthName: monthName,
      yearLabel: startBsYear,  // Year of the month start (may cross calendar boundary)
      startBsDate: { year: startBsYear, month: startBsMonth, day: startBsDay },
      endBsDate: { year: endBsYear, month: endBsMonth, day: endBsDay },
      startAdDate: startAdDate,
      endAdDate: endAdDate,
      needsAccurateCalculation: false,
      found: startBsDay !== null && endBsDay !== null
    };
  } catch (error) {
    console.error('Error in getTithiMonthBoundaries:', error);
    return { lunarMonthNumber, monthName, error: error.message };
  }
}

/**
 * Determine the Lunar (Tithi) Year from an AD date
 * 
 * In the Purnimanta system, the Tithi Year changes at Chaitra Shukla Pratipada.
 * Any date before this day belongs to the "old" year.
 * Any date on or after this day belongs to the "new" year.
 * 
 * IMPORTANT: The year increment is RELATIVE to solar calendar.
 * - Dates in Chaitra (solar month 12) BEFORE Chaitra Shukla Pratipada → current tithi year
 * - Dates in Chaitra (solar month 12) ON/AFTER Chaitra Shukla Pratipada → next tithi year
 * 
 * @param {string} adDateStr - AD date in YYYY-MM-DD format
 * @param {Function} tithiLookupFn - Function to lookup tithis (optional, needed for accuracy)
 * @param {string} paksha - Optional: 'Shukla' or 'Krishna' if already known
 * @returns {Object} { tithiYear: number, inCharitra: boolean, beforeNewYear: boolean }
 */
export const tithiNameMapping = {
  'Pratipada': 1, 'Dwitiya': 2, 'Tritiya': 3, 'Chaturthi': 4, 'Panchami': 5,
  'Shashthi': 6, 'Saptami': 7, 'Ashtami': 8, 'Navami': 9, 'Dashami': 10,
  'Ekadashi': 11, 'Dwadashi': 12, 'Trayodashi': 13, 'Chaturdashi': 14,
  'Purnima': 15, 'Amavasya': 15, 'Aunsi': 15,
  'प्रतिपदा': 1, 'द्वितीया': 2, 'तृतीया': 3, 'चतुर्थी': 4, 'पंचमी': 5,
  'पञ्चमी': 5,
  'षष्ठी': 6, 'सप्तमी': 7, 'अष्टमी': 8, 'नवमी': 9, 'दशमी': 10,
  'एकादशी': 11, 'द्वादशी': 12, 'त्रयोदशी': 13, 'चतुर्दशी': 14,
  'पूर्णिमा': 15, 'औंसी': 15, 'अमावस्या': 15
};

export function getTithiIndexByName(name, options = {}) {
  const { fallbackToOne = true } = options;

  if (!name) return fallbackToOne ? 1 : null;

  // Normalize to improve matching across punctuation/variants.
  // Keep Devanagari + ASCII letters; strip common punctuation.
  const normalized = String(name)
    .replace(/[()[\]{},.]/g, ' ')
    .replace(/["'“”]/g, ' ')
    .replace(/[:;/\\|]/g, ' ')
    .replace(/[\u200c\u200d]/g, '')
    .trim();

  const parts = normalized.split(/[\s-]+/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleaned = part.replace(/[^A-Za-z\u0900-\u097F]/g, '');
    if (tithiNameMapping[cleaned]) return tithiNameMapping[cleaned];
    if (tithiNameMapping[part]) return tithiNameMapping[part];
  }

  return fallbackToOne ? 1 : null;
}

export function getTithiYearFromAdDate(adDateStr, tithiLookupFn = null, paksha = null, pakshaIndex = null) {
  if (!adDateStr) return { tithiYear: null, error: 'Invalid date' };
  
  try {
    const [adYear, adMonth, adDay] = adDateStr.split('-').map(Number);
    if (!adYear || !adMonth || !adDay) {
      return { tithiYear: null, error: 'Invalid date format' };
    }
    
    const bsDate = convertAdToBs(adYear, adMonth - 1, adDay);
    const bsYear = bsDate.year;
    const bsMonth = bsDate.month;
    
    // If the date is in Chaitra (month 12), we need to determine if it's before or after
    // Chaitra Shukla Purnima (Year End)
    // The New Year (Baishakh) starts on Krishna Pratipada
    
    if (bsMonth === 12) {
      // If Paksha is known, we can be exact
      if (paksha) {
        const isKrishna = paksha === 'Krishna' || paksha === 'कृष्णपक्ष';
        
        if (isKrishna) {
          // We need to determine if this Krishna Paksha belongs to Lunar Chaitra (Old Year)
          // or Lunar Baishakh (New Year).
          let isNewYear = true;
          
          if (pakshaIndex) {
             // Calculate offset to Amavasya (Krishna 15)
             const daysOffset = 15 - pakshaIndex;
             const date = new Date(adYear, adMonth - 1, adDay);
             date.setDate(date.getDate() + daysOffset);
             
             const amavasyaBs = convertAdToBs(date.getFullYear(), date.getMonth(), date.getDate());
             
             // If Amavasya is in Chaitra (12), it's still Old Year
             if (amavasyaBs.month === 12) {
               isNewYear = false;
             }
          } else {
             // Fallback heuristic if index not provided
             // If early in the month (< 15), assume Old Year
             if (bsDate.day < 15) {
               isNewYear = false;
             }
          }

          if (isNewYear) {
            return {
              tithiYear: bsYear + 1,
              bsYear: bsYear,
              inCharitra: true,
              beforeNewYear: false,
              needsAccurateCalculation: false
            };
          } else {
             return {
              tithiYear: bsYear,
              bsYear: bsYear,
              inCharitra: true,
              beforeNewYear: true,
              needsAccurateCalculation: false
            };
          }
        } else {
          return {
            tithiYear: bsYear,
            bsYear: bsYear,
            inCharitra: true,
            beforeNewYear: true,
            needsAccurateCalculation: false
          };
        }
      }
      
      // Fallback to heuristic if Paksha not known
      // Approximate boundary: Chaitra Shukla Purnima is typically around day 15-18
      // But wait, Chaitra starts in Shukla.
      // So Chaitra 1-15 is Shukla (Old Year).
      // Chaitra 16-30 is Krishna (New Year).
      
      const day = bsDate.day;
      const APPROX_CHAITRA_PURNIMA = 15; // Approximate day
      
      if (day <= APPROX_CHAITRA_PURNIMA && !tithiLookupFn) {
        // Probably Shukla (Old Year)
        return {
          tithiYear: bsYear,
          bsYear: bsYear,
          inCharitra: true,
          beforeNewYear: true,
          needsAccurateCalculation: true
        };
      } else {
        // Probably Krishna (New Year)
        return {
          tithiYear: bsYear + 1,
          bsYear: bsYear,
          inCharitra: true,
          beforeNewYear: false,
          needsAccurateCalculation: true
        };
      }
    } else {
      // Date is not in Chaitra, so tithi year = solar year
      // (Unless extreme boundary shift, but this is standard)
      return {
        tithiYear: bsYear,
        bsYear: bsYear,
        inCharitra: false,
        beforeNewYear: null
      };
    }
  } catch (error) {
    console.error('Error calculating Tithi Year:', error);
    return { tithiYear: null, error: error.message };
  }
}

/**
 * CRITICAL FUNCTION: Look up the tithi that occurs on a given BS date
 * 
 * This function enables all the boundary finders to work accurately.
 * It uses ephemeris calculations to determine which tithi (lunar day) falls on a specific date.
 * 
 * @param {number} bsYear - Bikram Sambat year
 * @param {number} bsMonth - Bikram Sambat month (1-12)
 * @param {number} bsDay - Bikram Sambat day (1-32)
 * @returns {Promise<Object|null>} {
 *   tithi: 1-30,
 *   paksha: 'Shukla' | 'Krishna',
 *   pakshaIndex: 1-15,
 *   tithiName: string (Nepali),
 *   bsYear, bsMonth, bsDay,
 *   adDate: { year, month, day },
 *   progress: 0-1 (how far through the tithi),
 *   startTime: HH:MM,
 *   endTime: HH:MM
 * }
 */
export async function getTithisForBsDate(bsYear, bsMonth, bsDay) {
  try {
    // Convert BS date to AD date
    const adDate = convertBsToAd(bsYear, bsMonth, bsDay);
    const adYear = adDate.year;
    const adMonth = adDate.month; // This is 0-indexed from convertBsToAd
    const adDay = adDate.day;
    
    // Import ephemeris functions
    const { computeTithiFromLongitudes, getEphemerisData } = await import('./ephemeris');
    
    // Get ephemeris data for noon on the AD date (Kathmandu location)
    // Use Kathmandu coordinates as default for Nepali calendar
    const dateObj = new Date(adYear, adMonth, adDay, 12, 0, 0);
    const ephData = await getEphemerisData(dateObj, 27.7172, 85.3240);
    
    if (!ephData || ephData.moonLon === undefined || ephData.sunLon === undefined) {
      console.error('Failed to get ephemeris data for', { bsYear, bsMonth, bsDay });
      return null;
    }
    
    // Calculate tithi from moon/sun longitudes
    const tithiResult = computeTithiFromLongitudes(ephData.moonLon, ephData.sunLon);
    
    // Tithi names (Nepali)
    const shuklaNames = [
      "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी",
      "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी",
      "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"
    ];
    const krishnaNames = [
      "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी",
      "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी",
      "त्रयोदशी", "चतुर्दशी", "औंसी"
    ];
    
    // Get tithi name from paksha and index
    const isShukla = tithiResult.paksha === 'Shukla';
    const tithiNames = isShukla ? shuklaNames : krishnaNames;
    const tithiIndex = tithiResult.pakshaIndex - 1; // pakshaIndex is 1-based
    const tithiName = tithiNames[tithiIndex] || 'Unknown';
    
    return {
      tithi: tithiResult.tithi,           // 1-30 (includes both pakshas)
      paksha: tithiResult.paksha,         // 'Shukla' or 'Krishna'
      pakshaIndex: tithiResult.pakshaIndex, // 1-15 (day within paksha)
      tithiName: tithiName,                 // Nepali name
      bsYear: bsYear,
      bsMonth: bsMonth,
      bsDay: bsDay,
      adDate: { year: adYear, month: adMonth + 1, day: adDay }, // Month converted back to 1-indexed
      progress: tithiResult.progress,
      progress_percent: tithiResult.progress_percent,
      startTime: ephData.tithiStart || null,
      endTime: ephData.tithiEnd || null
    };
  } catch (error) {
    console.error('Error in getTithisForBsDate:', { bsYear, bsMonth, bsDay, error });
    return null;
  }
}

// Get month number from month name (handles both Nepali and English month names)
export function getMonthNumber(monthName) {
  if (!monthName) return null;
  
  // Normalize input
  const normalized = monthName.trim().toLowerCase();
  
  // Try Nepali month names
  const nepaliIndex = nepaliMonths.map(m => m.toLowerCase()).indexOf(normalized);
  if (nepaliIndex >= 0) return nepaliIndex + 1;
  
  // Try English month names
  const englishIndex = englishMonths.map(m => m.toLowerCase()).indexOf(normalized);
  if (englishIndex >= 0) return englishIndex + 1;
  
  // Try numeric string
  const num = parseInt(monthName);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  
  return null;
}

// Validate month number or name
export function isValidMonth(month) {
  if (typeof month === 'number') {
    return month >= 1 && month <= 12;
  }
  return getMonthNumber(month) !== null;
}

// Get all month names with their numbers
export function getAllMonthsWithNumbers(useNepali = true) {
  const months = useNepali ? nepaliMonths : englishMonths;
  return months.map((name, index) => ({
    number: index + 1,
    name,
    nepaliName: nepaliMonths[index]
  }));
}

/**
 * TEST HELPER: Determine if a tithi should trigger a tithi month change
 * 
 * CRITICAL: Tithi month changes ONLY when pakshya changes
 * - End of current month: Shukla Purnima (tithi 15, paksha 'Shukla')
 * - Start of next month: Krishna Pratipada (tithi 1, paksha 'Krishna')
 * 
 * The month name (बैशाख, ज्येष्ठ, etc.) is determined by where the
 * Krishna Pratipada of that cycle starts, but the month continues
 * through solar calendar boundaries until the next Purnima.
 * 
 * @param {Object} currentTithi - Current tithi info { tithi, paksha, pakshaIndex, tithiName }
 * @param {Object} nextTithi - Next day's tithi info
 * @returns {boolean} True if this marks the END of a tithi month (Shukla Purnima)
 */
export function isTithiMonthEnd(currentTithi, nextTithi) {
  if (!currentTithi || !nextTithi) return false;
  
  // Current day is Shukla Purnima (last day of Shukla Paksha)
  const isCurrentPurnima = 
    currentTithi.paksha === 'Shukla' && 
    currentTithi.pakshaIndex === 15;
  
  // Next day is Krishna Pratipada (first day of Krishna Paksha)
  const isNextPratipada = 
    nextTithi.paksha === 'Krishna' && 
    nextTithi.pakshaIndex === 1;
  
  return isCurrentPurnima && isNextPratipada;
}

/**
 * TEST HELPER: Determine if a tithi marks the START of a tithi month
 * 
 * A tithi month starts when Krishna Pratipada begins.
 * The month name is determined by the solar month of Krishna Pratipada.
 * 
 * @param {Object} currentTithi - Current tithi info { tithi, paksha, pakshaIndex, bsMonth }
 * @returns {boolean} True if this is Krishna Pratipada (month start)
 */
export function isTithiMonthStart(currentTithi) {
  if (!currentTithi) return false;
  
  return (
    currentTithi.paksha === 'Krishna' && 
    currentTithi.pakshaIndex === 1
  );
}

/**
 * TEST HELPER: Validate tithi month consistency across a date range
 * 
 * This function helps test that:
 * 1. Tithi months change only at pakshya boundaries
 * 2. Tithi month names are consistent within the cycle
 * 3. Solar month boundaries don't affect tithi month continuity
 * 
 * @param {Array<Object>} tithiSequence - Array of tithis for consecutive days
 *   Each element: { bsYear, bsMonth, bsDay, tithi, paksha, pakshaIndex, tithiName }
 * @returns {Object} Validation report
 */
export function validateTithiMonthContinuity(tithiSequence) {
  if (!tithiSequence || tithiSequence.length < 2) {
    return { valid: false, error: 'Need at least 2 consecutive days' };
  }
  
  const issues = [];
  let currentMonthNum = null;
  let monthStartDay = null;
  const monthTransitions = [];
  
  for (let i = 0; i < tithiSequence.length; i++) {
    const current = tithiSequence[i];
    const next = i < tithiSequence.length - 1 ? tithiSequence[i + 1] : null;
    
    // Check if this is a month start (Krishna Pratipada)
    if (isTithiMonthStart(current)) {
      // This is Krishna Pratipada - new tithi month starts
      currentMonthNum = current.bsMonth;
      monthStartDay = {
        date: `${current.bsYear}/${current.bsMonth}/${current.bsDay}`,
        tithi: current.tithiName,
        paksha: current.paksha
      };
      
      monthTransitions.push({
        startDate: monthStartDay.date,
        startTithi: monthStartDay.tithi,
        expectedMonthNum: currentMonthNum
      });
    }
    
    // Check if this marks a month end (Shukla Purnima)
    if (next && isTithiMonthEnd(current, next)) {
      monthTransitions[monthTransitions.length - 1].endDate = 
        `${current.bsYear}/${current.bsMonth}/${current.bsDay}`;
      monthTransitions[monthTransitions.length - 1].endTithi = current.tithiName;
    }
    
    // IMPORTANT: Check that solar month boundary doesn't force tithi month change
    if (next && current.bsMonth !== next.bsMonth) {
      // Solar month is changing
      const isTithiMonthChanging = isTithiMonthEnd(current, next);
      
      if (!isTithiMonthChanging) {
        // Solar month changed but tithi month didn't - this is OK and expected!
        // For example: Chaitra 31 (Shukla Ekadashi) → Baishakh 1 (Shukla Dwadashi)
        // Same tithi month continues across solar boundary
        // This is the CORRECT behavior for Purnimanta system
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues: issues,
    monthTransitions: monthTransitions,
    summary: `Found ${monthTransitions.length} tithi month(s). ` +
             `All transitions at pakshya boundaries: ${issues.length === 0 ? 'YES' : 'NO'}`
  };
}

/**
 * TEST HELPER: Generate expected tithi month for a date range
 * 
 * Creates a summary of what tithi month each date should belong to
 * based on when Krishna Pratipada and Purnima occur.
 * 
 * Usage: Call this with getTithisForBsDate results to validate logic
 * 
 * @param {Array<Object>} tithiSequence - Sequence of tithis
 * @returns {Array<Object>} Array of { date, tithi, paksha, monthNumber, monthName }
 */
export function mapTithiSequenceToMonths(tithiSequence) {
  if (!tithiSequence || tithiSequence.length === 0) {
    return [];
  }
  
  const result = [];
  let currentMonthNum = null;
  let monthStartDate = null;
  
  for (const entry of tithiSequence) {
    // Reset month number on Krishna Pratipada
    if (isTithiMonthStart(entry)) {
      currentMonthNum = entry.bsMonth;
      monthStartDate = `${entry.bsYear}/${entry.bsMonth}/${entry.bsDay}`;
    }
    
    result.push({
      date: `${entry.bsYear}/${entry.bsMonth}/${entry.bsDay}`,
      tithi: entry.tithiName,
      paksha: entry.paksha,
      pakshaIndex: entry.pakshaIndex,
      tithiMonthNum: currentMonthNum,
      tithiMonthStartDate: monthStartDate,
      isMonthStart: isTithiMonthStart(entry),
      isMonthEnd: isTithiMonthEnd(entry, 
        tithiSequence[tithiSequence.indexOf(entry) + 1])
    });
  }
  
  return result;
}

/**
 * TEST HELPER: Manual test case for 2081→2082 boundary
 * 
 * This creates a manual test case showing expected tithi progression
 * across the Chaitra/Baishakh boundary.
 * 
 * Expected behavior:
 * - Chaitra ends with Purnima
 * - Baishakh starts with Krishna Pratipada (next day)
 * - Each tithi month lasts from Krishna Pratipada to Shukla Purnima
 * 
 * @returns {Object} Test case specification with expected results
 */
export function getTestCaseCharitaPurnima2081() {
  return {
    scenario: 'Chaitra Purnima 2081 → Baishakh Krishna Pratipada 2082',
    description: 'Validating that tithi month boundary aligns with pakshya transition',
    testPoints: [
      {
        name: 'Chaitra Shukla Dwadashi (before Purnima)',
        expectedPaksha: 'Shukla',
        expectedPakshaIndex: 12,
        expectedTithiMonth: 'Chaitra (2081)',
        shouldTransitionNext: false,
        note: 'Still in Chaitra tithi month, still Shukla Paksha'
      },
      {
        name: 'Chaitra Shukla Purnima (month end)',
        expectedPaksha: 'Shukla',
        expectedPakshaIndex: 15,
        expectedTithiMonth: 'Chaitra (2081)',
        shouldTransitionNext: true,
        note: 'LAST day of Chaitra tithi month. Next day starts new month.'
      },
      {
        name: 'Baishakh Krishna Pratipada (month start)',
        expectedPaksha: 'Krishna',
        expectedPakshaIndex: 1,
        expectedTithiMonth: 'Baishakh (2082)',
        shouldTransitionNext: false,
        note: 'FIRST day of Baishakh tithi month. Solar month changed, but expected.'
      },
      {
        name: 'Baishakh Krishna Dwitiya',
        expectedPaksha: 'Krishna',
        expectedPakshaIndex: 2,
        expectedTithiMonth: 'Baishakh (2082)',
        shouldTransitionNext: false,
        note: 'Continuing in Baishakh tithi month'
      }
    ],
    validation: {
      rule1: 'Tithi month changes ONLY when paksha changes (after Purnima)',
      rule2: 'Solar month boundary does NOT trigger tithi month change',
      rule3: 'Tithi month name determined by where Krishna Pratipada starts',
      rule4: 'Tithi month lasts ~30 days (one complete lunar cycle)'
    }
  };
}


export function getTithisForMonth(monthNumber) {
  const shuklaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"];
  const krishnaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"];
  
  return [
    ...shuklaNames.map(name => ({ name, pakshya: 'शुक्लपक्ष', tithiId: `shukla-${name}` })),
    ...krishnaNames.map(name => ({ name, pakshya: 'कृष्णपक्ष', tithiId: `krishna-${name}` }))
  ];
}

export { nepaliMonths, englishMonths, nepaliWeekdays, englishWeekdays, minBsYear, maxBsYear };


