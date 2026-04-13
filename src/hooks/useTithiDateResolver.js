import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import {
  getTithiIndexByName,
  getTithiYearFromAdDate,
  getTithiLunarMonthName,
  convertAdToBs,
} from '../utils/nepaliDateUtils';
import { NEPALI_MONTHS as nepaliMonths, normalizePakshaToNepali } from '../constants/calendarConstants';
import { parseTithiName, padDateKey, getTithiEventDisplayDate } from '../utils/calendarHelpers';

/**
 * Custom hook that listens to the TITHIS Firestore collection and provides
 * a function to resolve the AD date for a tithi-based calendar event.
 *
 * Usage:
 *   const resolveEventDate = useTithiDateResolver();
 *   const adDate = resolveEventDate(event); // "2026-03-22" or null
 *
 * The returned resolver handles:
 *   - Tithi events (repetition: 'none' or 'yearly') -> resolves via tithiDateLookup
 *   - Non-tithi events -> returns event.dateKey as-is
 *   - Monthly tithi events -> returns event.dateKey (monthly display handled separately)
 *   - Missing tithi data -> returns event.dateKey as fallback (never vanishes)
 */
export function useTithiDateResolver() {
  const [tithisByDate, setTithisByDate] = useState({});

  // Real-time listener for tithis collection
  useEffect(() => {
    const tithisCollection = collection(db, COLLECTIONS.TITHIS);
    const q = query(tithisCollection, orderBy('startDate'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tithisData = {};
      snapshot.docs.forEach((docSnap) => {
        const tithi = { id: docSnap.id, ...docSnap.data() };

        if (tithi.startDate && tithi.endDate) {
          const startDateObj = new Date(tithi.startDate + 'T00:00:00');
          const endDateObj = new Date(tithi.endDate + 'T00:00:00');
          const currentDate = new Date(startDateObj);

          while (currentDate <= endDateObj) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const day = currentDate.getDate();
            const dateKey = padDateKey(year, month, day);

            if (!tithisData[dateKey]) tithisData[dateKey] = [];
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startDate: tithi.startDate,
              startTime: tithi.startTime,
              endDate: tithi.endDate,
              endTime: tithi.endTime,
              // Forward pre-computed fields from bulk generation
              tithiMonth: tithi.tithiMonth || null,
              tithiYear: tithi.tithiYear || null,
              pakshya: tithi.pakshya || null,
              tithiName: tithi.tithiName || null,
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else {
          const dateKey = tithi.dateKey;
          if (dateKey) {
            if (!tithisData[dateKey]) tithisData[dateKey] = [];
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startDate: tithi.startDate || dateKey,
              startTime: tithi.startTime,
              endTime: tithi.endTime,
              tithiMonth: tithi.tithiMonth || null,
              tithiYear: tithi.tithiYear || null,
              pakshya: tithi.pakshya || null,
              tithiName: tithi.tithiName || null,
            });
          }
        }
      });
      setTithisByDate(tithisData);
    }, (error) => {
      console.error('[useTithiDateResolver] Tithis onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, []);

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

        // Parse the name for fallback values
        const { tithiMonth: parsedMonth, pakshya: parsedPakshya, tithi: parsedTithiName } = parseTithiName(t.name);

        // Use stored fields first, then parsed, then computed
        const pakshya = t.pakshya || parsedPakshya;
        const tithiName = t.tithiName || parsedTithiName;
        if (!pakshya || !tithiName) return;

        const pakshaEn = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
        const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
        if (!tithiIndex) return;

        // Lunar month: prefer stored > parsed from name > computed astronomically
        const lunarMonth = t.tithiMonth || parsedMonth || getTithiLunarMonthName(pakshaEn, tithiIndex, t.startDate);
        if (!lunarMonth) return;

        // Tithi year: prefer stored > computed from date
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
    // Debug: uncomment to trace lookup map contents
    // console.log(`[tithiDateLookup] Built map with ${map.size} entries`);
    return map;
  }, [tithisByDate]);

  // Derive current BS year from today's date.
  // No dependency array caching — always use the actual current year.
  const now = new Date();
  const bsNow = convertAdToBs(now.getFullYear(), now.getMonth(), now.getDate());
  const currentBsYear = bsNow?.year || 2083;

  // Resolve the live AD dateKey for a tithi-based calendar event.
  //   Returns a date string -> tithi present, show event on that day
  //   Returns event.dateKey -> fallback when tithi not found (event still shows)
  //   Returns event.dateKey -> non-tithi or monthly events
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

      // For one-time (none) events derive the target year from stored dateKey.
      // For yearly events use currentBsYear as the starting point.
      let targetYear = currentBsYear;
      if (event.repetition === 'none' && event.dateKey) {
        try {
          const [adY, adM, adD] = event.dateKey.split('-').map(Number);
          const bsDate = convertAdToBs(adY, adM - 1, adD);
          if (bsDate?.year) targetYear = bsDate.year;
        } catch (e) {
          /* keep currentBsYear */
        }
      }

      // For yearly events: collect ALL matches from multiple years and pick
      // the nearest future date. This is critical because currentBsYear might be
      // stale (cached from first render) or the tithi year assignment might differ.
      if (event.repetition === 'yearly') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const candidates = [];
        // Try primary year and ±1, ±2 for robustness
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
          // Prefer the nearest future date, then nearest past date
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

      // For non-yearly events (repetition: 'none'), try the primary year only
      const key = `${pakshaNepali}||${tithiName}||${targetYear}||${expectedMonth}`;
      const found = tithiDateLookup.get(key);
      if (found !== undefined) {
        return getTithiEventDisplayDate(found.startDate, found.startTime);
      }

      // Defensive fallback: return the stored dateKey so the event still appears
      return event.dateKey || null;
    },
    [currentBsYear, tithiDateLookup]
  );

  return resolveEventDate;
}
