/**
 * nepaliRecurrence.js
 *
 * Utility to compute the Nepali (BS) date to store alongside
 * repeating events so that recurrence matching works correctly
 * across the BS calendar (where month lengths vary year to year).
 *
 * Extracted from duplicated logic in TreeDetailPage (handleAddEvent + handleUpdateEvent)
 * and NepaliCalendar.js (submitAddEvent).
 */
import { convertAdToBs } from './nepaliDateUtils';

/**
 * For monthly or yearly recurring events that are NOT tithi-based,
 * compute the original Nepali (BS) date so the recurrence engine
 * can match on Nepali month/day instead of AD month/day.
 *
 * @param {string} adDateStr – AD date in 'YYYY-MM-DD' format
 * @param {string} repetition – 'none' | 'monthly' | 'yearly'
 * @param {Object|null} tithi – Tithi info; if truthy, recurrence is handled by tithi, so we return null.
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function computeNepaliRecurrence(adDateStr, repetition, tithi) {
  if (!adDateStr) return null;
  if (tithi) return null; // tithi-based events use their own recurrence
  if (repetition !== 'yearly' && repetition !== 'monthly') return null;

  const [adY, adM, adD] = adDateStr.split('-').map(Number);
  if (!adY || !adM || !adD) return null;

  const bsDate = convertAdToBs(adY, adM - 1, adD); // convertAdToBs expects 0-indexed month
  return {
    year: bsDate.year,
    month: bsDate.month,
    day: bsDate.day,
  };
}
