import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { padDateKey } from '../utils/calendarHelpers';

/**
 * Parses a Firestore tithis snapshot into a dateKey → tithis[] map.
 * Shared between the real-time listener and the manual refresh path.
 */
function parseTithisSnapshot(docs) {
  const tithisData = {};
  docs.forEach((docSnap) => {
    const tithi = { id: docSnap.id, ...(typeof docSnap.data === 'function' ? docSnap.data() : docSnap) };

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
          tithiMonth: tithi.tithiMonth || null,
          tithiYear: tithi.tithiYear || null,
          pakshya: tithi.pakshya || null,
          tithiName: tithi.tithiName || null,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Legacy support: if no date range, use old dateKey field
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
  return tithisData;
}

/**
 * Shared hook that listens to the TITHIS Firestore collection in real-time
 * and returns a { dateKey: tithi[] } map.
 *
 * Used by both NepaliCalendar (for day card rendering) and
 * useTithiDateResolver (for resolving tithi-based event dates).
 * Eliminates the duplicate Firestore listener that previously existed.
 *
 * @returns {{ tithisByDate: Object, refreshTithis: Function }}
 */
export function useTithisData() {
  const [tithisByDate, setTithisByDate] = useState({});

  // Real-time listener for tithis collection
  useEffect(() => {
    const tithisCollection = collection(db, COLLECTIONS.TITHIS);
    const q = query(tithisCollection, orderBy('startDate'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTithisByDate(parseTithisSnapshot(snapshot.docs));
    }, (error) => {
      console.error('[useTithisData] Tithis onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, []);

  // Manual refresh (used by NepaliCalendar after admin edits)
  const refreshTithis = useCallback(async () => {
    try {
      const tithisCollection = collection(db, COLLECTIONS.TITHIS);
      const q = query(tithisCollection, orderBy('startDate'));
      const snapshot = await getDocs(q);
      setTithisByDate(parseTithisSnapshot(snapshot.docs));
    } catch (error) {
      console.error('[useTithisData] Manual refresh error:', error);
    }
  }, []);

  return { tithisByDate, refreshTithis };
}
