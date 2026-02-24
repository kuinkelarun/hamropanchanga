import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import { useLanguage } from '../contexts/LanguageContext';
import './NepaliCalendar.css';
import ConfirmModal from './ConfirmModal';
import bsCalendarData from '../data/bsCalendarData';

import {
  getTithiLunarMonthName,
  getTithiIndexByName,
  getTithiYearFromAdDate,
  convertAdToBs,
  convertBsToAd
} from '../utils/nepaliDateUtils';
import {
  NEPALI_MONTHS as nepaliMonths,
  ENGLISH_MONTHS as englishMonths,
  ENGLISH_MONTHS_NEPALI as englishMonthsNepali,
  ENGLISH_NEPALI_MONTHS as englishNepaliMonths,
  NEPALI_WEEKDAYS as nepaliWeekdays,
  ENGLISH_WEEKDAYS as englishWeekdays,
  SHUKLA_TITHI_NAMES as shuklaPackshyaTithis,
  KRISHNA_TITHI_NAMES as krishnaPackshyaTithis,
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
  getTithiStartMillis,
  getTithiEndMillis,
  compareTithisByStart,
  dateKeyFromAd,
  padDateKey,
} from '../utils/calendarHelpers';
import AddEventModal from './calendar/AddEventModal';
import AddTithiModal from './calendar/AddTithiModal';
import DayDetailsModal from './calendar/DayDetailsModal';

// bsCalendarData moved to src/data/bsCalendarData.js
// Note: This is a fallback; we'll load updated data from Firestore if available
let mergedCalendarData = { ...bsCalendarData };
const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

// Function to get calendar data (Firestore override + bsCalendarData fallback)
const getCalendarData = (year) => {
  return mergedCalendarData[year] || bsCalendarData[year];
};

// Note: AD↔BS conversions are centralized in nepaliDateUtils to ensure
// consistent, Nepal-time-based handling across the app. We import and use
// convertAdToBs / convertBsToAd from there instead of maintaining a
// separate implementation here.

