// Nepali Calendar utilities
import bsCalendarData from '../data/bsCalendarData';

const nepaliMonths = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
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
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nptOffset = 5.75 * 3600000;
  return new Date(utc + nptOffset);
}

export function convertAdToBs(year, month, day) {
  // Use Nepal Time (NPT) midnight as the reference for a calendar day.
  // This avoids local timezone differences causing off-by-one errors when callers
  // pass Y/M/D values taken from Nepal time or from local time.
  const nptOffsetMs = 5.75 * 3600000; // 5 hours 45 minutes in ms

  // Compute the UTC-milliseconds instant corresponding to NPT midnight for the given Y/M/D
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;

  let bsYear = null, totalDays = 0;

  // Iterate calendar data and compare using NPT-midnight-based instants
  const keys = Object.keys(bsCalendarData).map(Number).sort((a, b) => a - b);
  for (const y of keys) {
    const startAd = bsCalendarData[y].startAdDate;
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
  const months = bsCalendarData[bsYear].daysInMonths;
  
  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { 
      bsMonth = i + 1; 
      break; 
    }
    bsDay -= months[i];
  }
  
  // Compute dayOfWeek for the AD date represented by this NPT-midnight instant
  const adUtcMsForThis = adNptMidnightMs + nptOffsetMs; // equals Date.UTC(year, month, day)
  const dayOfWeek = new Date(adUtcMsForThis).getUTCDay();

  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

export function convertBsToAd(year, month, day) {
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;

  // totalDays offset from start of BS year
  let totalDays = 0;
  for (let i = 0; i < month - 1; i++) {
    totalDays += bsCalendarData[year].daysInMonths[i];
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
export function parseNepaliDate(dateStr) {
  if (!dateStr) return null;
  
  // Convert Nepali numerals to English if present
  let normalizedStr = dateStr.trim();
  for (let i = 0; i < 10; i++) {
    normalizedStr = normalizedStr.replace(new RegExp(nepaliNumbers[i], 'g'), i.toString());
  }
  
  // Try MM-DD-YYYY format first
  let match = normalizedStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const bsMonth = parseInt(match[1]);
    const bsDay = parseInt(match[2]);
    const bsYear = parseInt(match[3]);
    
    // Validate BS date
    if (bsYear < minBsYear || bsYear > maxBsYear) return null;
    if (bsMonth < 1 || bsMonth > 12) return null;
    
    const yearData = bsCalendarData[bsYear];
    if (!yearData) return null;
    
    const maxDay = yearData.daysInMonths[bsMonth - 1];
    if (bsDay < 1 || bsDay > maxDay) return null;
    
    // Convert to AD
    const ad = convertBsToAd(bsYear, bsMonth, bsDay);
    if (!ad) return null;
    
    // Return YYYY-MM-DD format for Firestore
    return `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD format (AD date)
  match = normalizedStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return normalizedStr; // Already in correct format
  }
  
  return null;
}

// Format AD date string (YYYY-MM-DD) to Nepali date string (MM-DD-YYYY)
export function formatAdDateToNepaliString(adDateStr) {
  if (!adDateStr) return '';
  const [year, month, day] = adDateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  
  const bs = convertAdToBs(year, month - 1, day);
  return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

// Format AD date string to Nepali with Nepali numerals
export function formatAdDateToNepaliStringWithNumerals(adDateStr) {
  const formatted = formatAdDateToNepaliString(adDateStr);
  if (!formatted) return '';
  
  return formatted.split('').map(char => {
    const num = parseInt(char);
    return isNaN(num) ? char : nepaliNumbers[num];
  }).join('');
}

// Format a UTC instant (ISO string or Date) to Nepali date/time using Nepal Time (NPT = UTC+5:45).
// Returns an object with useful fields:
// - formatted: readable Nepali date + 12-hour time string (e.g. "मंसिर १२, २०८२, 2:14:27 AM")
// - adDateIso: the NPT local AD date in ISO YYYY-MM-DD
// - time24: time in 24-hour HH:MM format (NPT)
// - time12: time in 12-hour h:mm:ss AM/PM format (NPT)
// - bsDate: { year, month, day }
export function formatNepaliDateTime(utcDateOrIso) {
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

  const bsDate = convertAdToBs(nptYear, nptMonth, nptDay);

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

export { nepaliMonths, englishMonths, nepaliWeekdays, englishWeekdays, minBsYear, maxBsYear };
