import { useMemo, useCallback } from 'react';
import {
  getTithiIndexByName,
  getTithiYearFromAdDate,
  getTithiLunarMonthName,
  convertAdToBs,
} from '../utils/nepaliDateUtils';
import { NEPALI_MONTHS as nepaliMonths, normalizePakshaToNepali } from '../constants/calendarConstants';
import { parseTithiName, getTithiEventDisplayDate } from '../utils/calendarHelpers';
import { useTithisData } from './useTithisData';

/**
 * Custom hook that resolves the AD date for a tithi-based calendar event
 * by looking up the live TITHIS Firestore collection (via shared useTithisData hook).
 *
 * Usage:
 *   const resolveEventDate = useTithiDateResolver();
 *   const adDate = resolveEventDate(event); // "2026-03-22" or null
 *
 * Returns:
 *   - Tithi events (repetition: 'none' or 'yearly') -> resolved via tithiDateLookup
 *   - Non-tithi events -> event.dateKey as-is
 *   - Monthly tithi events -> event.dateKey (monthly display handled separately)
 *   - Missing tithi data -> event.dateKey as fallback (never vanishes)
 */
export function useTithiDateResolver() {
  // Use the shared tithis listener — no duplicate Firestore subscription
  const { tithisByDate } = useTithisData();

  // Build the lookup map: "pakshya||tithiName||year||month" -> {startDate, startTime}
  // Uses pre-computed fields from bulk generation as the PRIMARY source,
  // falling back to parsing/astronomical computation for legacy data.
  const tithiDateLookup = useMemo(() => {
    const map = new Map();
    const seen = new Set();

    Object.values(tithisByDate).forEach((tithisArr) => {
      tithisArr.forEach((t) => {
        if (!t.startDate || !t.name) return;
        const dedupeKey = (t.id || '') + '|' + t.startDate + '|' + t.name;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const { tithiMonth: parsedMonth, pakshya: parsedPakshya, tithi: parsedTithiName } = parseTithiName(t.name);

        const pakshya = t.pakshya || parsedPakshya;
        const tithiName = t.tithiName || parsedTithiName;
        if (!pakshya || !tithiName) return;

        const pakshaEn = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
        const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
        if (!tithiIndex) return;

        const lunarMonth = t.tithiMonth || parsedMonth || getTithiLunarMonthName(pakshaEn, tithiIndex, t.startDate);
        if (!lunarMonth) return;

        let tithiYear = t.tithiYear;
        if (!tithiYear) {
          const computed = getTithiYearFromAdDate(t.startDate, null, pakshaEn, tithiIndex);
          tithiYear = computed?.tithiYear;
        }
        if (!tithiYear) return;

        const key = `${pakshya}||${tithiName}||${tithiYear}||${lunarMonth}`;
        if (!map.has(key)) {
          map.set(key, { startDate: t.startDate, startTime: t.startTime || null });
        }
      });
    });
    return map;
  }, [tithisByDate]);

  // Current BS year — computed fresh each render
  const now = new Date();
  const bsNow = convertAdToBs(now.getFullYear(), now.getMonth(), now.getDate());
  const currentBsYear = bsNow?.year || 2083;

  const resolveEventDate = useCallback(
    (event) => {
      if (!event) return null;
      if (!event.tithi || event.repetition === 'monthly') {
        return event.dateKey || null;
      }

      const pakshaNepali = normalizePakshaToNepali(event.tithi.paksha);
      const tithiName = event.tithi.name;
      let expectedMonth = event.tithi.month;
      if (typeof expectedMonth === 'number') {
        expectedMonth = nepaliMonths[expectedMonth - 1];
      }

      let targetYear = currentBsYear;
      if (event.repetition === 'none' && event.dateKey) {
        try {
          const [adY, adM, adD] = event.dateKey.split('-').map(Number);
          const bsDate = convertAdToBs(adY, adM - 1, adD);
          if (bsDate?.year) targetYear = bsDate.year;
        } catch (e) { /* keep currentBsYear */ }
      }

      // For yearly events: collect ALL matches from multiple years and pick nearest future
      if (event.repetition === 'yearly') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const candidates = [];
        for (const offset of [0, 1, -1, 2, -2]) {
          const yr = targetYear + offset;
          const yrKey = `${pakshaNepali}||${tithiName}||${yr}||${expectedMonth}`;
          const yrFound = tithiDateLookup.get(yrKey);
          if (yrFound) {
            const resolved = getTithiEventDisplayDate(yrFound.startDate, yrFound.startTime);
            if (resolved) candidates.push(resolved);
          }
        }

        if (candidates.length > 0) {
          const sorted = candidates
            .map(d => ({ date: d, obj: new Date(d + 'T12:00:00') }))
            .sort((a, b) => {
              const aFuture = a.obj >= today;
              const bFuture = b.obj >= today;
              if (aFuture && !bFuture) return -1;
              if (!aFuture && bFuture) return 1;
              return a.obj - b.obj;
            });
          return sorted[0].date;
        }
      }

      // For non-yearly events, try the primary year only
      const key = `${pakshaNepali}||${tithiName}||${targetYear}||${expectedMonth}`;
      const found = tithiDateLookup.get(key);
      if (found !== undefined) {
        return getTithiEventDisplayDate(found.startDate, found.startTime);
      }

      // Defensive fallback
      return event.dateKey || null;
    },
    [currentBsYear, tithiDateLookup]
  );

  return resolveEventDate;
}
