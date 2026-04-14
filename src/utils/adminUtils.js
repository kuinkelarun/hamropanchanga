/**
 * Utility helpers for Admin Management.
 * Pure functions with no component-state dependency.
 *
 * Note: formatTime12Hour was consolidated into calendarHelpers.js
 * which has a superset version with Nepali numeral support.
 */

/**
 * Compute start milliseconds for a tithi entry (used for sorting).
 * @param {Object} tithi
 * @returns {number}
 */
export function getTithiStartMillis(tithi) {
  try {
    if (!tithi) return Infinity;
    if (tithi.startDate && tithi.startTime) {
      const ts = String(tithi.startTime).trim();
      const m24 = ts.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (m24) return new Date(`${tithi.startDate}T${m24[1].padStart(2, '0')}:${m24[2]}:00`).getTime();
      const m12 = ts.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const mm = m12[2];
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return new Date(`${tithi.startDate}T${String(h).padStart(2, '0')}:${mm}:00`).getTime();
      }
      const dt = new Date(`${tithi.startDate} ${tithi.startTime}`);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : Infinity;
    }
    if (tithi.startDate) return new Date(`${tithi.startDate}T00:00:00`).getTime();
    return Infinity;
  } catch (e) {
    return Infinity;
  }
}

/**
 * Compute end milliseconds for a tithi entry (used for anomaly detection).
 * @param {Object} tithi
 * @returns {number}
 */
export function getTithiEndMillis(tithi) {
  try {
    if (!tithi) return -Infinity;
    if (tithi.endDate && tithi.endTime) {
      const ts = String(tithi.endTime).trim();
      const m24 = ts.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (m24) return new Date(`${tithi.endDate}T${m24[1].padStart(2, '0')}:${m24[2]}:00`).getTime();
      const m12 = ts.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const mm = m12[2];
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return new Date(`${tithi.endDate}T${String(h).padStart(2, '0')}:${mm}:00`).getTime();
      }
      const dt = new Date(`${tithi.endDate} ${tithi.endTime}`);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : -Infinity;
    }
    if (tithi.endDate) return new Date(`${tithi.endDate}T23:59:59`).getTime();
    return -Infinity;
  } catch (e) {
    return -Infinity;
  }
}

/**
 * Normalize a time string to 24-hour HH:MM format.
 * Accepts 24-hour (HH:MM) and 12-hour (h:MM AM/PM) formats.
 * @param {string} ts
 * @returns {string|null}
 */
export function normalizeTimeTo24(ts) {
  if (!ts) return null;
  const s = String(ts).trim();
  // 24-hour e.g., 05:05 or 17:30
  const m24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  // 12-hour with AM/PM e.g., 5:05 AM, 05:05PM
  const m12 = s.match(/^(1[0-2]|0?\d):([0-5]\d)\s*([AaPp][Mm])$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const mm = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  // Try to parse loose formats like '5:05AM' or '5:05am'
  const m12b = s.match(/^(1[0-2]|0?\d):([0-5]\d)([AaPp][Mm])$/);
  if (m12b) {
    let h = parseInt(m12b[1], 10);
    const mm = m12b[2];
    const ampm = m12b[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  return null;
}
