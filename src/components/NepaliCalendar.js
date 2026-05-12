import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, query, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import { useLanguage } from '../contexts/LanguageContext';
import './NepaliCalendar.css';
import ConfirmModal from './ConfirmModal';

import {
  getTithiLunarMonthName,
  getTithiIndexByName,
  getTithiYearFromAdDate,
  convertAdToBs,
  convertBsToAd,
  setCalendarDataOverride,
  getActiveCalendarData,
  minBsYear,
  maxBsYear,
} from '../utils/nepaliDateUtils';
import {
  NEPALI_MONTHS as nepaliMonths,
  ENGLISH_MONTHS as englishMonths,
  ENGLISH_MONTHS_NEPALI as englishMonthsNepali,
  ENGLISH_NEPALI_MONTHS as englishNepaliMonths,
  NEPALI_WEEKDAYS as nepaliWeekdays,
  ENGLISH_WEEKDAYS as englishWeekdays,
  TIME_PERIODS as timePeriods,
  normalizePakshaToNepali,
  normalizePakshaToEnglish,
} from '../constants/calendarConstants';
import {
  toNepaliNumber,
  getNepalDate,
  formatTime12Hour,
  parseTithiName,
  getEnglishTithiName,
  getEnglishPakshyaName,
  compareTithisByStart,
  dateKeyFromAd,
  getTithiEventDisplayDate,
  formatTithiForDisplay,
} from '../utils/calendarHelpers';
import { useTithisData } from '../hooks/useTithisData';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import AddEventModal from './calendar/AddEventModal';
import AddTithiModal from './calendar/AddTithiModal';
import DayDetailsModal from './calendar/DayDetailsModal';

// getCalendarData: delegates to getActiveCalendarData (Firestore once loaded, bsCalendarData as fallback)
const getCalendarData = (year) => getActiveCalendarData()[year];

// Note: AD↔BS conversions are centralized in nepaliDateUtils to ensure
// consistent, Nepal-time-based handling across the app. We import and use
// convertAdToBs / convertBsToAd from there instead of maintaining a
// separate implementation here.

