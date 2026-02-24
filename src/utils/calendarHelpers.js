/**
 * calendarHelpers.js
 *
 * Pure utility functions extracted from NepaliCalendar.js.
 * None of these depend on React state or component context—they are
 * safe to call from any module.
 */

import { NEPALI_TO_ENGLISH_TITHI_MAP, NEPALI_MONTHS, normalizePakshaToEnglish } from '../constants/calendarConstants';
import { toNepaliNumber, getNepalDate } from './nepaliDateUtils';

// Re-export so existing imports from calendarHelpers keep working
export { toNepaliNumber, getNepalDate };

// ──── Number / Date formatting ────
/**
 * Convert a 24-hour time string ("HH:MM") to 12-hour format with AM/PM.
 * When `isNepali` is true and a `tn` converter function is provided the
 * hour and minute values are transliterated to Nepali numerals.
 */
export function formatTime12Hour(time24, isNepali = false, tn = null) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const minutesStr = String(minutes).padStart(2, '0');

  if (isNepali && tn) {
    return `${tn(hours12)}:${tn(minutesStr)} ${period}`;
  }
  return `${hours12}:${minutesStr} ${period}`;
}

// ──── Tithi name parsing / translation ────

/**
 * Split a combined tithi name into its components.
 *
 * Handles both legacy 2-part names ("शुक्लपक्ष प्रतिपदा") and
 * new 3-part names ("फाल्गुन शुक्लपक्ष प्रतिपदा").
 *
 * Detection: if the first word is a known Nepali month name from
 * NEPALI_MONTHS, treat the name as 3-part (month + pakshya + tithi).
 *
 * @returns {{ tithiMonth: string, pakshya: string, tithi: string }}
 */
export function parseTithiName(fullName) {
  if (!fullName) return { tithiMonth: '', pakshya: '', tithi: '' };
  const parts = fullName.split(' ');

  if (parts.length >= 3 && NEPALI_MONTHS.includes(parts[0])) {
    // New 3-part format: "फाल्गुन शुक्लपक्ष प्रतिपदा"
    return { tithiMonth: parts[0], pakshya: parts[1], tithi: parts.slice(2).join(' ') };
  }

  if (parts.length >= 2) {
    // Legacy 2-part format: "शुक्लपक्ष प्रतिपदा"
    return { tithiMonth: '', pakshya: parts[0], tithi: parts.slice(1).join(' ') };
  }

  return { tithiMonth: '', pakshya: '', tithi: fullName };
}

/** Map a Nepali tithi name (e.g. "प्रतिपदा") to its English transliteration. */
export function getEnglishTithiName(nepaliTithiName) {
  return NEPALI_TO_ENGLISH_TITHI_MAP[nepaliTithiName] || nepaliTithiName;
}

/** Map a Nepali pakshya name (e.g. "शुक्लपक्ष") to its English transliteration. */
export function getEnglishPakshyaName(nepaliPakshyaName) {
  return normalizePakshaToEnglish(nepaliPakshyaName) || nepaliPakshyaName;
}

// ──── Time normalisation & tithi sort helpers ────

/**
 * Accept various time formats ('HH:MM', 'H:MM', 'H:MM AM/PM') and
 * return a normalised 24-hour 'HH:MM' string, or null on failure.
 */
export function normalizeTimeTo24(timeStr) {
  if (!timeStr) return null;
  timeStr = String(timeStr).trim();
  // Already 24-hour
  const m24 = timeStr.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  // 12-hour with AM/PM
  const m12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const mm = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  return null;
}

/** Return the start timestamp (ms) for a tithi object, or Infinity if unavailable. */
export function getTithiStartMillis(tithi) {
  try {
    if (!tithi) return Infinity;
    if (tithi.startDate && tithi.startTime) {
      const t24 = normalizeTimeTo24(tithi.startTime) || tithi.startTime;
      if (!t24 || !/^\d{2}:\d{2}$/.test(t24)) {
        const dt = new Date(`${tithi.startDate} ${tithi.startTime}`);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : Infinity;
      }
      return new Date(`${tithi.startDate}T${t24}:00`).getTime();
    }
    if (tithi.startDate) {
      return new Date(`${tithi.startDate}T00:00:00`).getTime();
    }
    return Infinity;
  } catch {
    return Infinity;
  }
}

/** Return the end timestamp (ms) for a tithi object, or Infinity if unavailable. */
export function getTithiEndMillis(tithi) {
  try {
    if (!tithi) return Infinity;
    if (tithi.endDate && tithi.endTime) {
      const t24 = normalizeTimeTo24(tithi.endTime) || tithi.endTime;
      if (!t24 || !/^\d{2}:\d{2}$/.test(t24)) {
        const dt = new Date(`${tithi.endDate} ${tithi.endTime}`);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : Infinity;
      }
      return new Date(`${tithi.endDate}T${t24}:00`).getTime();
    }
    if (tithi.endDate) {
      return new Date(`${tithi.endDate}T23:59:59`).getTime();
    }
    return Infinity;
  } catch {
    return Infinity;
  }
}

/** Comparator: sort tithis by start-millis, then end-millis, then name. */
export function compareTithisByStart(a, b) {
  const sa = getTithiStartMillis(a);
  const sb = getTithiStartMillis(b);
  if (sa !== sb) return sa - sb;
  const ea = getTithiEndMillis(a);
  const eb = getTithiEndMillis(b);
  if (ea !== eb) return ea - eb;
  return (a.name || '').localeCompare(b.name || '');
}

// ──── Date-key helpers ────

/**
 * Build a "YYYY-MM-DD" key from an AD date object `{ year, month, day }`
 * where `month` is **zero-based** (JS-style).
 */
export function dateKeyFromAd(ad) {
  return `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
}

/**
 * Build a "YYYY-MM-DD" key from numeric year, month (1-based), day.
 */
export function padDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
