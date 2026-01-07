import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, signInWithGoogle } from '../firebase';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import './NepaliCalendar.css';
import ConfirmModal from './ConfirmModal';
import bsCalendarData from '../data/bsCalendarData';
import { useSettings } from '../contexts/SettingsContext';
import NepaliDatePicker from './NepaliDatePicker';
import { 
  getTithiLunarMonthName, 
  getTithiIndexByName, 
  nepaliMonths as utilNepaliMonths, 
  formatAdDateToNepaliStringWithNumerals,
  convertAdToBs,
  convertBsToAd
} from '../utils/nepaliDateUtils';

const nepaliMonths = utilNepaliMonths;
const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const nepaliWeekdays = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
];
const englishWeekdays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const shuklaPackshyaTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"
];

const krishnaPackshyaTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"
];

const nepaliNumbers = ["०","१","२","३","४","५","६","७","८","९"];

// bsCalendarData moved to src/data/bsCalendarData.js
// Note: This is a fallback; we'll load updated data from Firestore if available
let mergedCalendarData = { ...bsCalendarData };
const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

// Function to get calendar data (Firestore override + bsCalendarData fallback)
const getCalendarData = (year) => {
  return mergedCalendarData[year] || bsCalendarData[year];
};

function toNepaliNumber(num){
  return String(num).split('').map(d => nepaliNumbers[+d] ?? d).join('');
}

function getNepalDate(){
  const now = new Date();
  const nptOffset = 5.75 * 3600000;
  return new Date(now.getTime() + nptOffset);
}

// Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Convert 12-hour time with AM/PM to 24-hour format (HH:MM)
// eslint-disable-next-line no-unused-vars
function formatTime24Hour(time12) {
  if (!time12) return '';
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12; // Return as-is if format doesn't match
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Note: AD↔BS conversions are centralized in nepaliDateUtils to ensure
// consistent, Nepal-time-based handling across the app. We import and use
// convertAdToBs / convertBsToAd from there instead of maintaining a
// separate implementation here.

export default function NepaliCalendar({ user: propUser, isAdmin, treeMembers = [], onTreeEventClick }) {
  const { isEditMode } = useSettings();
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

  const tithiInputRef = useRef(null);

  // Load tithis from Firebase on component mount.
  // Note: `tithis` is public-read in Firestore rules, so this should not wait for auth.
  useEffect(() => {
    if (isDev) console.log('Setting up Firebase listener for tithis...');
    const tithisCollection = collection(db, 'tithis');
    const q = query(tithisCollection, orderBy('startDate'), orderBy('startTime'));
    
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
        const calendarYearsSnapshot = await getDocs(collection(db, 'nepaliCalendarYears'));
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
              const testCollection = collection(db, 'tithis');
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
    const eventsCollection = collection(db, 'calendarEvents');
    
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
    if (!end) return `${englishMonths[start.month ?? 0]} ${start.year ?? ''}`;
    const sMon = start.month; const eMon = end.month;
    const sYr = start.year; const eYr = end.year;
    if (sMon === eMon && sYr === eYr) return `${englishMonths[sMon]} ${sYr}`;
    if (sYr === eYr) return `${englishMonths[sMon]}/${englishMonths[eMon]} ${sYr}`;
    return `${englishMonths[sMon]} ${sYr} / ${englishMonths[eMon]} ${eYr}`;
  }, [firstDayOfBsMonthAd, lastDayOfBsMonthAd]);

  const startDayOfWeek = useMemo(() => {
    if (!firstDayOfBsMonthAd) return 0;
    return new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day).getDay();
  }, [firstDayOfBsMonthAd]);

  // Helper to create a dateKey from AD date object
  function dateKeyFromAd(ad){ 
    return `${ad.year}-${String(ad.month+1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`; 
  }

  // Helper to create a zero-padded date key from numeric year, month(1-12), day
  function padDateKey(year, month, day){
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

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
      const tithisCollection = collection(db, 'tithis');
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
      const tithisCollection = collection(db, 'tithis');
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
    return nepaliMonths[m-1] || '';
  }
  function getNextMonthName(){
    let m = currentBsMonth + 1;
    if (m > 12) { m = 1; }
    return nepaliMonths[m-1] || '';
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
    // Use consistently padded YYYY-MM-DD for activeDate
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    setModalFocusHint(focusHint);
    
    // Set default start and end dates to the selected date (in YYYY-MM-DD format)
    const defaultDate = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    if (isDev) console.log('openAddTithiModalForDate: Setting defaultDate to:', defaultDate);
    setStartDate(defaultDate);
    setEndDate(defaultDate);
    
    setDetailsModalOpen(false); // Close details modal if open
    setAddTithiModalOpen(true);
  }

  // open add event modal from + button or details modal
  function openAddEventModalForDate(adYear, adMonthZeroBased, adDay){
    if (isDev) console.log('openAddEventModalForDate called with:', { adYear, adMonthZeroBased, adDay });
    // Use consistently padded YYYY-MM-DD for activeDate
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    
    // Set default event date
    const defaultDate = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setEventDate(defaultDate);
    
    // Reset form
    setEventTitle('');
    setEventDescription('');
    setEventRepetition('none');
    setEventType('private'); // Default to private events
    setEventAssociateMode('date');
    setSelectedEventTithiId('');
    setSelectedTreeId('');
    setSelectedTreeMemberId('');
    setEventValidation('');
    
    setDetailsModalOpen(false); // Close details modal if open
    setAddEventModalOpen(true);
  }

  async function addTithi(dateKey, name, startDate, startTime='', endDate, endTime=''){
    if (isDev) console.log('addTithi called with:', { dateKey, name, startDate, startTime, endDate, endTime, user: !!user });

    if (!user) {
      setValidation('Please log in to add tithis.');
      return;
    }

    try {
      // Create the new tithi object with date range
      const newTithi = {
        id: crypto.randomUUID(), // Generate temporary ID
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
      
      const tithisCollection = collection(db, 'tithis');
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
      setValidation(`Error adding tithi: ${error.message}`);
      
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
            updatedTithis[affectedDateKey] = updatedTithis[affectedDateKey].filter(t => t.id !== newTithi.id);
          }
        });
        return updatedTithis;
      });
    }
  }

  // submit add event form
  async function submitAddEvent() {
    if (!user) {
      setEventValidation('Please log in to add events.');
      return;
    }

    if (!eventTitle.trim()) {
      setEventValidation('Please enter an event title.');
      return;
    }

    if (!eventDate) {
      setEventValidation('Please select a date.');
      return;
    }

    // Optional tithi association (used for recurring events)
    let tithiPayload = null;
    if (eventAssociateMode === 'tithi') {
      const [y, m, d] = eventDate.split('-').map(Number);
      const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];

      if (tithisForEventDate.length === 0) {
        setEventValidation('No tithi is available for the selected date.');
        return;
      }

      const selectedTithi = tithisForEventDate.find(t => t.id === selectedEventTithiId) || tithisForEventDate[0];
      if (!selectedTithi) {
        setEventValidation('Please select a tithi.');
        return;
      }

      const { pakshya, tithi: tithiName } = parseTithiName(selectedTithi.name);
      const pakshaNormalized = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
      const tithiIndex = getTithiIndexByName(tithiName);
      const lunarMonthName = tithiIndex ? getTithiLunarMonthName(pakshaNormalized, tithiIndex, eventDate) : null;

      tithiPayload = {
        id: selectedTithi.id,
        name: tithiName,
        paksha: pakshaNormalized,
        month: lunarMonthName || null
      };
    }

    // Validate selection for family-member events
    if (eventType === 'customer') {
      if (!selectedTreeId) {
        setEventValidation('Please select a tree.');
        return;
      }
      if (!selectedTreeMemberId) {
        setEventValidation('Please select a family member.');
        return;
      }
    }

    setIsAddingEvent(true);
    setEventValidation('');

    try {
      // Add to calendarEvents collection
      // - public: isPublic === true
      // - private (self): isPublic === false, no treeId/memberId
      // - family member (tree-linked): isPublic === false, with treeId + memberId
      const isPublic = eventType === 'public';
      const createdByAdmin = isAdmin || isSuperUser;

      // For any repeating non-tithi events, we need to store the original Nepali date
      // so we can match it correctly across repetitions
      let nepaliDateForRecurrence = null;
      if ((eventRepetition === 'yearly' || eventRepetition === 'monthly') && !tithiPayload) {
        // Always store Nepali date for recurrence (user is selecting Nepali date via NepaliDatePicker)
        // Extract Nepali date from the AD date selected
        const [adY, adM, adD] = eventDate.split('-').map(Number);
        const bsDate = convertAdToBs(adY, adM - 1, adD);
        nepaliDateForRecurrence = {
          year: bsDate.year,
          month: bsDate.month,
          day: bsDate.day
        };
        if (isDev) {
          console.log(`[submitAddEvent] Storing Nepali date for ${eventRepetition} recurrence:`, {
            nepaliDate: `${bsDate.year}/${bsDate.month}/${bsDate.day}`,
            adDate: eventDate,
            title: eventTitle.trim()
          });
        }
      }

      const payload = {
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        dateKey: eventDate,
        // Standardize: always set `tithi` field; null when not used.
        tithi: tithiPayload || null,
        repetition: eventRepetition,
        // Store original Nepali date for yearly recurrence (non-tithi events)
        nepaliDateForRecurrence: nepaliDateForRecurrence || null,
        isPublic: isPublic,
        createdBy: user.uid,
        createdByAdmin: createdByAdmin,
        createdAt: serverTimestamp()
      };

      if (eventType === 'customer') {
        payload.treeId = selectedTreeId;
        payload.memberId = selectedTreeMemberId;
      }

      await addDoc(collection(db, 'calendarEvents'), payload);

      if (isDev) {
        if (eventType === 'customer') console.log('Family member (tree) event added successfully');
        else console.log(`${isPublic ? 'Public' : 'Private'} event added successfully`);
      }

      // Close modal and reset form
      setAddEventModalOpen(false);
      setEventTitle('');
      setEventDescription('');
      setEventDate('');
      setEventRepetition('none');
      setEventType('private');
      setEventAssociateMode('date');
      setSelectedEventTithiId('');
      setSelectedTreeId('');
      setSelectedTreeMemberId('');
      setEventValidation('');
    } catch (error) {
      console.error('Error adding event:', error);
      setEventValidation(`Error adding event: ${error.message}`);
    } finally {
      setIsAddingEvent(false);
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
      await deleteDoc(doc(db, 'tithis', id));
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

  // controlled inputs inside modal
  const [newPakshya, setNewPakshya] = useState('शुक्लपक्ष');
  const [newTithi, setNewTithi] = useState('');
  const [startDate, setStartDate] = useState(''); // Start date (YYYY-MM-DD)
  const [startTime, setStartTime] = useState('06:00'); // Default morning time
  const [endDate, setEndDate] = useState(''); // End date (YYYY-MM-DD)
  const [endTime, setEndTime] = useState('18:00'); // Default evening time
  const [validation, setValidation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tithiDropdownOpen, setTithiDropdownOpen] = useState(false);

  // Event form state - moved to dedicated modal
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventRepetition, setEventRepetition] = useState('none'); // 'none', 'monthly', 'yearly'
  const [eventType, setEventType] = useState('private'); // 'public', 'private', 'customer'
  const [eventAssociateMode, setEventAssociateMode] = useState('date'); // 'date' | 'tithi'
  const [selectedEventTithiId, setSelectedEventTithiId] = useState('');
  const [selectedTreeId, setSelectedTreeId] = useState('');
  const [selectedTreeMemberId, setSelectedTreeMemberId] = useState('');
  const [eventValidation, setEventValidation] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Tree + family member selection for "For Family Member" events
  const [availableTrees, setAvailableTrees] = useState([]);
  const [availableTreeMembers, setAvailableTreeMembers] = useState([]);

  useEffect(() => {
    if (!user) {
      setAvailableTrees([]);
      return;
    }

    const treesCol = collection(db, 'trees');
    const q = isAdmin
      ? query(treesCol)
      : query(treesCol, where('ownerUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const treesList = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((t) => !t.deleted);

      treesList.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
      setAvailableTrees(treesList);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    // Only load members while the add-event modal is open and "For Family Member" is selected.
    if (!addEventModalOpen || eventType !== 'customer') {
      setAvailableTreeMembers([]);
      return;
    }
    if (!selectedTreeId) {
      setAvailableTreeMembers([]);
      return;
    }

    const membersCol = collection(db, 'trees', selectedTreeId, 'members');
    const unsubscribe = onSnapshot(membersCol, (snapshot) => {
      const membersList = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((m) => !m.archived);

      membersList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setAvailableTreeMembers(membersList);
    });

    return () => unsubscribe();
  }, [addEventModalOpen, eventType, selectedTreeId]);

  // Keep selected tithi in sync with the selected event date when associating by tithi
  useEffect(() => {
    if (eventAssociateMode !== 'tithi') return;
    if (!eventDate) {
      setSelectedEventTithiId('');
      return;
    }

    const [y, m, d] = eventDate.split('-').map(Number);
    const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];

    if (tithisForEventDate.length === 0) {
      setSelectedEventTithiId('');
      return;
    }

    if (!selectedEventTithiId || !tithisForEventDate.some(t => t.id === selectedEventTithiId)) {
      setSelectedEventTithiId(tithisForEventDate[0].id);
    }
  }, [eventAssociateMode, eventDate, findTithisForAdDate, selectedEventTithiId]);

  useEffect(() => {
    if (addTithiModalOpen && modalFocusHint === 'tithi') {
      // focus after modal render
      setTimeout(() => {
        tithiInputRef.current?.focus();
      }, 40);
    }
    if (!addTithiModalOpen) {
      setModalFocusHint(null);
      setNewPakshya('शुक्लपक्ष'); 
      setNewTithi(''); 
      setStartDate('');
      setStartTime('06:00'); 
      setEndDate('');
      setEndTime('18:00'); 
      setValidation(''); 
      setIsLoading(false);
      setTithiDropdownOpen(false); // Close dropdown when modal closes
    }
    if (!detailsModalOpen && !addTithiModalOpen && !addEventModalOpen) {
      setActiveDate(null); // Clear active tile when all modals are closed
    }
    if (!addEventModalOpen) {
      // Reset event form when event modal closes
      setEventTitle('');
      setEventDescription('');
      setEventDate('');
      setEventRepetition('none');
      setEventType('private');
      setEventAssociateMode('date');
      setSelectedEventTithiId('');
      setSelectedTreeId('');
      setSelectedTreeMemberId('');
      setEventValidation('');
      setIsAddingEvent(false);
    }
  }, [addTithiModalOpen, detailsModalOpen, addEventModalOpen, modalFocusHint]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (tithiInputRef.current && !tithiInputRef.current.closest('.nc-custom-dropdown').contains(event.target)) {
        setTithiDropdownOpen(false);
      }
    }

    if (tithiDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tithiDropdownOpen]);

  async function submitAdd(){
    if (isLoading) return; // Prevent double submission
    
    if (isDev) console.log('submitAdd called with:', { newPakshya, newTithi, startDate, startTime, endDate, endTime, activeDate });
    
    setValidation('');
    if (!newPakshya) { 
      if (isDev) console.log('Validation failed: No pakshya selected');
      setValidation('Select a Pakshya'); 
      return; 
    }
    if (!newTithi) { 
      if (isDev) console.log('Validation failed: No tithi selected');
      setValidation('Select a Tithi'); 
      return; 
    }
    if (!startDate || !endDate) {
      if (isDev) console.log('Validation failed: Missing date fields', { startDate, endDate });
      if (!startDate) {
        setValidation('Please select a start date');
      } else {
        setValidation('Please select an end date');
      }
      return;
    }
    if (!startTime || !endTime) { 
      if (isDev) console.log('Validation failed: Missing time fields', { startTime, endTime });
      if (!startTime) {
        setValidation('Please select a start time'); 
      } else {
        setValidation('Please select an end time');
      }
      return; 
    }
    
    // Validate time format (HH:MM)
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      if (isDev) console.log('Validation failed: Invalid time format', { startTime, endTime });
      setValidation('Please enter valid time format (HH:MM)');
      return;
    }
    
    // Validate date range: endDate must be >= startDate
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) {
      if (isDev) console.log('Validation failed: End date before start date', { startDate, endDate });
      setValidation('End date cannot be before start date');
      return;
    }
    
    // If same date, validate time range
    if (startDate === endDate && endTime <= startTime) { 
      if (isDev) console.log('Validation failed: End time before start time on same date', { startTime, endTime });
      setValidation('End time must be after start time'); 
      return; 
    }
    
    if (isDev) console.log('Validation passed, attempting to add tithi...');
    setIsLoading(true);
    try {
      const fullTithiName = `${newPakshya} ${newTithi}`;
      await addTithi(activeDate, fullTithiName, startDate, startTime, endDate, endTime);
      if (isDev) console.log('Tithi added successfully, clearing form and closing modal');
      
      // Clear form and close modal on success
      setNewPakshya('शुक्लपक्ष'); 
      setNewTithi(''); 
      setStartDate('');
      setStartTime('06:00'); 
      setEndDate('');
      setEndTime('18:00');
      setValidation('');
      setAddTithiModalOpen(false);
    } catch (error) {
      console.error('Error in submitAdd:', error);
      setValidation('Failed to add tithi. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Helper function to get events for a specific date
  const getEventsForDate = useCallback((adYear, adMonthZeroBased, adDay) => {
    const dateKey = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    const targetTithis = findTithisForAdDate(adYear, adMonthZeroBased, adDay) || [];
    
    // Convert current AD date to Nepali for comparison
    const currentBsDate = convertAdToBs(adYear, adMonthZeroBased, adDay);
    
    if (isDev && currentBsDate) {
      console.log(`[getEventsForDate] Checking events for AD ${dateKey} = Nepali ${currentBsDate.year}/${currentBsDate.month}/${currentBsDate.day}`);
    }
    
    return calendarEvents.filter(event => {
      // 1. Exact Date Match
      if (event.dateKey === dateKey) {
        if (isDev) {
          console.log(`  ✓ Exact match: "${event.title}" (dateKey: ${event.dateKey})`);
        }
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
            const eventPakshaNepali = event.tithi.paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';
            if (tPaksha !== eventPakshaNepali) return false;
            
            // Match Tithi Name (e.g., 'Pratipada')
            // event.tithi.name might be 'Pratipada', tName might be 'प्रतिपदा' or 'Pratipada' depending on data
            // Let's use getTithiIndexByName to normalize
            const eventTithiIndex = getTithiIndexByName(event.tithi.name);
            const currentTithiIndex = getTithiIndexByName(tName);
            
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
  const getTreeMemberName = useCallback((memberId) => {
    if (!memberId || !treeMembers) return null;
    const member = treeMembers.find(m => m.id === memberId);
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

  // Helper function to parse pakshya and tithi from full tithi name
  const parseTithiName = (fullName) => {
    // Extract pakshya (first part before space) and tithi (remaining part)
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      const pakshya = parts[0]; // शुक्लपक्ष or कृष्णपक्ष
      const tithi = parts.slice(1).join(' '); // rest is tithi name
      return { pakshya, tithi };
    }
    return { pakshya: '', tithi: fullName };
  };

  // Helper function to get tithi display name with lunar month
  const getTithiDisplayName = (tithi) => {
    const { pakshya, tithi: tithiName } = parseTithiName(tithi.name);
    if (!tithi.startDate) {
      return tithi.name; // Fallback if no date
    }
    
    // Get the tithi lunar month for the start date
    // const [y, m, d] = tithi.startDate.split('-').map(Number);
    const pakshaNormalized = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
    const tithiIndex = getTithiIndexByName(tithiName);
    
    if (tithiIndex) {
      const lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
      if (lunarMonth) {
        return `${lunarMonth} ${pakshya} ${tithiName}`;
      }
    }
    
    return tithi.name; // Fallback to original name if calculation fails
  };

  // Helper function to format tithi datetime display
  const formatTithiDateTime = (tithi) => {
    if (!tithi.startDate && !tithi.endDate) {
      return `${formatTime12Hour(tithi.startTime)} — ${formatTime12Hour(tithi.endTime)}`;
    }

    // Parse start and end dates
    const [startY, startM, startD] = tithi.startDate.split('-').map(Number);
    const [endY, endM, endD] = tithi.endDate.split('-').map(Number);
    
    // Convert to Nepali dates
    const startBs = convertAdToBs(startY, startM - 1, startD);
    const endBs = convertAdToBs(endY, endM - 1, endD);
    
    // Format start date-time in Nepali
    const startDateStr = `${nepaliMonths[startBs.month - 1]} ${toNepaliNumber(startBs.day)}, ${toNepaliNumber(startBs.year)}`;
    const endDateStr = `${nepaliMonths[endBs.month - 1]} ${toNepaliNumber(endBs.day)}, ${toNepaliNumber(endBs.year)}`;
    
    // Always show full date-time format for consistency with 12-hour time
    // Format: "कात्तिक २७, २०८२, 6:00 AM — कात्तिक २८, २०८२, 6:00 PM"
    return `${startDateStr}, ${formatTime12Hour(tithi.startTime)} — ${endDateStr}, ${formatTime12Hour(tithi.endTime)}`;
}

// Helpers to compute millisecond timestamps for tithi start/end for robust ordering
// Normalize time strings: accept 'HH:MM', 'H:MM', or 'H:MM AM/PM' variations and return 'HH:MM' 24-hour or null
function normalizeTimeTo24(timeStr){
  if (!timeStr) return null;
  timeStr = String(timeStr).trim();
  // If already in 24-hour 'HH:MM' format
  const m24 = timeStr.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) return `${m24[1].padStart(2,'0')}:${m24[2]}`;
  // Match 12-hour with AM/PM e.g., '3:06 PM' or '03:06AM'
  const m12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (m12) {
    let h = parseInt(m12[1],10);
    const mm = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${mm}`;
  }
  return null;
}

function getTithiStartMillis(tithi){
  try{
    if (!tithi) return Infinity;
    if (tithi.startDate && tithi.startTime) {
      const t24 = normalizeTimeTo24(tithi.startTime) || tithi.startTime;
      // If normalization failed and t24 contains AM/PM, attempt Date parse fallback
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
  }catch(e){
    return Infinity;
  }
}

function getTithiEndMillis(tithi){
  try{
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
  }catch(e){
    return Infinity;
  }
}

function compareTithisByStart(a,b){
  const sa = getTithiStartMillis(a);
  const sb = getTithiStartMillis(b);
  if (sa !== sb) return sa - sb;
  const ea = getTithiEndMillis(a);
  const eb = getTithiEndMillis(b);
  if (ea !== eb) return ea - eb;
  return (a.name || '').localeCompare(b.name || '');
}
 
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
            <div className="nt-nepali-date">{toNepaliNumber(displayDay)}</div>
            <div className="nt-english-date">{adDate.getDate()}</div>
            <div className="nt-summary" aria-hidden>
              {events.length > 0 && (
                <div className="nt-summary-item event">
                  {events.map(e => e.title).join(' | ')}
                </div>
              )}
            </div>
            {parsedTithis.length > 0 && (
              <div className="nt-tithi-bottom" aria-hidden>
                {parsedTithis
                  .sort(compareTithisByStart)
                  .map(t => t.tithi)
                  .join(' / ')
                }
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
          {(canManageTithis && isEditMode) && (
            <button
              className="nt-quick-add-btn"
              aria-label="Quick add tithi"
              title="Add Tithi"
              onClick={(e)=>{ e.stopPropagation(); openAddTithiModalForDate(ad.year, ad.month, ad.day, 'tithi'); }}
            >+</button>
          )}

          <div className="nt-nepali-date" aria-hidden>{toNepaliNumber(day)}</div>
          <div className="nt-english-date" aria-hidden>{ad.day}</div>
          
          {/* Card body - shows events and family member events */}
          <div className="nt-summary" aria-hidden>
            {(() => {
              const { publicEvents, personalEvents } = categorizeEvents(events);
              return (
                <>
                  {publicEvents.length > 0 && (
                    <div className="nt-summary-item event-public">
                      {publicEvents.map(e => e.title).join(' | ')}
                    </div>
                  )}
                  {personalEvents.length > 0 && (
                    <div className="nt-summary-item event-personal">
                      {personalEvents.map(e => e.title).join(' | ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          
          {/* Tithi at bottom left */}
          {parsedTithis.length > 0 && (
            <div className="nt-tithi-bottom" aria-hidden>
              {parsedTithis
                .sort(compareTithisByStart)
                .map(t => t.tithi)
                .join(' / ')
              }
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
                      {publicEvents.map(e => e.title).join(' | ')}
                    </div>
                  )}
                  {personalEvents.length > 0 && (
                    <div className="nt-summary-item event-personal">
                      {personalEvents.map(e => e.title).join(' | ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {parsedTithis.length > 0 && (
            <div className="nt-tithi-bottom" aria-hidden>
              {parsedTithis
                .sort(compareTithisByStart)
                .map(t => t.tithi)
                .join(' / ')
              }
            </div>
          )}
        </div>
      );
    }

    return tiles;
  }

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
            {toNepaliNumber(todayBs.day)} {nepaliMonths[todayBs.month-1]} {toNepaliNumber(todayBs.year)}, {nepaliWeekdays[todayBs.dayOfWeek]}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {(() => {
              const h = todayAd.getUTCHours();
              const m = todayAd.getUTCMinutes();
              const s = todayAd.getUTCSeconds();
              // Determine time of day in Nepali
              let timeOfDay = '';
              if (h >= 0 && h < 12) {
                timeOfDay = 'बिहान'; // Morning (midnight to noon)
              } else if (h >= 12 && h < 17) {
                timeOfDay = 'दिउँसो'; // Afternoon (noon to 5 PM)
              } else if (h >= 17 && h < 19) {
                timeOfDay = 'साँझ'; // Evening (5 PM to 7 PM)
              } else {
                timeOfDay = 'रात'; // Night (7 PM to midnight)
              }
              const h12 = h % 12 || 12;
              return `${timeOfDay} ${toNepaliNumber(h12)}:${toNepaliNumber(String(m).padStart(2, '0'))}:${toNepaliNumber(String(s).padStart(2, '0'))}`;
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
            {englishMonths[todayAd.getUTCMonth()]} {todayAd.getUTCDate()}, {todayAd.getUTCFullYear()}
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
          <span className="nc-label nc-label-default">Prev</span>
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
              {nepaliMonths.map((mn, idx) => (
                <option key={mn} value={idx+1}>{mn}</option>
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
                <option key={y} value={y}>{toNepaliNumber(y)}</option>
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
          <span className="nc-label nc-label-default">Next</span>
          <span className="nc-label nc-label-hover">{getNextMonthName()}</span>
          <span className="nc-arrow nc-arrow-right">›</span>
        </button>
      </div>

      <div className="nc-weekdays">
        {nepaliWeekdays.map((nepaliDay, index) => (
          <div key={nepaliDay} className="nc-weekday">
            <div className="nc-weekday-nepali">{nepaliDay}</div>
            <div className="nc-weekday-english">{englishWeekdays[index]}</div>
          </div>
        ))}
      </div>

      <div className="nc-grid" role="grid" aria-label="Nepali calendar">
        {renderDayTiles()}
      </div>

      {/* Tithi Calculator removed from inline calendar; now available as separate block component */}

      {/* Details Modal - shows existing tithis and events with role-based visibility */}
      {detailsModalOpen && (
        <div className="nc-modal-backdrop" onClick={()=> setDetailsModalOpen(false)}>
          <div className="nc-modal" onClick={(e)=>e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="nc-modal-header">
              <h3 className="nc-modal-title" style={{ fontSize: '0.95rem', color: '#666' }}>
                Selected Date: {
                  (() => {
                    if (!activeDate) return '';
                    
                    // eslint-disable-next-line no-unused-vars
                    const [year, month, day] = activeDate.split('-').map(Number);
                    // const bs = convertAdToBs(year, month - 1, day);
                    
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[month - 1]} ${day}`;
                  })()
                }
              </h3>
              <button onClick={()=> setDetailsModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="nc-modal-body">

            {/* Tithis Section */}
            <div className="nc-modal-section">
              <h4>Tithis</h4>
              {modalTithis.length===0 && <div className="muted">✨ Tithis will be added soon for this date</div>}
              {modalTithis
                .sort(compareTithisByStart)
                .map(t => (
                <div key={t.id} className="nc-item">
                  <div>
                    <div className="nc-item-title">{getTithiDisplayName(t)}</div>
                    <div className="muted">{formatTithiDateTime(t)}</div>
                  </div>
                  {/* Delete functionality removed - admins should use Admin Management page */}
                </div>
              ))}
            </div>

            {/* Public Events Section */}
            <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <h4>Public Events</h4>
              {modalEvents.length===0 && <div className="muted">No public events for this date</div>}
              {modalEvents.map(event => {
                return (
                <div key={event.id} className="nc-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="nc-item-title">
                        {event.title}
                        {event.createdByAdmin && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#fbbf24', color: '#78350f', borderRadius: '0.25rem', fontWeight: '600' }}>Admin</span>}
                      </div>
                      {event.description && <div className="muted" style={{ marginTop: '0.25rem' }}>{event.description}</div>}
                    </div>
                    {/* Delete functionality removed - users/admins should use Admin Management page */}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Private Events Section - user's own private events */}
            <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Private Events
              </h4>
              {modalPersonalEvents.length===0 && <div className="muted">No private events for this date</div>}
              {modalPersonalEvents.map(event => {
                const memberName = getTreeMemberName(event.memberId);
                const isTreeEvent = !!event.treeId;

                // Use the same AD->BS formatting as Tree Detail page, based on event.dateKey
                const eventNepaliDate = event.dateKey 
                  ? formatAdDateToNepaliStringWithNumerals(event.dateKey) 
                  : '';
                return (
                  <div 
                    key={event.id} 
                    className="nc-item" 
                    style={{ 
                      flexDirection: 'column', 
                      alignItems: 'flex-start', 
                      gap: '0.5rem',
                      cursor: isTreeEvent && onTreeEventClick ? 'pointer' : 'default'
                    }}
                    onDoubleClick={() => {
                      if (isTreeEvent && onTreeEventClick) {
                        const eventData = {
                          ...event,
                          name: event.title,
                          date: event.dateKey,
                          personId: event.memberId
                        };
                        onTreeEventClick(eventData);
                        setDetailsModalOpen(false);
                      }
                    }}
                  >
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div className="nc-item-title">{event.title}</div>
                        {memberName && (
                          <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                            For: {memberName}
                          </div>
                        )}
                        {event.dateKey && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                            📅 {event.dateKey}
                            {eventNepaliDate && (
                              <div style={{ color: '#7c3aed', marginTop: '0.25rem' }}>🗓️ {eventNepaliDate}</div>
                            )}
                          </div>
                        )}
                        {event.description && <div className="muted" style={{ marginTop: '0.25rem' }}>{event.description}</div>}
                      </div>
                      {!isTreeEvent && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this event?')) {
                              try {
                                await deleteDoc(doc(db, 'calendarEvents', event.id));
                                setCalendarEvents((prev) => prev.filter((e) => e.id !== event.id));
                              } catch (err) {
                                console.error('Error deleting event:', err);
                                alert('Failed to delete event');
                              }
                            }
                          }}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer', 
                            fontSize: '1.1rem',
                            padding: '0 0 0 8px',
                            opacity: 0.7
                          }}
                          title="Delete Event"
                          onMouseOver={(e) => e.target.style.opacity = 1}
                          onMouseOut={(e) => e.target.style.opacity = 0.7}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="nc-modal-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* For Guests: Show "Login to Add Events" button */}
              {!user && (
                <button 
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (err) {
                      console.error('Login error:', err);
                    }
                  }}
                  className="nc-add-btn"
                  style={{ flex: '1 1 auto' }}
                >
                  Login to Add Events
                </button>
              )}
              
              {/* For Logged-in Users: Show "Add Event" button */}
              {user && (
                <button 
                  onClick={() => {
                    if (!activeDate) return;
                    const parts = activeDate.split('-').map(p=>+p);
                    const adYear = parts[0];
                    const adMonthZeroBased = parts[1]-1;
                    const adDay = parts[2];
                    openAddEventModalForDate(adYear, adMonthZeroBased, adDay);
                  }}
                  className="nc-add-btn"
                  style={{ flex: '1 1 auto' }}
                >
                  Add Event
                </button>
              )}

              {/* For Admins and Super Users with tithi permission: Show "Add Tithi" when in edit mode */}
              {(isAdmin || (isSuperUser && !permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS))) && isEditMode && (
                <button 
                  onClick={() => {
                    if (!activeDate) return;
                    const parts = activeDate.split('-').map(p=>+p);
                    const adYear = parts[0];
                    const adMonthZeroBased = parts[1]-1;
                    const adDay = parts[2];
                    openAddTithiModalForDate(adYear, adMonthZeroBased, adDay, 'tithi');
                  }}
                  className="nc-add-btn"
                  style={{ flex: '1 1 auto', background: '#f97316' }}
                >
                  Add Tithi
                </button>
              )}
              
              <button
                type="button"
                className="nc-cancel-btn"
                onClick={()=> setDetailsModalOpen(false)}
                style={{ flex: '1 1 auto' }}
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* App confirm modal for unsaved edits before jumping to today */}
      <ConfirmModal
        open={confirmOpen}
        title="Unsaved changes"
        message={'You have an open edit or pending changes on the calendar. If you go to the current month you may lose unsaved changes. Continue?'}
        confirmText="Go to Today"
        onConfirm={() => proceedGoToToday()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Add Tithi Modal - form for adding new tithi */}
      {addTithiModalOpen && (
        <div className="nc-modal-backdrop" onClick={()=> setAddTithiModalOpen(false)}>
          <div className="nc-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="nc-modal-header">
              <h3 className="nc-modal-title">{
                (() => {
                  if (!activeDate) return '';
                  const parts = activeDate.split('-').map(p=>+p);
                  const adYear = parts[0];
                  const adMonthZeroBased = parts[1]-1;
                  const adDay = parts[2];
                  const bs = convertAdToBs(adYear, adMonthZeroBased, adDay);
                  return `Add Tithi - ${nepaliMonths[bs.month-1]} ${toNepaliNumber(bs.day)}, ${toNepaliNumber(bs.year)}`;
                })()
              }</h3>
              <button onClick={()=> setAddTithiModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="nc-modal-body">
              <div className="nc-modal-section">
              {/* Pakshya Field */}
              <div className="nc-form-row">
                <label className="nc-label">पक्ष (Pakshya):</label>
                <select
                  value={newPakshya}
                  onChange={e => {
                    setNewPakshya(e.target.value);
                    setNewTithi(''); // Reset tithi when pakshya changes
                  }}
                  className="nc-select"
                >
                  <option value="शुक्लपक्ष">शुक्लपक्ष (Shukla Pakshya)</option>
                  <option value="कृष्णपक्ष">कृष्णपक्ष (Krishna Pakshya)</option>
                </select>
              </div>

              {/* Tithi Field */}
              <div className="nc-form-row">
                <label className="nc-label">तिथि (Tithi):</label>
                <div className="nc-custom-dropdown">
                  <div 
                    className="nc-dropdown-trigger nc-input"
                    onClick={() => setTithiDropdownOpen(!tithiDropdownOpen)}
                    ref={tithiInputRef}
                  >
                    <span className={!newTithi ? 'nc-placeholder' : ''}>
                      {newTithi || 'Select Tithi'}
                    </span>
                    <span className="nc-dropdown-arrow">▼</span>
                  </div>
                  {tithiDropdownOpen && (
                    <div className="nc-dropdown-menu">
                      <div 
                        className="nc-dropdown-option"
                        onClick={() => {
                          setNewTithi('');
                          setTithiDropdownOpen(false);
                        }}
                      >
                        Select Tithi
                      </div>
                      {(newPakshya === 'शुक्लपक्ष' ? shuklaPackshyaTithis : krishnaPackshyaTithis).map(tithi => (
                        <div 
                          key={tithi} 
                          className={`nc-dropdown-option ${newTithi === tithi ? 'selected' : ''}`}
                          onClick={() => {
                            setNewTithi(tithi);
                            setTithiDropdownOpen(false);
                          }}
                        >
                          {tithi}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Date Range Fields - Start */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <NepaliDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    label="आरम्भ मिति (Start Date)"
                    required
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="nc-label" style={{ marginBottom: '0.25rem' }}>आरम्भकाल (Start Time) *</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)}
                    onBlur={e => setStartTime(e.target.value)}
                    className="nc-input-time"
                    step="300"
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {startTime && formatTime12Hour(startTime)}
                  </div>
                </div>
              </div>

              {/* Date Range Fields - End */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <NepaliDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    label="समाप्ति मिति (End Date)"
                    required
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="nc-label" style={{ marginBottom: '0.25rem' }}>समाप्तिकाल (End Time) *</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)}
                    onBlur={e => setEndTime(e.target.value)}
                    className="nc-input-time"
                    step="300"
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {endTime && formatTime12Hour(endTime)}
                  </div>
                </div>
              </div>

              {/* Multi-day indicator */}
              {startDate && endDate && startDate !== endDate && (
                <div style={{ 
                  padding: '0.5rem', 
                  background: '#dbeafe', 
                  borderLeft: '3px solid #3b82f6',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem'
                }}>
                  ℹ️ This Tithi spans multiple days and will appear on all day cards from {startDate} to {endDate}
                </div>
              )}

              {validation && <div className="nc-validation">{validation}</div>}
              {!user && !authLoading && <div className="nc-validation">Please log in to add tithis</div>}
              
              <div className="nc-modal-actions">
                <button 
                  onClick={submitAdd} 
                  className="nc-add-btn"
                  disabled={isLoading || !user || authLoading}
                >
                  {isLoading ? 'Adding...' : !user ? 'Log in to Add' : 'Add Tithi'}
                </button>
                <button onClick={()=>{ setAddTithiModalOpen(false); setValidation(''); }}>Cancel</button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal - form for adding new event */}
      {addEventModalOpen && (
        <div className="nc-modal-backdrop" onClick={()=> setAddEventModalOpen(false)}>
          <div className="nc-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="nc-modal-header">
              <h3 className="nc-modal-title">{
                (() => {
                  if (!activeDate) return '';
                  const parts = activeDate.split('-').map(p=>+p);
                  const adYear = parts[0];
                  const adMonthZeroBased = parts[1]-1;
                  const adDay = parts[2];
                  const bs = convertAdToBs(adYear, adMonthZeroBased, adDay);
                  return `${nepaliMonths[bs.month-1]} ${toNepaliNumber(bs.day)}, ${toNepaliNumber(bs.year)}`;
                })()
              }</h3>
              <button onClick={()=> setAddEventModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="nc-modal-body">
              <div className="nc-modal-section">
              {/* Event Type Selection */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">Add Event:</label>
                <div className="nc-event-type-tabs" role="tablist" aria-label="Event type">
                  <button
                    type="button"
                    className={`nc-event-type-tab ${eventType === 'private' ? 'active' : ''}`}
                    onClick={() => {
                      setEventType('private');
                      setSelectedTreeId('');
                      setSelectedTreeMemberId('');
                    }}
                    aria-selected={eventType === 'private'}
                    role="tab"
                  >
                    For Self
                  </button>
                  <button
                    type="button"
                    className={`nc-event-type-tab ${eventType === 'customer' ? 'active' : ''}`}
                    onClick={() => {
                      setEventType('customer');
                    }}
                    aria-selected={eventType === 'customer'}
                    role="tab"
                  >
                    For Family Member
                  </button>
                  {(isAdmin || isSuperUser) && (
                    <button
                      type="button"
                      className={`nc-event-type-tab ${eventType === 'public' ? 'active' : ''}`}
                      onClick={() => {
                        setEventType('public');
                        setSelectedTreeId('');
                        setSelectedTreeMemberId('');
                      }}
                      aria-selected={eventType === 'public'}
                      role="tab"
                    >
                      Public
                    </button>
                  )}
                </div>
              </div>

              {/* Tree + Family Member Selection - shown when eventType is 'customer' */}
              {eventType === 'customer' && (
                <>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label className="nc-label">Select Tree:</label>
                      <select
                        value={selectedTreeId}
                        onChange={(e) => {
                          setSelectedTreeId(e.target.value);
                          setSelectedTreeMemberId('');
                        }}
                        className="nc-select"
                      >
                        <option value="">-- Select a tree --</option>
                        {availableTrees.map((tree) => (
                          <option key={tree.id} value={tree.id}>
                            {tree.title || 'Untitled Tree'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label className="nc-label">Select Family Member:</label>
                      <select
                        value={selectedTreeMemberId}
                        onChange={(e) => setSelectedTreeMemberId(e.target.value)}
                        className="nc-select"
                        disabled={!selectedTreeId}
                      >
                        <option value="">-- Select a family member --</option>
                        {availableTreeMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Event Title */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">Event Title:</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g., Birthday, Anniversary, etc."
                  className="nc-input"
                />
              </div>

              {/* Event Description */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">Description (Optional):</label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Add any additional details..."
                  className="nc-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Associate event with date or tithi */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">Associate With:</label>
                <div className="nc-event-type-tabs" role="tablist" aria-label="Associate event with">
                  <button
                    type="button"
                    className={`nc-event-type-tab ${eventAssociateMode === 'date' ? 'active' : ''}`}
                    onClick={() => setEventAssociateMode('date')}
                    aria-selected={eventAssociateMode === 'date'}
                    role="tab"
                  >
                    Date
                  </button>
                  <button
                    type="button"
                    className={`nc-event-type-tab ${eventAssociateMode === 'tithi' ? 'active' : ''}`}
                    onClick={() => setEventAssociateMode('tithi')}
                    aria-selected={eventAssociateMode === 'tithi'}
                    role="tab"
                  >
                    Tithi
                  </button>
                </div>
              </div>

              {eventAssociateMode === 'tithi' && (
                <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                  <label className="nc-label">Select Tithi:</label>
                  {(() => {
                    if (!eventDate) {
                      return <div className="muted">Select a date to choose a tithi.</div>;
                    }

                    const [y, m, d] = eventDate.split('-').map(Number);
                    const tithisForEventDate = (findTithisForAdDate(y, m - 1, d) || []).slice().sort(compareTithisByStart);

                    if (tithisForEventDate.length === 0) {
                      return <div className="muted">No tithi found for the selected date.</div>;
                    }

                    return (
                      <select
                        value={selectedEventTithiId}
                        onChange={(e) => setSelectedEventTithiId(e.target.value)}
                        className="nc-select"
                      >
                        {tithisForEventDate.map(t => (
                          <option key={t.id} value={t.id}>
                            {getTithiDisplayName(t)}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

              {/* Event Date - using NepaliDatePicker */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <NepaliDatePicker
                  value={eventDate}
                  onChange={setEventDate}
                  label="Event Date"
                  required
                />
              </div>

              {/* Event Repetition */}
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">Repeats:</label>
                <select
                  value={eventRepetition}
                  onChange={(e) => setEventRepetition(e.target.value)}
                  className="nc-select"
                >
                  <option value="none">Does not repeat</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {eventValidation && <div className="nc-validation">{eventValidation}</div>}
              {!user && !authLoading && <div className="nc-validation">Please log in to add events</div>}
              
              <div className="nc-modal-actions">
                <button 
                  onClick={submitAddEvent} 
                  className="nc-add-btn"
                  disabled={isAddingEvent || !user || authLoading}
                >
                  {isAddingEvent ? 'Adding...' : !user ? 'Log in to Add' : 'Add Event'}
                </button>
                <button
                  type="button"
                  className="nc-cancel-btn"
                  onClick={()=>{ setAddEventModalOpen(false); setEventValidation(''); }}
                >
                  Cancel
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};