export default function NepaliCalendar({ user: propUser, isAdmin, trees = [], treeMembers = [], onTreeEventClick, sharedTreeIds = [] }) {
  const { t, tn, isNepali } = useLanguage();
  const isDev = process.env.NODE_ENV !== 'production';
  const [user, setUser] = useState(propUser || null);
  const [authLoading, setAuthLoading] = useState(!propUser);
  // Track "today" in Nepal timezone and update daily so the topbar reflects the real current Nepali month/year
  const [todayAd, setTodayAd] = useState(() => getNepalDate());
  const [todayBs, setTodayBs] = useState(() => convertAdToBs(todayAd.getUTCFullYear(), todayAd.getUTCMonth(), todayAd.getUTCDate()));

  // Keep todayAd/todayBs in sync with the real current time.
  // Update every second to show accurate time in the header
  useEffect(() => {
    const updateTime = () => {
      const nowAd = getNepalDate();
      setTodayAd(nowAd);
      const bs = convertAdToBs(nowAd.getUTCFullYear(), nowAd.getUTCMonth(), nowAd.getUTCDate());
      
      // Only update todayBs if the day has actually changed to avoid unnecessary effect triggers
      setTodayBs(prevBs => {
        if (prevBs.year === bs.year && prevBs.month === bs.month && prevBs.day === bs.day) {
          return prevBs;
        }
        return bs;
      });
    };

    // Update immediately and then every second
    updateTime();
    const intervalId = setInterval(updateTime, 1000);

    return () => clearInterval(intervalId);
  }, [isDev]);

  const [currentBsYear, setCurrentBsYear] = useState(() => todayBs.year);
  const [currentBsMonth, setCurrentBsMonth] = useState(() => todayBs.month);
  // Shared tithis data — single Firestore listener used by both calendar and event resolver
  const { tithisByDate, refreshTithis } = useTithisData();
  // Calendar events loaded via shared hook — handles all auth modes and event merging
  const { calendarEvents, setCalendarEvents } = useCalendarEvents({ user, authLoading, isAdmin, sharedTreeIds });
  const [activeDate, setActiveDate] = useState(null);
  const [firestoreCalReady, setFirestoreCalReady] = useState(false);

  // Permissions
  const { hasPermission, loading: permsLoading, isSuperUser } = useUserPermissions(user);
  const canManageTithis = isAdmin || (!permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS));

  // Calendar-only transition state and direction
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false);
  const transitionMs = 900;
  const triggerMonthTransition = useCallback((applyChange) => {
    if (isMonthTransitioning) return;
    setIsMonthTransitioning(true);
    setTimeout(() => { applyChange(); }, transitionMs * 0.45);
    setTimeout(() => { setIsMonthTransitioning(false); }, transitionMs);
  }, [isMonthTransitioning]);

  // Modal states - separate details and add tithi modals
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [addTithiModalOpen, setAddTithiModalOpen] = useState(false);
  const [modalFocusHint, setModalFocusHint] = useState(null);

  // Tithis data is now loaded via the shared useTithisData hook above.
  // This eliminates the duplicate Firestore listener that was previously here.

  // Load Nepali calendar configuration from Firestore — sets it as the active calendar data
  // (bsCalendarData.js acts as fallback until this completes)
  useEffect(() => {
    const loadCalendarConfiguration = async () => {
      try {
        const calendarYearsSnapshot = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
        if (calendarYearsSnapshot.empty) {
          if (isDev) console.log('No calendar years found in Firestore, using bsCalendarData fallback');
          setFirestoreCalReady(true);
          return;
        }

        // Build a fresh data map from Firestore documents
        const firestoreCalData = {};
        calendarYearsSnapshot.docs.forEach((docSnap) => {
          const year = parseInt(docSnap.id);
          if (isNaN(year)) return;
          const data = docSnap.data();

          // Convert startAdDate string to Date without timezone offset
          let startAdDate = data.startAdDate;
          if (typeof startAdDate === 'string') {
            const [dateYear, dateMonth, dateDay] = startAdDate.split('-');
            startAdDate = new Date(parseInt(dateYear), parseInt(dateMonth) - 1, parseInt(dateDay));
          }

          firestoreCalData[year] = {
            startAdDate,
            daysInMonths: data.daysInMonths || []
          };

          if (isDev) console.log(`Loaded calendar year ${year} from Firestore`);
        });

        // Push the Firestore data into nepaliDateUtils as the single source of truth
        setCalendarDataOverride(firestoreCalData);
        setFirestoreCalReady(true);
      } catch (error) {
        if (error.message && error.message.includes('permission')) {
          if (isDev) console.log('No permission to read nepaliCalendarYears collection — using bsCalendarData fallback');
        } else {
          if (isDev) console.log('Calendar configuration load error (using bsCalendarData fallback):', error.message);
        }
        setFirestoreCalReady(true); // still mark ready so UI doesn't stall
      }
    };

    loadCalendarConfiguration();
  }, [isDev]);

  // Authentication state listener - only set up if user not passed as prop
  useEffect(() => {
    if (propUser) {
      // User passed as prop, use it and mark auth as loaded
      setUser(propUser);
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Dev-only: optional permissions smoke test (do not block auth resolution)
        if (isDev) {
          void (async () => {
            try {
              const testCollection = collection(db, COLLECTIONS.TITHIS);
              const testQuery = query(testCollection, orderBy('startDate'), orderBy('startTime'));
              await getDocs(testQuery);
            } catch (permissionError) {
              console.error('Firestore permissions test: FAILED', permissionError);
            }
          })();
        }
      }
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [propUser, isDev]);

  // Sync user state when prop changes
  useEffect(() => {
    if (propUser !== undefined) {
      setUser(propUser);
      setAuthLoading(false);
    }
  }, [propUser]);

  // Calendar events are now loaded via the shared useCalendarEvents hook above.

  useEffect(()=>{
    if (currentBsYear < minBsYear) setCurrentBsYear(minBsYear);
    if (currentBsYear > maxBsYear) setCurrentBsYear(maxBsYear);
  }, [currentBsYear]);

  const nepaliMonthDays = useMemo(() => {
    return getCalendarData(currentBsYear)?.daysInMonths[currentBsMonth-1] ?? 30;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBsYear, currentBsMonth, firestoreCalReady]);

  const firstDayOfBsMonthAd = useMemo(() => {
    return convertBsToAd(currentBsYear, currentBsMonth, 1);
  }, [currentBsYear, currentBsMonth]);

  // Compute AD date for the last day of the current Nepali month so we can show an AD range
  // when the Nepali month spans two AD months (e.g., October/November 2025)
  const lastDayOfBsMonthAd = useMemo(() => {
    const lastDay = nepaliMonthDays;
    return convertBsToAd(currentBsYear, currentBsMonth, lastDay);
  }, [currentBsYear, currentBsMonth, nepaliMonthDays]);

  const adMonthRangeDisplay = useMemo(() => {
    const start = firstDayOfBsMonthAd;
    const end = lastDayOfBsMonthAd;
    if (!start) return '';
    
    // Use translated month names based on language
    const monthNames = isNepali ? englishMonthsNepali : englishMonths;
    
    if (!end) return `${monthNames[start.month ?? 0]} ${isNepali ? tn(start.year ?? '') : (start.year ?? '')}`;
    const sMon = start.month; const eMon = end.month;
    const sYr = start.year; const eYr = end.year;
    
    // Format years with Nepali numerals if language is Nepali
    const sYrDisplay = isNepali ? tn(sYr) : sYr;
    const eYrDisplay = isNepali ? tn(eYr) : eYr;
    
    if (sMon === eMon && sYr === eYr) return `${monthNames[sMon]} ${sYrDisplay}`;
    if (sYr === eYr) return `${monthNames[sMon]}/${monthNames[eMon]} ${sYrDisplay}`;
    return `${monthNames[sMon]} ${sYrDisplay} / ${monthNames[eMon]} ${eYrDisplay}`;
  }, [firstDayOfBsMonthAd, lastDayOfBsMonthAd, isNepali, tn]);

  const startDayOfWeek = useMemo(() => {
    if (!firstDayOfBsMonthAd) return 0;
    return new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day).getDay();
  }, [firstDayOfBsMonthAd]);

  // Robust lookup for tithis: try common dateKey formats (no padding and zero-padded)
  const findTithisForAdDate = useCallback((adYear, adMonthZeroBased, adDay) => {
    const y = adYear;
    const m = adMonthZeroBased + 1;
    const d = adDay;
    const keysToTry = [
      `${y}-${m}-${d}`,
      `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
      `${y}-${String(m).padStart(2,'0')}-${d}`,
      `${y}-${m}-${String(d).padStart(2,'0')}`
    ];
    for (const k of keysToTry) {
      if (tithisByDate[k]) return tithisByDate[k];
    }
    return tithisByDate[`${y}-${m}-${d}`] || [];
  }, [tithisByDate]);

  // refreshTithis is now provided by the shared useTithisData hook.

  const [confirmOpen, setConfirmOpen] = useState(false);

  const proceedGoToToday = useCallback(async () => {
    // Close modals to avoid leftover UI
    setAddTithiModalOpen(false);
    setDetailsModalOpen(false);
    setModalFocusHint(null);

    // Move view to today's Nepali month/year and refresh tithis
    setCurrentBsYear(todayBs.year);
    setCurrentBsMonth(todayBs.month);
    try { await refreshTithis(); } catch (e) { /* ignore refresh errors */ }
    setActiveDate(null);
    setConfirmOpen(false);
  }, [refreshTithis, todayBs]);

  // Navigate to the current Nepali month/year (today)
  const handleGoToToday = useCallback(async () => {
    // If user has open modals / pending edits, open app modal to confirm
    if (addTithiModalOpen || detailsModalOpen) {
      setConfirmOpen(true);
      return;
    }
    // Otherwise proceed immediately
    await proceedGoToToday();
  }, [addTithiModalOpen, detailsModalOpen, proceedGoToToday]);

  // Debug function to check what's actually in Firestore
  // eslint-disable-next-line no-unused-vars
  const debugFirestore = useCallback(async () => {
    if (!isDev) return;
    try {
      console.log('=== FIRESTORE DEBUG CHECK ===');
      const tithisCollection = collection(db, COLLECTIONS.TITHIS);
      const q = query(tithisCollection, orderBy('dateKey'));
      const snapshot = await getDocs(q);
      
      console.log('Total documents in Firestore:', snapshot.docs.length);
      snapshot.docs.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, { id: doc.id, ...doc.data() });
      });
      console.log('=== END DEBUG CHECK ===');
    } catch (error) {
      console.error('Debug check failed:', error);
    }
  }, [isDev]);

  function handlePrev(){
    let m = currentBsMonth - 1;
    let y = currentBsYear;
    if (m < 1) { m = 12; y -= 1; }
    setCurrentBsMonth(m); setCurrentBsYear(y);
  }
  function handleNext(){
    let m = currentBsMonth + 1;
    let y = currentBsYear;
    if (m > 12) { m = 1; y += 1; }
    setCurrentBsMonth(m); setCurrentBsYear(y);
  }

  // Helper functions to compute previous/next Nepali month names
  function getPrevMonthName(){
    let m = currentBsMonth - 1;
    if (m < 1) { m = 12; }
    const monthArray = isNepali ? nepaliMonths : englishNepaliMonths;
    return monthArray[m-1] || '';
  }
  function getNextMonthName(){
    let m = currentBsMonth + 1;
    if (m > 12) { m = 1; }
    const monthArray = isNepali ? nepaliMonths : englishNepaliMonths;
    return monthArray[m-1] || '';
  }

  // open details modal when clicking on tile
  function openDetailsModalForDate(adYear, adMonthZeroBased, adDay){
    // Use a consistently padded YYYY-MM-DD key
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    setDetailsModalOpen(true);
  }

  // open add tithi modal from + button or details modal
  function openAddTithiModalForDate(adYear, adMonthZeroBased, adDay, focusHint = null){
    if (isDev) console.log('openAddTithiModalForDate called with:', { adYear, adMonthZeroBased, adDay });
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    setModalFocusHint(focusHint);
    setDetailsModalOpen(false);
    setAddTithiModalOpen(true);
  }

  // open add event modal from + button or details modal
  function openAddEventModalForDate(adYear, adMonthZeroBased, adDay){
    if (isDev) console.log('openAddEventModalForDate called with:', { adYear, adMonthZeroBased, adDay });
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    setDetailsModalOpen(false);
    setAddEventModalOpen(true);
  }

  async function addTithi(dateKey, name, startDate, startTime='', endDate, endTime=''){
    if (isDev) console.log('addTithi called with:', { dateKey, name, startDate, startTime, endDate, endTime, user: !!user });

    if (!user) {
      throw new Error('Please log in to add tithis.');
    }

    // Parse the incoming name (may be 2-part or 3-part)
    const parsed = parseTithiName(name);
    let tithiMonth = parsed.tithiMonth || '';
    let tithiYear = null;

    // If tithiMonth is not in the name, compute it from the start date
    if (!tithiMonth && parsed.pakshya && parsed.tithi && startDate) {
      const pakshaEn = normalizePakshaToEnglish(parsed.pakshya);
      const tIdx = getTithiIndexByName(parsed.tithi, { fallbackToOne: false });
      if (tIdx) {
        tithiMonth = getTithiLunarMonthName(pakshaEn, tIdx, startDate) || '';
        const yearInfo = getTithiYearFromAdDate(startDate, null, pakshaEn, tIdx);
        tithiYear = yearInfo.tithiYear || null;
      }
    }

    // Build 3-part name: "month pakshya tithi"
    const fullName = tithiMonth
      ? `${tithiMonth} ${parsed.pakshya} ${parsed.tithi}`
      : `${parsed.pakshya} ${parsed.tithi}`;

    const tempId = crypto.randomUUID(); // Generate temporary ID for optimistic update
    try {
      // Create the new tithi object with date range
      const newTithi = {
        id: tempId,
        name: fullName,
        tithiMonth: tithiMonth || '',
        tithiYear: tithiYear || null,
        pakshya: parsed.pakshya || '',
        tithiName: parsed.tithi || '',
        startDate: startDate, // YYYY-MM-DD format
        startTime: startTime,
        endDate: endDate, // YYYY-MM-DD format
        endTime: endTime,
        createdAt: new Date().toISOString()
      };

      // Calculate all dates this tithi spans (inclusive)
      const affectedDates = [];
      const startDateObj = new Date(startDate + 'T00:00:00');
      const endDateObj = new Date(endDate + 'T00:00:00');
      
      const currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // 1-12
        const day = currentDate.getDate();
  const dateKeyForDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        affectedDates.push(dateKeyForDate);
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Tithi spans dates:', affectedDates);
      }

      // tithisByDate auto-refreshes via the shared useTithisData onSnapshot listener.

      // Then sync to Firebase
      if (process.env.NODE_ENV !== 'production') {
        console.log('Syncing to Firestore...');
        console.log('User authenticated:', !!user);
      }
      
      // Create data for Firestore (without the temporary ID)
      const tithiData = {
        name: newTithi.name,
        tithiMonth: newTithi.tithiMonth,
        tithiYear: newTithi.tithiYear,
        pakshya: newTithi.pakshya,
        tithiName: newTithi.tithiName,
        startDate: newTithi.startDate,
        startTime: newTithi.startTime,
        endDate: newTithi.endDate,
        endTime: newTithi.endTime,
        createdAt: newTithi.createdAt
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Data to save:', tithiData);
      }
      
      const tithisCollection = collection(db, COLLECTIONS.TITHIS);
      const docRef = await addDoc(tithisCollection, tithiData);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Successfully added tithi to Firestore at', new Date().toLocaleTimeString(), 'with ID:', docRef.id);
      }
      
      // tithisByDate auto-refreshes via onSnapshot after the Firestore write.

    } catch (error) {
      console.error('Error adding tithi:', error);
      if (isDev) {
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error object:', error);
      }
      // Revert local state on error - remove from all affected dates
      const startDateObj = new Date(startDate + 'T00:00:00');
      const endDateObj = new Date(endDate + 'T00:00:00');
      const affectedDates = [];
      
      const currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
  const dateKeyForDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        affectedDates.push(dateKeyForDate);
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // tithisByDate auto-refreshes via onSnapshot — error state is naturally handled.
      throw error; // Re-throw so child component can display the error
    }
  }

  // eslint-disable-next-line no-unused-vars
  async function deleteTithi(dateKey, id){
    if (!user) {
      console.error('User not authenticated for delete operation');
      return;
    }

    // Store reference to the deleted tithi for potential rollback
    let affectedDates = [];
    
    try {
      // First, find the tithi to get its date range
      let tithiData = null;
      for (const key in tithisByDate) {
        const found = tithisByDate[key].find(t => t.id === id);
        if (found) {
          tithiData = found;
          break;
        }
      }

      if (!tithiData) {
        console.error('Tithi not found in local state');
        return;
      }

      // Calculate all dates the tithi spans
      if (tithiData.startDate && tithiData.endDate) {
        const startDateObj = new Date(tithiData.startDate + 'T00:00:00');
        const endDateObj = new Date(tithiData.endDate + 'T00:00:00');
        
        const currentDate = new Date(startDateObj);
        while (currentDate <= endDateObj) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          const day = currentDate.getDate();
          const dateKeyForDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          affectedDates.push(dateKeyForDate);
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Fallback: if no date range data, just use the single dateKey
        affectedDates = [dateKey];
      }

      if (isDev) console.log('Deleting tithi from dates:', affectedDates);

      // Delete from Firebase — tithisByDate auto-refreshes via onSnapshot
      await deleteDoc(doc(db, COLLECTIONS.TITHIS, id));
      if (isDev) console.log('Successfully deleted tithi from Firestore');
    } catch (error) {
      console.error('Error deleting tithi:', error);
    }
  }

  // Event modal visibility (form state is inside AddEventModal)
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);

  useEffect(() => {
    if (!addTithiModalOpen) {
      setModalFocusHint(null);
    }
    if (!detailsModalOpen && !addTithiModalOpen && !addEventModalOpen) {
      setActiveDate(null); // Clear active tile when all modals are closed
    }
  }, [addTithiModalOpen, detailsModalOpen, addEventModalOpen]);



  // Synchronous lookup: (pakshaNepali || tithiName || bsYear || lunarMonth) → startDate.
  // Built entirely from the in-memory tithisByDate that is already kept live by onSnapshot.
  // No extra Firestore reads needed — automatically reflects any tithi add/edit/delete.
  const tithiDateLookup = useMemo(() => {
    const map = new Map();
    const seen = new Set(); // deduplicate: a multi-day tithi appears in many dateKey buckets

    Object.values(tithisByDate).forEach(tithisArr => {
      tithisArr.forEach(t => {
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

        const pakshaEn = (pakshya === 'शुक्लपक्ष') ? 'Shukla' : 'Krishna';
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
    return map;
  }, [tithisByDate]);

  // Resolve the live AD dateKey for a tithi-based event using the in-memory lookup.
  //   Returns a date string  → tithi present, show event on that day
  //   Returns null           → tithi absent/deleted, hide event
  const getResolvedTithiEventDate = useCallback((event) => {
    if (!event.tithi || event.repetition === 'monthly') {
      return event.dateKey; // monthly handled live; non-tithi events keep stored dateKey
    }

    const pakshaNepali = normalizePakshaToNepali(event.tithi.paksha);
    const tithiName = event.tithi.name;
    let expectedMonth = event.tithi.month;
    if (typeof expectedMonth === 'number') {
      expectedMonth = nepaliMonths[expectedMonth - 1];
    }

    // For one-time (none) events derive the target year from the stored dateKey if present;
    // otherwise fall back to currentBsYear.
    // For yearly events, try both currentBsYear and currentBsYear+1 to handle the
    // Chaitra/Vaishakh year boundary — Vaishakh (month 1) tithis belong to the NEXT
    // BS year when the calendar is viewing the last months of the current year.
    let targetYear = currentBsYear;
    if (event.repetition === 'none' && event.dateKey) {
      try {
        const [adY, adM, adD] = event.dateKey.split('-').map(Number);
        const bsDate = convertAdToBs(adY, adM - 1, adD);
        if (bsDate?.year) targetYear = bsDate.year;
      } catch (e) { /* keep currentBsYear */ }
    }

    const key = `${pakshaNepali}||${tithiName}||${targetYear}||${expectedMonth}`;
    const found = tithiDateLookup.get(key);
    if (found !== undefined) {
      return getTithiEventDisplayDate(found.startDate, found.startTime);
    }

    // For yearly events: try the next BS year as well (handles Vaishakh at year boundary)
    if (event.repetition === 'yearly') {
      const keyNext = `${pakshaNepali}||${tithiName}||${targetYear + 1}||${expectedMonth}`;
      const foundNext = tithiDateLookup.get(keyNext);
      if (foundNext !== undefined) {
        return getTithiEventDisplayDate(foundNext.startDate, foundNext.startTime);
      }
      // Also try previous year (when user navigates forward past the boundary)
      const keyPrev = `${pakshaNepali}||${tithiName}||${targetYear - 1}||${expectedMonth}`;
      const foundPrev = tithiDateLookup.get(keyPrev);
      if (foundPrev !== undefined) {
        return getTithiEventDisplayDate(foundPrev.startDate, foundPrev.startTime);
      }
    }

    return null; // tithi absent, hide event
  }, [currentBsYear, tithiDateLookup]);

  // Helper function to get events for a specific date
  const getEventsForDate = useCallback((adYear, adMonthZeroBased, adDay) => {
    const dateKey = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    const targetTithis = findTithisForAdDate(adYear, adMonthZeroBased, adDay) || [];
    
    // Convert current AD date to Nepali for comparison
    const currentBsDate = convertAdToBs(adYear, adMonthZeroBased, adDay);
    
    return calendarEvents.filter(event => {
      // For tithi-based events resolve live from tithiDateLookup.
      // null  → tithi not in DB (deleted or not yet added) → hide event.
      // monthly tithi events use the live tithisByDate match in section 2A below.
      // yearly tithi events are handled EXCLUSIVELY by section 2A (live tithi recurrence)
      // to avoid double-matching across years — skip the resolved dateKey exact match.
      let eventDateKeyToMatch = event.dateKey;
      if (event.tithi && event.repetition === 'none') {
        const resolved = getResolvedTithiEventDate(event);
        if (resolved === null || resolved === undefined) return false;
        eventDateKeyToMatch = resolved;
      } else if (event.tithi && event.repetition === 'yearly') {
        // For yearly tithi events, verify the tithi exists in DB for ANY year.
        // The exact date matching is handled by section 2A below.
        const resolved = getResolvedTithiEventDate(event);
        if (resolved === null || resolved === undefined) return false;
        // Do NOT set eventDateKeyToMatch — fall through to section 2A
        eventDateKeyToMatch = null;
      }

      // 1. Exact Date Match (skipped for yearly tithi events where eventDateKeyToMatch is null)
      if (eventDateKeyToMatch && eventDateKeyToMatch === dateKey) {
        return true;
      }
      
      // 2. Recurrence Logic
      if (event.repetition === 'monthly' || event.repetition === 'yearly') {
        
        // A. Tithi-based Recurrence
        if (event.tithi) {
          // Check if any tithi on this day matches the event's tithi,
          // applying the 12:30 PM cutoff so the event shows on exactly one day.
          return targetTithis.some(t => {
            const { pakshya: tPaksha, tithi: tName } = parseTithiName(t.name);

            // Adhika Maas suppression: skip Adhika tithis unless the event explicitly opts in
            const isAdhika = t.indicatorNepali === 'अधिक' ||
              (t.indicatorEnglish && t.indicatorEnglish.toLowerCase().startsWith('adhik'));
            if (isAdhika && event.showInAdhika !== true) return false;
            if (!isAdhika && event.showInAdhika === true) return false;

            // Match Paksha and Tithi Name
            const eventPakshaNepali = normalizePakshaToNepali(event.tithi.paksha);
            if (tPaksha !== eventPakshaNepali) return false;
            
            const eventTithiIndex = getTithiIndexByName(event.tithi.name, { fallbackToOne: false });
            const currentTithiIndex = getTithiIndexByName(tName, { fallbackToOne: false });

            if (!eventTithiIndex || !currentTithiIndex) return false;
            if (eventTithiIndex !== currentTithiIndex) return false;
            
            // Apply 12:30 PM cutoff: the event should appear on the tithi's display date only
            const displayDate = getTithiEventDisplayDate(t.startDate, t.startTime);
            if (displayDate !== dateKey) return false;

            // If Monthly, we are done (matches Paksha + Tithi + display date)
            if (event.repetition === 'monthly') return true;
            
            // If Yearly, check Tithi Month
            if (event.repetition === 'yearly') {
              let eventMonthName = event.tithi.month;
              if (typeof eventMonthName === 'number') {
                eventMonthName = nepaliMonths[eventMonthName - 1];
              }
              // Use the tithi's stored lunar month — NOT the BS calendar month of the current day.
              // Tithis routinely cross BS month boundaries.
              if (t.tithiMonth) {
                return t.tithiMonth === eventMonthName;
              }
              // Fallback for legacy tithis without a stored month
              const computedMonth = getTithiLunarMonthName(event.tithi.paksha, eventTithiIndex, t.startDate);
              return computedMonth === eventMonthName;
            }
            
            return false;
          });
        }
        
        // B. Solar Date Recurrence (if no tithi info)
        // IMPORTANT: For yearly/monthly recurrence, use Nepali dates if available, otherwise fallback to AD dates
        if (event.nepaliDateForRecurrence && event.nepaliDateForRecurrence.month && event.nepaliDateForRecurrence.day) {
          // This event was saved with a Nepali date and wants Nepali-based recurrence
          const origNepaliMonth = event.nepaliDateForRecurrence.month;
          const origNepaliDay = event.nepaliDateForRecurrence.day;
          
          if (event.repetition === 'yearly') {
            // Match on Nepali month and day, but allow any year
            const matches = currentBsDate.month === origNepaliMonth && currentBsDate.day === origNepaliDay;
            if (isDev && matches) {
              console.log(`  ✓ Yearly Nepali match: "${event.title}" (Nepali ${origNepaliMonth}/${origNepaliDay})`);
            }
            return matches;
          }
          
          if (event.repetition === 'monthly') {
            // Match every 30 days from the original date
            const eventDateParts = event.dateKey.split('-').map(Number);
            const eventDate = new Date(eventDateParts[0], eventDateParts[1] - 1, eventDateParts[2]);
            const currentDate = new Date(adYear, adMonthZeroBased, adDay);
            const daysDiff = Math.floor((currentDate - eventDate) / (1000 * 60 * 60 * 24));
            const matches = daysDiff >= 0 && daysDiff % 30 === 0;
            if (isDev && matches) {
              console.log(`  ✓ Monthly 30-day match: "${event.title}" (${daysDiff} days from original)`);
            }
            return matches;
          }
        } else {
          // Fallback: Use the original AD date from dateKey (for events created before nepaliDateForRecurrence was added)
          const eventDateParts = event.dateKey.split('-').map(Number);
          const eventDay = eventDateParts[2];
          const eventMonth = eventDateParts[1];
          
          if (event.repetition === 'monthly') {
            // Match every 30 days from the original date
            const eventDate = new Date(eventDateParts[0], eventDateParts[1] - 1, eventDateParts[2]);
            const currentDate = new Date(adYear, adMonthZeroBased, adDay);
            const daysDiff = Math.floor((currentDate - eventDate) / (1000 * 60 * 60 * 24));
            const matches = daysDiff >= 0 && daysDiff % 30 === 0;
            if (isDev && matches) {
              console.log(`  ✓ Monthly AD fallback 30-day match: "${event.title}" (${daysDiff} days from original)`);
            }
            return matches;
          }
          
          if (event.repetition === 'yearly') {
            const matches = adDay === eventDay && (adMonthZeroBased + 1) === eventMonth;
            if (isDev && matches) {
              console.log(`  ✓ Yearly AD fallback: "${event.title}" (${eventMonth}/${eventDay})`);
            }
            return matches;
          }
        }
      }
      
      return false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEvents, findTithisForAdDate]);

  // Helper function to get tree member name
  const getTreeMemberName = useCallback((treeId, memberId) => {
    if (!memberId || !treeMembers) return null;
    const member = treeMembers.find(m => m.id === memberId && (!treeId || m.treeId === treeId));
    return member ? member.name : null;
  }, [treeMembers]);

  // Helper function to categorize events by type
  const categorizeEvents = useCallback((events) => {
    const publicEvents = [];
    const personalEvents = [];
    
    events.forEach(event => {
      if (event.isPublic) {
        // Explicitly marked as public
        publicEvents.push(event);
      } else if (event.createdBy === user?.uid || (event.treeId && sharedTreeIds.includes(event.treeId))) {
        // Created by current user OR from a tree explicitly shared with this user
        personalEvents.push(event);
      }
      // Events not marked public and not created by current user and not from a shared tree are hidden
    });
    
    return { publicEvents, personalEvents };
  }, [user, sharedTreeIds]);

  // Helper function to format event title with tithi information
  const formatEventWithTithi = useCallback((event) => {
    let display = event.title;
    if (event.tithi) {
      const tithiStr = formatTithiForDisplay(event.tithi, isNepali);
      if (tithiStr) display += ` (${tithiStr})`;
    }
    return display;
  }, [isNepali]);

  // Helper function to get tithi display name with lunar month
  const getTithiDisplayName = (tithi) => {
    const { tithiMonth: parsedMonth, pakshya, tithi: tithiName } = parseTithiName(tithi.name);
    const indicator = isNepali ? (tithi.indicatorNepali || '') : (tithi.indicatorEnglish || '');
    const indicatorPrefix = indicator ? `${indicator} ` : '';

    if (!tithi.startDate) {
      return `${indicatorPrefix}${tithi.name}`; // Fallback if no date
    }
    
    // Prefer stored tithiMonth from Firestore doc, then parsed from name, then compute
    let lunarMonth = tithi.tithiMonth || parsedMonth || '';
    
    if (!lunarMonth) {
      // Compute the tithi lunar month for the start date
      const pakshaNormalized = normalizePakshaToEnglish(pakshya);
      const tithiIndex = getTithiIndexByName(tithiName);
      if (tithiIndex) {
        lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
      }
    }

    if (lunarMonth) {
      const monthIndex = nepaliMonths.indexOf(lunarMonth);
      const monthDisplay = monthIndex !== -1 
        ? (isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex])
        : lunarMonth;
      const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
      const tithiDisplay = isNepali ? tithiName : getEnglishTithiName(tithiName);
      return `${indicatorPrefix}${monthDisplay} ${pakshyaDisplay} ${tithiDisplay}`;
    }
    
    return `${indicatorPrefix}${tithi.name}`; // Fallback to original name if calculation fails
  };

  // Helper function to format tithi datetime display
  const formatTithiDateTime = (tithi) => {
    if (!tithi.startDate && !tithi.endDate) {
      return `${formatTime12Hour(tithi.startTime, isNepali, tn)} — ${formatTime12Hour(tithi.endTime, isNepali, tn)}`;
    }

    // Parse start and end dates
    const [startY, startM, startD] = tithi.startDate.split('-').map(Number);
    const [endY, endM, endD] = tithi.endDate.split('-').map(Number);
    
    // Convert to Nepali dates
    const startBs = convertAdToBs(startY, startM - 1, startD);
    const endBs = convertAdToBs(endY, endM - 1, endD);
    
    // Get month names based on language
    const startMonth = isNepali ? nepaliMonths[startBs.month - 1] : englishNepaliMonths[startBs.month - 1];
    const endMonth = isNepali ? nepaliMonths[endBs.month - 1] : englishNepaliMonths[endBs.month - 1];
    
    // Format start date-time with conditional number formatting based on language
    const startDateStr = `${startMonth} ${isNepali ? toNepaliNumber(startBs.day) : startBs.day}, ${isNepali ? toNepaliNumber(startBs.year) : startBs.year}`;
    const endDateStr = `${endMonth} ${isNepali ? toNepaliNumber(endBs.day) : endBs.day}, ${isNepali ? toNepaliNumber(endBs.year) : endBs.year}`;
    
    // Always show full date-time format for consistency with 12-hour time
    // Format: "कार्तिक २७, २०८२, 6:00 AM — कार्तिक २८, २०८२, 6:00 PM"
    return `${startDateStr}, ${formatTime12Hour(tithi.startTime, isNepali, tn)} — ${endDateStr}, ${formatTime12Hour(tithi.endTime, isNepali, tn)}`;
}

  // Format tithi display for calendar day cards with paksha information
  // Handles edge cases where paksha changes within the same day
  const formatTithiForDayCard = (sortedParsedTithis) => {
    if (sortedParsedTithis.length === 0) return '';

    // Helper: get indicator prefix for a single parsed tithi
    const getIndicator = (t) => {
      const ind = isNepali ? (t.indicatorNepali || '') : (t.indicatorEnglish || '');
      return ind ? `${ind} ` : '';
    };

    // If any tithi has an indicator, render each tithi individually (no grouping)
    const anyHasIndicator = sortedParsedTithis.some(t =>
      isNepali ? t.indicatorNepali : t.indicatorEnglish
    );

    if (anyHasIndicator) {
      return sortedParsedTithis
        .map(t => {
          const pakshyaDisplay = isNepali ? t.pakshya : getEnglishPakshyaName(t.pakshya);
          const tithiDisplay = isNepali ? t.tithi : getEnglishTithiName(t.tithi);
          return `${getIndicator(t)}${pakshyaDisplay} ${tithiDisplay}`;
        })
        .join(' / ');
    }
    
    if (sortedParsedTithis.length === 1) {
      const t = sortedParsedTithis[0];
      const pakshyaDisplay = isNepali ? t.pakshya : getEnglishPakshyaName(t.pakshya);
      const tithiDisplay = isNepali ? t.tithi : getEnglishTithiName(t.tithi);
      return `${pakshyaDisplay} ${tithiDisplay}`;
    }
    
    // Multiple tithis - check if paksha changes
    const pakshyaSet = new Set(sortedParsedTithis.map(t => t.pakshya));
    
    if (pakshyaSet.size === 1) {
      // Same paksha for all tithis: "कृष्णपक्ष पञ्चमी / षष्ठी"
      const pakshya = sortedParsedTithis[0].pakshya;
      const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
      const tithiNames = sortedParsedTithis
        .map(t => isNepali ? t.tithi : getEnglishTithiName(t.tithi))
        .join(' / ');
      return `${pakshyaDisplay} ${tithiNames}`;
    } else {
      // Paksha changes: "कृष्णपक्ष औंसी / शुक्लपक्ष प्रतिपदा"
      return sortedParsedTithis
        .map(t => {
          const pakshyaDisplay = isNepali ? t.pakshya : getEnglishPakshyaName(t.pakshya);
          const tithiDisplay = isNepali ? t.tithi : getEnglishTithiName(t.tithi);
          return `${pakshyaDisplay} ${tithiDisplay}`;
        })
        .join(' / ');
    }
  };

  function renderDayTiles(){
    const tiles = [];

    // --- 1. Previous Month's Days (show actual days and tithis using AD keys) ---
    if (firstDayOfBsMonthAd) {
      const firstAd = new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day);
      for (let i = startDayOfWeek; i > 0; i--) {
        const adDate = new Date(firstAd);
        adDate.setDate(firstAd.getDate() - i);

        // Convert AD -> BS to display BS day number
        const bsDate = convertAdToBs(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
        const displayDay = bsDate ? bsDate.day : adDate.getDate();

  const dateKey = dateKeyFromAd({ year: adDate.getFullYear(), month: adDate.getMonth(), day: adDate.getDate() });
  const tithis = findTithisForAdDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()) || [];
        const events = getEventsForDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()) || [];

        // Parse tithis
        const parsedTithis = tithis.map(t => ({
          ...t,
          ...parseTithiName(t.name)
        }));

        tiles.push(
          <div
            key={`${dateKey}-prev`}
            className="nt-day-tile other-month"
            onClick={() => { handlePrev(); openDetailsModalForDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()); }}
            tabIndex={0}
            onKeyDown={(e)=> { if (e.key === 'Enter') { handlePrev(); openDetailsModalForDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()); } }}
            data-date={dateKey}
          >
            <div className="nt-nepali-date">{isNepali ? toNepaliNumber(displayDay) : displayDay}</div>
            <div className="nt-english-date">{adDate.getDate()}</div>
            <div className="nt-summary" aria-hidden>
              {events.length > 0 && (
                <div className="nt-summary-item event">
                  {events.map(e => formatEventWithTithi(e)).join(' | ')}
                </div>
              )}
            </div>
            {parsedTithis.length > 0 && (
              <div className="nt-tithi-bottom" aria-hidden>
                {formatTithiForDayCard(parsedTithis.sort(compareTithisByStart))}
              </div>
            )}
          </div>
        );
      }
    }

    // --- 2. Current Month's Days ---
    for (let day=1; day<=nepaliMonthDays; day++){
  const ad = convertBsToAd(currentBsYear, currentBsMonth, day);
  const dateKey = dateKeyFromAd(ad);
      const isToday = todayBs.year === currentBsYear && todayBs.month === currentBsMonth && todayBs.day === day;
      const isActive = activeDate === dateKey;
  const tithis = findTithisForAdDate(ad.year, ad.month, ad.day) || [];
      const events = getEventsForDate(ad.year, ad.month, ad.day) || [];
      
      // Debug: Log tile rendering with dateKey and tithis
      // if (day <= 5 || tithis.length > 0 || events.length > 0) { // Only log first few days and days with content
      //   console.log(`Rendering tile for day ${day}:`, {
      //     dateKey,
      //     tithisCount: tithis.length,
      //     eventsCount: events.length,
      //     tithisNames: tithis.map(t => t.name),
      //     eventTitles: events.map(e => e.title)
      //   });
      // }

      // Parse tithis to separate pakshya and tithi names
      const parsedTithis = tithis.map(t => ({
        ...t,
        ...parseTithiName(t.name)
      }));

      tiles.push(
        <div
          key={dateKey}
          className={`nt-day-tile ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}`}
          onClick={()=> openDetailsModalForDate(ad.year, ad.month, ad.day)}
          tabIndex={0}
          onKeyDown={(e)=> { if (e.key === 'Enter') openDetailsModalForDate(ad.year, ad.month, ad.day); }}
          data-date={dateKey}
        >
          {canManageTithis && (
            <button
              className="nt-quick-add-btn"
              aria-label="Quick add tithi"
              title="Add Tithi"
              onClick={(e)=>{ e.stopPropagation(); openAddTithiModalForDate(ad.year, ad.month, ad.day, 'tithi'); }}
            >+</button>
          )}

          <div className="nt-nepali-date" aria-hidden>{isNepali ? toNepaliNumber(day) : day}</div>
          <div className="nt-english-date" aria-hidden>{ad.day}</div>
          
          {/* Card body - shows events and family member events */}
          <div className="nt-summary" aria-hidden>
            {(() => {
              const { publicEvents, personalEvents } = categorizeEvents(events);
              return (
                <>
                  {publicEvents.length > 0 && (
                    <div className="nt-summary-item event-public">
                      {publicEvents.map(e => formatEventWithTithi(e)).join(' | ')}
                    </div>
                  )}
                  {personalEvents.length > 0 && (
                    <div className="nt-summary-item event-personal">
                      {personalEvents.map(e => formatEventWithTithi(e)).join(' | ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          
          {/* Tithi at bottom left */}
          {parsedTithis.length > 0 && (
            <div className="nt-tithi-bottom" aria-hidden>
              {formatTithiForDayCard(parsedTithis.sort(compareTithisByStart))}
            </div>
          )}
        </div>
      );
    }

    // --- 3. Next Month's Days ---
  const totalTiles = tiles.length;
  // Always render enough tiles to fill 6 rows (7 columns * 6 = 42 tiles)
  // This ensures consistent layout across months
  const remainingTiles = Math.max(0, 42 - totalTiles);
    const nextMonth = currentBsMonth === 12 ? 1 : currentBsMonth + 1;
    const nextYear = currentBsMonth === 12 ? currentBsYear + 1 : currentBsYear;

    for (let i = 1; i <= remainingTiles; i++) {
      const adDate = convertBsToAd(nextYear, nextMonth, i);
      const ad = adDate; // {year, month, day}
      const dateKey = ad ? `${ad.year}-${ad.month+1}-${ad.day}` : `next-${i}`;
      const tithis = ad ? findTithisForAdDate(ad.year, ad.month, ad.day) || [] : [];
      const events = ad ? getEventsForDate(ad.year, ad.month, ad.day) || [] : [];

      // Parse tithis
      const parsedTithis = tithis.map(t => ({
        ...t,
        ...parseTithiName(t.name)
      }));

      tiles.push(
        <div
          key={`${dateKey}-next`}
          className="nt-day-tile other-month"
          onClick={() => { handleNext(); openDetailsModalForDate(ad.year, ad.month, ad.day); }}
          tabIndex={0}
          onKeyDown={(e)=> { if (e.key === 'Enter') { handleNext(); openDetailsModalForDate(ad.year, ad.month, ad.day); } }}
          data-date={dateKey}
        >
          <div className="nt-nepali-date">{toNepaliNumber(i)}</div>
          {ad && <div className="nt-english-date">{ad.day}</div>}
          <div className="nt-summary" aria-hidden>
            {(() => {
              const { publicEvents, personalEvents } = categorizeEvents(events);
              return (
                <>
                  {publicEvents.length > 0 && (
                    <div className="nt-summary-item event-public">
                      {publicEvents.map(e => formatEventWithTithi(e)).join(' | ')}
                    </div>
                  )}
                  {personalEvents.length > 0 && (
                    <div className="nt-summary-item event-personal">
                      {personalEvents.map(e => formatEventWithTithi(e)).join(' | ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {parsedTithis.length > 0 && (
            <div className="nt-tithi-bottom" aria-hidden>
              {formatTithiForDayCard(parsedTithis.sort(compareTithisByStart))}
            </div>
          )}
        </div>
      );
    }

    return tiles;
  }

  // Callback for DayDetailsModal to delete a personal event
  const handleDeleteEvent = useCallback(async (eventId) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CALENDAR_EVENTS, eventId));
      setCalendarEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalTithis = useMemo(() => {
    if (!activeDate) return [];
    const parts = activeDate.split('-').map(p=>+p);
    const adYear = parts[0];
    const adMonthZeroBased = parts[1]-1;
    const adDay = parts[2];
    return findTithisForAdDate(adYear, adMonthZeroBased, adDay) || [];
  }, [activeDate, findTithisForAdDate]);

  // Get events for the active date in modal (public events only)
  const modalEvents = useMemo(() => {
    if (!activeDate || !calendarEvents.length) return [];
    const [y, m, d] = activeDate.split('-').map(Number);
    const eventsOnDate = getEventsForDate(y, m - 1, d);
    
    return eventsOnDate.filter(event => event.isPublic === true);
  }, [activeDate, calendarEvents, getEventsForDate]);

  // Get private events for the active date in modal (user's own private events + shared tree events)
  const modalPersonalEvents = useMemo(() => {
    if (!activeDate || !calendarEvents.length || !user) return [];
    const [y, m, d] = activeDate.split('-').map(Number);
    const eventsOnDate = getEventsForDate(y, m - 1, d);
    
    return eventsOnDate.filter(event => 
      !event.isPublic && 
      (event.createdBy === user.uid || (event.treeId && sharedTreeIds.includes(event.treeId)))
    );
  }, [activeDate, calendarEvents, user, sharedTreeIds, getEventsForDate]);

  // Debug helpers previously exposed on window have been removed.
  
  
  // Debug logging removed (was too noisy for production)

  return (
    <div className="nepali-calendar-container">
      {/* Top bar above the calendar header */}
      <div 
        className="nc-topbar"
        onClick={handleGoToToday}
        title="Go to today"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleGoToToday(); }}
      >
        <div className="nc-topbar-content">
          {/* Line 1: Nepali date (hero) */}
          <div className="nc-hero-date">
            {isNepali ? toNepaliNumber(todayBs.day) : todayBs.day}{' '}
            {isNepali ? nepaliMonths[todayBs.month-1] : englishNepaliMonths[todayBs.month-1]}{' '}
            {isNepali ? toNepaliNumber(todayBs.year) : todayBs.year}
          </div>
          {/* Line 2: Weekday, time period + time */}
          <div className="nc-meta-time nc-header-line">
            {isNepali ? nepaliWeekdays[todayBs.dayOfWeek] : englishWeekdays[todayBs.dayOfWeek]},{' '}
            {(() => {
              const h = todayAd.getUTCHours();
              const m = todayAd.getUTCMinutes();
              const s = todayAd.getUTCSeconds();
              let timePeriodIndex = 0;
              if (h >= 0 && h < 12) timePeriodIndex = 0;
              else if (h >= 12 && h < 17) timePeriodIndex = 1;
              else if (h >= 17 && h < 19) timePeriodIndex = 2;
              else timePeriodIndex = 3;
              const timeOfDay = isNepali ? timePeriods.ne[timePeriodIndex] : timePeriods.en[timePeriodIndex];
              const h12 = h % 12 || 12;
              return isNepali
                ? `${timeOfDay} ${toNepaliNumber(h12)}:${toNepaliNumber(String(m).padStart(2, '0'))}:${toNepaliNumber(String(s).padStart(2, '0'))}`
                : `${timeOfDay} ${h12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            })()}
          </div>
          {/* Line 3: Tithi */}
          {(() => {
            const tithis = findTithisForAdDate(todayAd.getUTCFullYear(), todayAd.getUTCMonth(), todayAd.getUTCDate()) || [];
            if (tithis.length > 0) {
              return <div className="nc-meta-tithi nc-header-line">{getTithiDisplayName(tithis[0])}</div>;
            }
            return null;
          })()}
          {/* Line 4: English date */}
          <div className="nc-meta-engdate nc-header-line">
            {isNepali
              ? `${englishMonthsNepali[todayAd.getUTCMonth()]} ${tn(todayAd.getUTCDate())}, ${tn(todayAd.getUTCFullYear())}`
              : `${englishMonths[todayAd.getUTCMonth()]} ${todayAd.getUTCDate()}, ${todayAd.getUTCFullYear()}`
            }
          </div>
        </div>
      </div>
      <div className="nc-header">
        <button
          onClick={handlePrev}
          className="nc-btn nc-nav-btn"
          aria-label={`Previous Nepali month: ${getPrevMonthName()}`}
        >
          <span className="nc-arrow nc-arrow-left">‹</span>
          <span className="nc-label nc-label-default">{t('calendar.prev')}</span>
          <span className="nc-label nc-label-hover">{getPrevMonthName()}</span>
        </button>
        <div className="nc-center">
          {/* Month and year dropdown selectors */}
          <div className="nc-header-selectors" role="group" aria-label="Select Nepali month and year">
            <select
              className="nc-header-month-select"
              aria-label="Select Nepali month"
              value={currentBsMonth}
              onChange={(e) => {
                const m = Number(e.target.value);
                triggerMonthTransition(() => { setCurrentBsMonth(m); });
              }}
            >
              {(
                isNepali ? nepaliMonths : englishNepaliMonths
              ).map((mn, idx) => (
                <option key={`month-${idx}`} value={idx+1}>{mn}</option>
              ))}
            </select>
            <select
              className="nc-header-year-select"
              aria-label="Select Nepali year"
              value={currentBsYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                triggerMonthTransition(() => { setCurrentBsYear(y); });
              }}
            >
              {Array.from({ length: maxBsYear - minBsYear + 1 }, (_, i) => minBsYear + i).map(y => (
                <option key={y} value={y}>{isNepali ? toNepaliNumber(y) : String(y)}</option>
              ))}
            </select>
          </div>
          {/* Keep the AD display for reference */}
          <div className="nc-header-ad">{adMonthRangeDisplay}</div>
        </div>
        <button
          onClick={handleNext}
          className="nc-btn nc-nav-btn"
          aria-label={`Next Nepali month: ${getNextMonthName()}`}
        >
          <span className="nc-label nc-label-default">{t('calendar.next')}</span>
          <span className="nc-label nc-label-hover">{getNextMonthName()}</span>
          <span className="nc-arrow nc-arrow-right">›</span>
        </button>
      </div>

      <div className="nc-weekdays">
        {nepaliWeekdays.map((nepaliDay, index) => (
          <div key={nepaliDay} className={`nc-weekday ${isNepali ? '' : 'nc-weekday-english-primary'}`}>
            {isNepali ? (
              <>
                <div className="nc-weekday-nepali">{nepaliDay}</div>
                <div className="nc-weekday-english">{englishWeekdays[index]}</div>
              </>
            ) : (
              <>
                <div className="nc-weekday-english nc-weekday-english-top">{englishWeekdays[index]}</div>
                <div className="nc-weekday-nepali nc-weekday-nepali-bottom">{nepaliDay}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="nc-grid" role="grid" aria-label="Nepali calendar">
        {renderDayTiles()}
      </div>

      {/* Tithi Calculator removed from inline calendar; now available as separate block component */}

      {/* Details Modal */}
      <DayDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        activeDate={activeDate}
        tithis={modalTithis}
        publicEvents={modalEvents}
        personalEvents={modalPersonalEvents}
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
        permsLoading={permsLoading}
        hasPermission={hasPermission}
        onOpenAddEvent={openAddEventModalForDate}
        onOpenAddTithi={openAddTithiModalForDate}
        onDeleteEvent={handleDeleteEvent}
        onTreeEventClick={onTreeEventClick}
          trees={trees}
        getTithiDisplayName={getTithiDisplayName}
        formatTithiDateTime={formatTithiDateTime}
        getTreeMemberName={getTreeMemberName}
        getResolvedTithiEventDate={getResolvedTithiEventDate}
      />

      {/* App confirm modal for unsaved edits before jumping to today */}
      <ConfirmModal
        open={confirmOpen}
        title="Unsaved changes"
        message={'You have an open edit or pending changes on the calendar. If you go to the current month you may lose unsaved changes. Continue?'}
        confirmText="Go to Today"
        onConfirm={() => proceedGoToToday()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Add Tithi Modal */}
      <AddTithiModal
        isOpen={addTithiModalOpen}
        onClose={() => setAddTithiModalOpen(false)}
        activeDate={activeDate}
        focusHint={modalFocusHint}
        user={user}
        authLoading={authLoading}
        onAddTithi={addTithi}
      />

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={addEventModalOpen}
        onClose={() => setAddEventModalOpen(false)}
        activeDate={activeDate}
        user={user}
        authLoading={authLoading}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
        findTithisForAdDate={findTithisForAdDate}
      />
    </div>
  );
};