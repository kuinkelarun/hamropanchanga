// functions/utils/dateUtils.js
//
// Pure Node-compatible date helpers for Cloud Functions.
// Mirrors the NPT-based AD↔BS logic from src/utils/nepaliDateUtils.js
// but uses require() instead of ES module imports.
//
// The BS calendar data is passed in as a parameter (loaded from Firestore at runtime)
// rather than required at module load time, because the src/ ES-module version cannot
// be used directly in CommonJS Cloud Functions.

// Nepal Standard Time offset: UTC+5:45
const NPT_OFFSET_MS = 5.75 * 3600000; // 20700000 ms

// ─── Core conversion helpers ──────────────────────────────────────────────────

/**
 * Convert an AD date (year, month 1-12, day 1-31) to a BS date.
 * @param {number} year
 * @param {number} month  - 1-based
 * @param {number} day
 * @param {object} calendarData - BS calendar data object { [bsYear]: { startAdDate, daysInMonths } }
 * @returns {{ year, month, day }}
 */
function convertAdToBs(year, month, day, calendarData) {
  const BS_YEARS = Object.keys(calendarData).map(Number).sort((a, b) => a - b);
  const MIN_BS_YEAR = BS_YEARS[0];

  // NPT midnight for this AD date
  const adNptMidnightMs = Date.UTC(year, month - 1, day) - NPT_OFFSET_MS;

  let bsYear = null;
  let totalDays = 0;

  for (const y of BS_YEARS) {
    const startAdData = calendarData[y];
    const startAdStr  = startAdData?.startAdDate;
    if (!startAdStr) continue;

    let startAd;
    if (startAdStr instanceof Date) {
      startAd = startAdStr;
    } else if (typeof startAdStr === 'string') {
      const [ay, am, ad] = startAdStr.split('-').map(Number);
      startAd = new Date(ay, am - 1, ad);
    } else {
      startAd = new Date(startAdStr);
    }
    if (!startAd || isNaN(startAd.getTime())) continue;

    const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - NPT_OFFSET_MS;

    if (adNptMidnightMs >= startNptMs) {
      bsYear = y;
      const diffMs = adNptMidnightMs - startNptMs;
      totalDays = Math.floor(diffMs / 86400000) + 1;
    } else {
      break;
    }
  }

  if (!bsYear) return { year: MIN_BS_YEAR, month: 1, day: 1 };

  const months = calendarData[bsYear]?.daysInMonths || [];
  let bsMonth = 1;
  let bsDay   = totalDays;

  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { bsMonth = i + 1; break; }
    bsDay -= months[i];
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Convert a BS date (year, month 1-12, day 1-32) to an AD date.
 * @param {number} year
 * @param {number} month  - 1-based
 * @param {number} day
 * @param {object} calendarData
 * @returns {{ year, month (1-based), day } | null}
 */
function convertBsToAd(year, month, day, calendarData) {
  const startAdData = calendarData[year];
  if (!startAdData) return null;

  let startAd;
  const startAdStr = startAdData.startAdDate;
  if (startAdStr instanceof Date) {
    startAd = startAdStr;
  } else if (typeof startAdStr === 'string') {
    const [ay, am, ad] = startAdStr.split('-').map(Number);
    startAd = new Date(ay, am - 1, ad);
  } else {
    startAd = new Date(startAdStr);
  }
  if (!startAd || isNaN(startAd.getTime())) return null;

  const months = calendarData[year]?.daysInMonths || [];
  let totalDays = 0;
  for (let i = 0; i < month - 1; i++) totalDays += months[i];
  totalDays += day - 1;

  const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - NPT_OFFSET_MS;
  const targetNptMs = startNptMs + totalDays * 86400000;
  const adUtcMs  = targetNptMs + NPT_OFFSET_MS;
  const adDate   = new Date(adUtcMs);

  return {
    year:  adDate.getUTCFullYear(),
    month: adDate.getUTCMonth() + 1, // 1-based
    day:   adDate.getUTCDate(),
  };
}

// ─── NPT "today" helpers ───────────────────────────────────────────────────────

/**
 * Get the current date in Nepal Standard Time as a YYYY-MM-DD string.
 */
function getTodayNPT() {
  const now    = new Date();
  const nptMs  = now.getTime() + NPT_OFFSET_MS;
  const nptDate = new Date(nptMs);
  const y = nptDate.getUTCFullYear();
  const m = String(nptDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nptDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add `days` days to a YYYY-MM-DD string.
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

/**
 * Return the two target AD dates for the event-reminder scheduler:
 *   - today in NPT  (day-of reminders)
 *   - today + 7 days in NPT  (week-ahead reminders)
 *
 * Both are YYYY-MM-DD strings (AD).
 */
function getTargetDatesNPT() {
  const today = getTodayNPT();
  return [today, addDays(today, 7)];
}

/**
 * Resolve a tithi-based recurrence object to an AD YYYY-MM-DD string.
 *
 * `nepaliDateForRecurrence` is expected to be an object:
 *   { bsYear: number, bsMonth: number, bsDay: number }
 * or a hyphen-separated string "BSYEAR-BSMONTH-BSDAY".
 *
 * This is a best-effort calendar-day approximation — not an astronomical tithi.
 *
 * @param {object|string} nepaliDateForRecurrence
 * @param {object}        calendarData
 * @returns {string|null} YYYY-MM-DD or null
 */
function resolveTithiToAD(nepaliDateForRecurrence, calendarData) {
  if (!nepaliDateForRecurrence) return null;
  let bsYear, bsMonth, bsDay;

  if (typeof nepaliDateForRecurrence === 'string') {
    const parts = nepaliDateForRecurrence.split('-').map(Number);
    if (parts.length < 3) return null;
    [bsYear, bsMonth, bsDay] = parts;
  } else {
    ({ bsYear, bsMonth, bsDay } = nepaliDateForRecurrence);
  }

  const ad = convertBsToAd(bsYear, bsMonth, bsDay, calendarData);
  if (!ad) return null;
  return `${ad.year}-${String(ad.month).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
}

module.exports = { convertAdToBs, convertBsToAd, getTodayNPT, addDays, getTargetDatesNPT, resolveTithiToAD };
