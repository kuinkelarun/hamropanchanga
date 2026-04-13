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
import { parseTithiName, padDateKey } from '../utils/calendarHelpers';

/**
 * Custom hook that listens to the TITHIS Firestore collection and provides
 * a function to resolve the AD date for a tithi-based calendar event.
 *
 * Usage:
 *   const resolveEventDate = useTithiDateResolver();
 *   const adDate = resolveEventDate(event); // "2026-03-22" or null
 *
 * The returned resolver handles:
 *   - Tithi events (repetition: 'none' or 'yearly') → resolves via tithiDateLookup
 *   - Non-tithi events → returns event.dateKey as-is
 *   - Monthly tithi events → returns event.dateKey (monthly display handled separately)
 *   - Missing tithi data → returns null (tithi not yet in DB)
 */
export function useTithiDateResolver() {
  const [tithisByDate, setTithisByDate] = useState({});

  // Real-time listener for tithis collection (same as NepaliCalendar.js)
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
              startTime: tithi.startTime,
              endTime: tithi.endTime,
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

  // Build the lookup map: "pakshya||tithiName||year||month" → AD start date string
  const tithiDateLookup = useMemo(() => {
    const map = new Map();
    const seen = new Set();

    Object.values(tithisByDate).forEach((tithisArr) => {
      tithisArr.forEach((t) => {
        if (!t.startDate || !t.name) return;
        const dedupeKey = (t.id || '') + '|' + t.startDate + '|' + t.name;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const { tithiMonth: parsedMonth, pakshya, tithi: tithiName } = parseTithiName(t.name);
        if (!pakshya || !tithiName) return;

        const pakshaEn = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
        const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
        if (!tithiIndex) return;

        // For legacy 2-part tithi names (no month prefix), compute the lunar
        // month from the tithi's startDate using astronomical calculation.
        const lunarMonth = parsedMonth || getTithiLunarMonthName(pakshaEn, tithiIndex, t.startDate);
        if (!lunarMonth) return;

        const { tithiYear } = getTithiYearFromAdDate(t.startDate, null, pakshaEn, tithiIndex);
        if (!tithiYear) return;

        const key = `${pakshya}||${tithiName}||${tithiYear}||${lunarMonth}`;
        if (!map.has(key)) {
          map.set(key, t.startDate);
        }
      });
    });
    return map;
  }, [tithisByDate]);

  // Derive current BS year from today's date
  const currentBsYear = useMemo(() => {
    const now = new Date();
    const bs = convertAdToBs(now.getFullYear(), now.getMonth(), now.getDate());
    return bs?.year || 2082;
  }, []);

  // Resolve the live AD dateKey for a tithi-based calendar event.
  //   Returns a date string → tithi present, show event on that day
  //   Returns null          → tithi absent/deleted, hide event
  //   Returns event.dateKey → non-tithi or monthly events
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

      // For one-time (none) events derive the target year from stored dateKey if present;
      // otherwise fall back to currentBsYear.
      // For yearly events, try currentBsYear, currentBsYear+1, and currentBsYear-1 to
      // handle the Chaitra/Vaishakh year boundary — Vaishakh (month 1) tithis belong to
      // the NEXT BS year when today is near the end of the current BS year.
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

      const key = `${pakshaNepali}||${tithiName}||${targetYear}||${expectedMonth}`;
      const found = tithiDateLookup.get(key);
      if (found !== undefined) return found;

      // For yearly events: try adjacent years to handle year boundary
      if (event.repetition === 'yearly') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Try next year — picks up Vaishakh tithis when we're still in Chaitra
        const keyNext = `${pakshaNepali}||${tithiName}||${targetYear + 1}||${expectedMonth}`;
        const foundNext = tithiDateLookup.get(keyNext);

        // Try previous year — fallback
        const keyPrev = `${pakshaNepali}||${tithiName}||${targetYear - 1}||${expectedMonth}`;
        const foundPrev = tithiDateLookup.get(keyPrev);

        // Prefer the nearest future date
        const candidates = [];
        if (foundNext) candidates.push(foundNext);
        if (foundPrev) candidates.push(foundPrev);

        if (candidates.length > 0) {
          // Pick the one closest to (and preferably >= ) today
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

      return null;
    },
    [currentBsYear, tithiDateLookup]
  );

  return resolveEventDate;
}