export default function NepaliCalendar({ user: propUser, isAdmin, treeMembers = [], onTreeEventClick }) {
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
  const [tithisByDate, setTithisByDate] = useState({}); // { "YYYY-M-D": [{name,start,end}, ...] }
  const [calendarEvents, setCalendarEvents] = useState([]); // Array of calendar events
  const [activeDate, setActiveDate] = useState(null);

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

  // Load tithis from Firebase on component mount.
  // Note: `tithis` is public-read in Firestore rules, so this should not wait for auth.
  useEffect(() => {
    if (isDev) console.log('Setting up Firebase listener for tithis...');
    const tithisCollection = collection(db, COLLECTIONS.TITHIS);
    // Order by startDate only — composite startDate+startTime index may not exist yet.
    // startTime sorting is handled in JS below.
    const q = query(tithisCollection, orderBy('startDate'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isDev) {
        console.log('Firebase snapshot received:', {
          docsCount: snapshot.docs.length,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
          fromCache: snapshot.metadata.fromCache,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      const tithisData = {};
      snapshot.docs.forEach((doc, index) => {
        const tithi = { id: doc.id, ...doc.data() };
        if (isDev) console.log(`Processing tithi ${index + 1}:`, tithi);
        
        // Calculate all dates this tithi spans (inclusive)
        if (tithi.startDate && tithi.endDate) {
          const startDateObj = new Date(tithi.startDate + 'T00:00:00');
          const endDateObj = new Date(tithi.endDate + 'T00:00:00');
          
          // Add this tithi to all dates it spans
          const currentDate = new Date(startDateObj);
          while (currentDate <= endDateObj) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1; // 1-12
            const day = currentDate.getDate();
            const dateKey = padDateKey(year, month, day);
            
            if (!tithisData[dateKey]) {
              tithisData[dateKey] = [];
            }
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startDate: tithi.startDate,
              startTime: tithi.startTime,
              endDate: tithi.endDate,
              endTime: tithi.endTime
            });
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else {
          // Legacy support: if no date range, use old dateKey field
          const dateKey = tithi.dateKey;
          if (dateKey) {
            if (!tithisData[dateKey]) {
              tithisData[dateKey] = [];
            }
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startTime: tithi.startTime,
              endTime: tithi.endTime
            });
          }
        }
      });
      
      if (isDev) {
        console.log('Final tithisData being set:', tithisData);
        console.log('Total dates with tithis:', Object.keys(tithisData).length);
      }
      setTithisByDate(tithisData);
    }, (error) => {
      console.error('Firebase onSnapshot error:', error);
      if (isDev) {
        console.error('This could be a permissions issue. Check Firestore rules and authentication.');
      }
    });

    return () => {
      if (isDev) console.log('Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [isDev]);

  // Load Nepali calendar configuration from Firestore and merge with bsCalendarData
  // This allows admin edits to be reflected in the calendar
  useEffect(() => {
    const loadCalendarConfiguration = async () => {
      try {
        const calendarYearsSnapshot = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
        if (calendarYearsSnapshot.empty) {
          if (isDev) console.log('No custom calendar years found in Firestore, using defaults only');
          return;
        }

        // Merge Firestore data with bsCalendarData
        calendarYearsSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const year = parseInt(data.year);
          
          // Convert startAdDate string to Date without timezone offset
          let startAdDate = data.startAdDate;
          if (typeof startAdDate === 'string') {
            // Parse "YYYY-MM-DD" format manually to avoid timezone issues
            const [dateYear, dateMonth, dateDay] = startAdDate.split('-');
            startAdDate = new Date(parseInt(dateYear), parseInt(dateMonth) - 1, parseInt(dateDay));
          }
          
          // Update mergedCalendarData with Firestore values
          mergedCalendarData[year] = {
            startAdDate,
            daysInMonths: data.daysInMonths || []
          };
          
          if (isDev) console.log(`Loaded custom calendar year ${year} from Firestore:`, mergedCalendarData[year]);
        });
      } catch (error) {
        if (error.message && error.message.includes('permission')) {
          if (isDev) console.log('No permission to read nepaliCalendarYears collection');
        } else {
          if (isDev) console.log('Calendar configuration load error (using defaults):', error.message);
        }
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

  // Load calendar events from Firebase - fetch public events + user's own private events
  useEffect(() => {
    if (authLoading) {
      if (isDev) console.log('Auth still loading for events, waiting...');
      return;
    }

    if (isDev) console.log('Setting up Firebase listener for calendar events...', { user: !!user, isAdmin });
    const eventsCollection = collection(db, COLLECTIONS.CALENDAR_EVENTS);
    
    if (!user) {
      // Guests: public events AND tree member events
      const publicQuery = query(
        eventsCollection, 
        where('isPublic', '==', true),
        orderBy('dateKey')
      );
      
      // Simplified treeQuery: only order by dateKey; filter treeId client-side to avoid composite index
      const treeQuery = query(
        eventsCollection,
        orderBy('dateKey')
      );
      
      let publicEventsById = new Map();
      let treeEventsById = new Map();

      const emitMergedEvents = () => {
        const merged = new Map();
        [publicEventsById, treeEventsById].forEach((m) => {
          m.forEach((value, key) => merged.set(key, value));
        });
        setCalendarEvents(Array.from(merged.values()));
      };
      
      const unsubscribe1 = onSnapshot(publicQuery, (snapshot) => {
        if (isDev) console.log('Public events snapshot (guest):', snapshot.docs.length);
        publicEventsById = new Map(
          snapshot.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }])
        );
        emitMergedEvents();
      }, (error) => {
        console.error('Public events error:', error);
      });

      const unsubscribe2 = onSnapshot(treeQuery, (snapshot) => {
        if (isDev) console.log('Tree events snapshot (guest):', snapshot.docs.length);
        const nextTreeEventsById = new Map();
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.treeId) { // Only include if treeId exists
            nextTreeEventsById.set(docSnap.id, { id: docSnap.id, ...data });
          }
        });
        treeEventsById = nextTreeEventsById;
        emitMergedEvents();
      }, (error) => {
        console.error('Tree events error:', error);
      });

      return () => {
        if (isDev) console.log('Cleaning up calendar events listener');
        unsubscribe1();
        unsubscribe2();
      };
    } else {
      // Logged-in users: fetch public events AND their own private events AND tree member events
      // Admins also fetch ALL admin-created private events
      // Use queries and merge the results
      const publicQuery = query(
        eventsCollection,
        where('isPublic', '==', true),
        orderBy('dateKey')
      );
      
      const userQuery = query(
        eventsCollection,
        where('createdBy', '==', user.uid),
        orderBy('dateKey')
      );

      // Simplified treeQuery: only order by dateKey; filter treeId client-side to avoid composite index
      // FIX: Regular users cannot query ALL events because some might be private to other users.
      // We must restrict the query to what the user is allowed to see.
      let treeQuery;
      if (isAdmin) {
        treeQuery = query(
          eventsCollection,
          orderBy('dateKey')
        );
      } else {
        // For regular users, we can't just fetch "all events" and filter client-side.
        // We must fetch only what they are allowed to see.
        // Since we already fetch public events (publicQuery) and their own events (userQuery),
        // we don't need a broad "treeQuery" that fails permissions.
        // If we want to show events for trees they belong to, we'd need a specific query for that.
        // For now, we'll skip this broad query for regular users to avoid errors.
        treeQuery = null;
      }
      
      let publicEventsById = new Map();
      let userEventsById = new Map();
      let treeEventsById = new Map();
      let adminPrivateEventsById = new Map();

      const emitMergedEvents = () => {
        const merged = new Map();
        [publicEventsById, userEventsById, treeEventsById, adminPrivateEventsById].forEach((m) => {
          m.forEach((value, key) => merged.set(key, value));
        });
        setCalendarEvents(Array.from(merged.values()));
      };
      
      const unsubscribe1 = onSnapshot(publicQuery, (snapshot) => {
        if (isDev) console.log('Public events snapshot:', snapshot.docs.length);
        publicEventsById = new Map(
          snapshot.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }])
        );
        emitMergedEvents();
      }, (error) => {
        console.error('Public events error:', error);
      });
      
      const unsubscribe2 = onSnapshot(userQuery, (snapshot) => {
        if (isDev) console.log('User events snapshot:', snapshot.docs.length);
        userEventsById = new Map(
          snapshot.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }])
        );
        emitMergedEvents();
      }, (error) => {
        console.error('User events error:', error);
      });

      const unsubscribe3 = treeQuery ? onSnapshot(treeQuery, (snapshot) => {
        if (isDev) console.log('Tree events snapshot:', snapshot.docs.length);
        const nextTreeEventsById = new Map();
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.treeId) { // Only include if treeId exists
            nextTreeEventsById.set(docSnap.id, { id: docSnap.id, ...data });
          }
        });
        treeEventsById = nextTreeEventsById;
        emitMergedEvents();
      }, (error) => {
        console.error('Tree events error:', error);
      }) : () => {}; // No-op unsubscribe if treeQuery is null

      // If admin, also fetch all admin-created private events
      let unsubscribe4 = null;
      if (isAdmin) {
        const adminPrivateQuery = query(
          eventsCollection,
          where('createdByAdmin', '==', true),
          where('isPublic', '==', false),
          orderBy('dateKey')
        );
        
        unsubscribe4 = onSnapshot(adminPrivateQuery, (snapshot) => {
          if (isDev) console.log('Admin private events snapshot:', snapshot.docs.length);
          adminPrivateEventsById = new Map(
            snapshot.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }])
          );
          emitMergedEvents();
        }, (error) => {
          console.error('Admin private events error:', error);
        });
      }

      return () => {
        if (isDev) console.log('Cleaning up calendar events listeners');
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
        if (unsubscribe4) unsubscribe4();
      };
    }
  }, [authLoading, user, isAdmin, isDev]);

  useEffect(()=>{
    if (currentBsYear < minBsYear) setCurrentBsYear(minBsYear);
    if (currentBsYear > maxBsYear) setCurrentBsYear(maxBsYear);
  }, [currentBsYear]);

  const nepaliMonthDays = useMemo(() => {
    return getCalendarData(currentBsYear)?.daysInMonths[currentBsMonth-1] ?? 30;
  }, [currentBsYear, currentBsMonth]);

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

  // Manual refresh function to force reload tithis data
  const refreshTithis = useCallback(async () => {
    if (isDev) console.log('Manual refresh triggered...');
    try {
      const tithisCollection = collection(db, COLLECTIONS.TITHIS);
      const q = query(tithisCollection, orderBy('startDate'), orderBy('startTime'));
      const snapshot = await getDocs(q);
      
      const tithisData = {};
      snapshot.docs.forEach((doc) => {
        const tithi = { id: doc.id, ...doc.data() };
        
        // Calculate all dates this tithi spans (inclusive)
        if (tithi.startDate && tithi.endDate) {
          const startDateObj = new Date(tithi.startDate + 'T00:00:00');
          const endDateObj = new Date(tithi.endDate + 'T00:00:00');
          
          // Add this tithi to all dates it spans
          const currentDate = new Date(startDateObj);
          while (currentDate <= endDateObj) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const day = currentDate.getDate();
            const dateKey = padDateKey(year, month, day);
            
            if (!tithisData[dateKey]) {
              tithisData[dateKey] = [];
            }
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startDate: tithi.startDate,
              startTime: tithi.startTime,
              endDate: tithi.endDate,
              endTime: tithi.endTime
            });
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else {
          // Legacy support
          const dateKey = tithi.dateKey;
          if (dateKey) {
            if (!tithisData[dateKey]) {
              tithisData[dateKey] = [];
            }
            tithisData[dateKey].push({
              id: tithi.id,
              name: tithi.name,
              startTime: tithi.startTime,
              endTime: tithi.endTime
            });
          }
        }
      });
      
      if (isDev) console.log('Manual refresh completed, updating state with:', tithisData);
      setTithisByDate(tithisData);
    } catch (error) {
      console.error('Error in manual refresh:', error);
    }
  }, [setTithisByDate, isDev]);

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

    const tempId = crypto.randomUUID(); // Generate temporary ID for optimistic update
    try {
      // Create the new tithi object with date range
      const newTithi = {
        id: tempId,
        name: name,
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

      // Update local state immediately - add to all affected dates
      if (process.env.NODE_ENV !== 'production') {
        console.log('Updating local state immediately...');
      }
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        
        affectedDates.forEach(affectedDateKey => {
          if (!updatedTithis[affectedDateKey]) {
            updatedTithis[affectedDateKey] = [];
          }
          updatedTithis[affectedDateKey] = [...updatedTithis[affectedDateKey], {
            id: newTithi.id,
            name: newTithi.name,
            startDate: newTithi.startDate,
            startTime: newTithi.startTime,
            endDate: newTithi.endDate,
            endTime: newTithi.endTime
          }];
        });
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('Local state updated with new tithi across dates:', affectedDates);
        }
        return updatedTithis;
      });

      // Then sync to Firebase
      if (process.env.NODE_ENV !== 'production') {
        console.log('Syncing to Firestore...');
        console.log('User authenticated:', !!user);
      }
      
      // Create data for Firestore (without the temporary ID)
      const tithiData = {
        name: newTithi.name,
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
      
      // Update the local state with the real Firebase ID across all affected dates
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        affectedDates.forEach(affectedDateKey => {
          if (updatedTithis[affectedDateKey]) {
            const tithiIndex = updatedTithis[affectedDateKey].findIndex(t => t.id === newTithi.id);
            if (tithiIndex >= 0) {
              updatedTithis[affectedDateKey][tithiIndex].id = docRef.id;
            }
          }
        });
        if (process.env.NODE_ENV !== 'production') {
          console.log('Updated local state with real Firebase ID:', docRef.id);
        }
        return updatedTithis;
      });

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
      
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        affectedDates.forEach(affectedDateKey => {
          if (updatedTithis[affectedDateKey]) {
            updatedTithis[affectedDateKey] = updatedTithis[affectedDateKey].filter(t => t.id !== tempId);
          }
        });
        return updatedTithis;
      });
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
    let deletedTithi = null;
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
      
      // Update local state immediately - remove from all affected dates
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        affectedDates.forEach(affectedDateKey => {
          if (updatedTithis[affectedDateKey]) {
            if (!deletedTithi) {
              deletedTithi = updatedTithis[affectedDateKey].find(t => t.id === id);
            }
            updatedTithis[affectedDateKey] = updatedTithis[affectedDateKey].filter(t => t.id !== id);
            if (updatedTithis[affectedDateKey].length === 0) {
              delete updatedTithis[affectedDateKey];
            }
          }
        });
        if (isDev) console.log('Local state updated after delete');
        return updatedTithis;
      });

      // Then sync to Firebase
      await deleteDoc(doc(db, COLLECTIONS.TITHIS, id));
      if (isDev) console.log('Successfully deleted tithi from Firestore');
    } catch (error) {
      console.error('Error deleting tithi:', error);
      
      // Rollback local state on error - restore to all affected dates
      if (deletedTithi && affectedDates.length > 0) {
        setTithisByDate(prevTithis => {
          const updatedTithis = { ...prevTithis };
          affectedDates.forEach(affectedDateKey => {
            if (!updatedTithis[affectedDateKey]) {
              updatedTithis[affectedDateKey] = [];
            }
            updatedTithis[affectedDateKey].push(deletedTithi);
          });
          return updatedTithis;
        });
      }
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



  // State to cache resolved tithi event dates for different years
  const [tithiEventDateCache, setTithiEventDateCache] = useState({});

  // Helper function to resolve yearly tithi events - builds a cache key
  const getTithiEventCacheKey = useCallback((eventId, bsYear) => {
    return `${eventId}_${bsYear}`;
  }, []);

  // Effect to resolve yearly tithi events for the current viewing year
  useEffect(() => {
    const resolveYearlyTithiEventsForYear = async () => {
      const yearlyTithiEvents = calendarEvents.filter(e => e.repetition === 'yearly' && e.tithi);
      
      if (yearlyTithiEvents.length === 0) return;
      
      const newCache = { ...tithiEventDateCache };
      
      for (const event of yearlyTithiEvents) {
        const cacheKey = getTithiEventCacheKey(event.id, currentBsYear);
        
        // Skip if already cached
        if (cacheKey in newCache) continue;
        
        try {
          const { paksha, name, month: expectedTithiMonth } = event.tithi;
          
          // Build the full tithi name to search for
          const pakshaNepali = normalizePakshaToNepali(paksha);
          const fullName = `${pakshaNepali} ${name}`;
          
          // Query Firestore for tithis matching this name
          const q = query(collection(db, COLLECTIONS.TITHIS), where('name', '>=', fullName), where('name', '<=', fullName + '\uf8ff'));
          const snapshot = await getDocs(q);
          
          // Find the tithi that falls in the target year with matching lunar month
          let foundDate = null;
          snapshot.docs.forEach(doc => {
            const t = doc.data();
            if (!t.name.includes(name) || !t.name.includes(pakshaNepali)) return;
            
            const tithiIndex = getTithiIndexByName(name, { fallbackToOne: false });
            if (!tithiIndex) return;
            
            // Get the date of this tithi from Firestore
            const tithiStartDate = t.startDate; // Should be in YYYY-MM-DD format
            if (!tithiStartDate) return;
            
            // Check if this tithi is in the target year and matches the expected lunar month
            const tithiYear = getTithiYearFromAdDate(tithiStartDate, null, paksha, tithiIndex).tithiYear;
            
            // Check if the lunar month matches
            const lunarMonth = getTithiLunarMonthName(paksha, tithiIndex, tithiStartDate);
            
            let expectedMonth = expectedTithiMonth;
            if (typeof expectedMonth === 'number') {
              expectedMonth = nepaliMonths[expectedMonth - 1];
            }
            
            if (tithiYear === currentBsYear && lunarMonth === expectedMonth) {
              foundDate = tithiStartDate;
            }
          });
          
          newCache[cacheKey] = foundDate || event.dateKey;
        } catch (err) {
          console.error(`Error resolving yearly tithi event ${event.id}:`, err);
          newCache[cacheKey] = event.dateKey;
        }
      }
      
      setTithiEventDateCache(newCache);
    };
    
    resolveYearlyTithiEventsForYear();
  }, [currentBsYear, calendarEvents, getTithiEventCacheKey]);

  // Helper function to get the resolved date for a yearly tithi event
  const getResolvedTithiEventDate = useCallback((event) => {
    if (!event.tithi || event.repetition !== 'yearly') {
      return event.dateKey;
    }
    
    const cacheKey = getTithiEventCacheKey(event.id, currentBsYear);
    return tithiEventDateCache[cacheKey] || event.dateKey;
  }, [currentBsYear, tithiEventDateCache, getTithiEventCacheKey]);

  // Helper function to get events for a specific date
  const getEventsForDate = useCallback((adYear, adMonthZeroBased, adDay) => {
    const dateKey = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    const targetTithis = findTithisForAdDate(adYear, adMonthZeroBased, adDay) || [];
    
    // Convert current AD date to Nepali for comparison
    const currentBsDate = convertAdToBs(adYear, adMonthZeroBased, adDay);
    
    return calendarEvents.filter(event => {
      // For yearly repeating tithi events, resolve the date for the current viewing year
      let eventDateKeyToMatch = event.dateKey;
      if (event.repetition === 'yearly' && event.tithi && currentBsDate) {
        eventDateKeyToMatch = getResolvedTithiEventDate(event);
      }
      
      // 1. Exact Date Match
      if (eventDateKeyToMatch === dateKey) {
        return true;
      }
      
      // 2. Recurrence Logic
      if (event.repetition === 'monthly' || event.repetition === 'yearly') {
        
        // A. Tithi-based Recurrence
        if (event.tithi) {
          // Check if any tithi on this day matches the event's tithi
          return targetTithis.some(t => {
            const { pakshya: tPaksha, tithi: tName } = parseTithiName(t.name);
            
            // Match Paksha and Tithi Name
            // Note: event.tithi.paksha is 'Shukla'/'Krishna', tPaksha is 'शुक्लपक्ष'/'कृष्णपक्ष'
            const eventPakshaNepali = normalizePakshaToNepali(event.tithi.paksha);
            if (tPaksha !== eventPakshaNepali) return false;
            
            // Match Tithi Name (e.g., 'Pratipada')
            // event.tithi.name might be 'Pratipada', tName might be 'प्रतिपदा' or 'Pratipada' depending on data
            // Let's use getTithiIndexByName to normalize
            const eventTithiIndex = getTithiIndexByName(event.tithi.name, { fallbackToOne: false });
            const currentTithiIndex = getTithiIndexByName(tName, { fallbackToOne: false });

            // If we can't confidently parse either tithi index, do NOT match (prevents false positives
            // that can show up as events appearing on wrong tithis/dates).
            if (!eventTithiIndex || !currentTithiIndex) return false;

            if (eventTithiIndex !== currentTithiIndex) return false;
            
            // If Monthly, we are done (matches Paksha + Tithi)
            if (event.repetition === 'monthly') return true;
            
            // If Yearly, check Tithi Month
            if (event.repetition === 'yearly') {
              const lunarMonthName = getTithiLunarMonthName(event.tithi.paksha, eventTithiIndex, dateKey);
              // event.tithi.month is now stored as the actual tithi lunar month name (e.g., 'वैशाख')
              // It could be either a string (month name) or a number (if legacy data)
              let eventMonthName = event.tithi.month;
              if (typeof eventMonthName === 'number') {
                eventMonthName = nepaliMonths[eventMonthName - 1];
              }
              return lunarMonthName === eventMonthName;
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
      } else if (event.createdBy === user?.uid) {
        // Created by current user and not marked public = personal/private
        personalEvents.push(event);
      }
      // Events not marked public and not created by current user are hidden
    });
    
    return { publicEvents, personalEvents };
  }, [user]);

  // Helper function to format event title with tithi information
  const formatEventWithTithi = useCallback((event) => {
    let display = event.title;
    if (event.tithi) {
      // Normalize paksha to Nepali if it's in English (legacy data)
      const pakshaDisplay = normalizePakshaToNepali(event.tithi.paksha);
      display += ` (${event.tithi.month} ${pakshaDisplay} ${event.tithi.name})`;
    }
    return display;
  }, []);

  // Helper function to get tithi display name with lunar month
  const getTithiDisplayName = (tithi) => {
    const { pakshya, tithi: tithiName } = parseTithiName(tithi.name);
    if (!tithi.startDate) {
      return tithi.name; // Fallback if no date
    }
    
    // Get the tithi lunar month for the start date
    const pakshaNormalized = normalizePakshaToEnglish(pakshya);
    const tithiIndex = getTithiIndexByName(tithiName);
    
    if (tithiIndex) {
      const lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
      if (lunarMonth) {
        // lunarMonth is in Nepali (e.g., 'माघ'), find its index and convert to English if needed
        const monthIndex = nepaliMonths.indexOf(lunarMonth);
        const monthDisplay = monthIndex !== -1 
          ? (isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex])
          : lunarMonth;
        const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
        const tithiDisplay = isNepali ? tithiName : getEnglishTithiName(tithiName);
        return `${monthDisplay} ${pakshyaDisplay} ${tithiDisplay}`;
      }
    }
    
    return tithi.name; // Fallback to original name if calculation fails
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

  // Get private events for the active date in modal (user's own private events)
  const modalPersonalEvents = useMemo(() => {
    if (!activeDate || !calendarEvents.length || !user) return [];
    const [y, m, d] = activeDate.split('-').map(Number);
    const eventsOnDate = getEventsForDate(y, m - 1, d);
    
    return eventsOnDate.filter(event => 
      !event.isPublic && 
      event.createdBy === user.uid
    );
  }, [activeDate, calendarEvents, user, getEventsForDate]);

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
        <div
          className="nc-topbar-content"
          style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', width: '100%' }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.4' }}>
            {isNepali ? toNepaliNumber(todayBs.day) : todayBs.day} {isNepali ? nepaliMonths[todayBs.month-1] : englishNepaliMonths[todayBs.month-1]} {isNepali ? toNepaliNumber(todayBs.year) : todayBs.year}, {isNepali ? nepaliWeekdays[todayBs.dayOfWeek] : englishWeekdays[todayBs.dayOfWeek]}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {(() => {
              const h = todayAd.getUTCHours();
              const m = todayAd.getUTCMinutes();
              const s = todayAd.getUTCSeconds();
              // Determine time of day based on hour
              let timePeriodIndex = 0;
              if (h >= 0 && h < 12) {
                timePeriodIndex = 0; // Morning (midnight to noon)
              } else if (h >= 12 && h < 17) {
                timePeriodIndex = 1; // Afternoon (noon to 5 PM)
              } else if (h >= 17 && h < 19) {
                timePeriodIndex = 2; // Evening (5 PM to 7 PM)
              } else {
                timePeriodIndex = 3; // Night (7 PM to midnight)
              }
              const timeOfDay = isNepali ? timePeriods.ne[timePeriodIndex] : timePeriods.en[timePeriodIndex];
              const h12 = h % 12 || 12;
              const displayTime = isNepali 
                ? `${timeOfDay} ${toNepaliNumber(h12)}:${toNepaliNumber(String(m).padStart(2, '0'))}:${toNepaliNumber(String(s).padStart(2, '0'))}` 
                : `${timeOfDay} ${h12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
              return displayTime;
            })()}
          </div>
          {(() => {
             const tithis = findTithisForAdDate(todayAd.getUTCFullYear(), todayAd.getUTCMonth(), todayAd.getUTCDate()) || [];
             if (tithis.length > 0) {
               // Sort to find the most relevant tithi if multiple (usually one per day or spanning)
               // Just taking the first one is usually fine for display
               const t = tithis[0]; 
               return (
                 <div style={{ fontSize: '0.8rem', marginTop: '2px', opacity: 0.9 }}>
                   {getTithiDisplayName(t)}
                 </div>
               );
             }
             return null;
          })()}
          <div style={{ fontSize: '0.8rem', marginTop: '2px', opacity: 0.9 }}>
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