import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, signInWithGoogle } from '../firebase';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import './NepaliCalendar.css';
import ConfirmModal from './ConfirmModal';
import bsCalendarData from '../data/bsCalendarData';
import { useSettings } from '../contexts/SettingsContext';
import NepaliDatePicker from './NepaliDatePicker';

const nepaliMonths = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
];
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
const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

function toNepaliNumber(num){
  return String(num).split('').map(d => nepaliNumbers[+d] ?? d).join('');
}

function getNepalDate(){
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nptOffset = 5.75 * 3600000;
  return new Date(utc + nptOffset);
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

function convertAdToBs(year, month, day){
  const adDate = new Date(year, month, day);
  let bsYear = null, totalDays = 0;
  for (const y of Object.keys(bsCalendarData).sort()) {
    const startAd = bsCalendarData[y].startAdDate;
    if (adDate >= startAd) {
      bsYear = +y;
      totalDays = Math.floor((adDate - startAd) / (1000*60*60*24)) + 1;
    } else break;
  }
  if (!bsYear) {
    bsYear = minBsYear;
    totalDays = 1;
  }
  let bsMonth = 1;
  let bsDay = totalDays;
  const months = bsCalendarData[bsYear].daysInMonths;
  for (let i=0;i<months.length;i++){
    if (bsDay <= months[i]) { bsMonth = i+1; break; }
    bsDay -= months[i];
  }
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek: adDate.getDay() };
}

function convertBsToAd(year, month, day){
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;
  let totalDays = 0;
  for (let i=0;i<month-1;i++) totalDays += bsCalendarData[year].daysInMonths[i];
  totalDays += day - 1;
  const adDate = new Date(start);
  adDate.setDate(start.getDate() + totalDays);
  return { year: adDate.getFullYear(), month: adDate.getMonth(), day: adDate.getDate() };
}

export default function NepaliCalendar({ user: propUser, isAdmin }) {
  const { isEditMode } = useSettings();
  const [user, setUser] = useState(propUser || null);
  const [authLoading, setAuthLoading] = useState(!propUser);
  // Track "today" in Nepal timezone and update daily so the topbar reflects the real current Nepali month/year
  const [todayAd, setTodayAd] = useState(() => getNepalDate());
  const [todayBs, setTodayBs] = useState(() => convertAdToBs(todayAd.getFullYear(), todayAd.getMonth(), todayAd.getDate()));

  // Keep todayAd/todayBs in sync with the real current time.
  // Instead of polling every minute, schedule a single timeout that fires exactly at the next NPT midnight.
  useEffect(() => {
    let timeoutId = null;

    function refreshToday() {
      const nowAd = getNepalDate();
      setTodayAd(nowAd);
      const bs = convertAdToBs(nowAd.getFullYear(), nowAd.getMonth(), nowAd.getDate());
      setTodayBs(bs);

      // Calculate milliseconds until next NPT midnight using the NPT fields (use UTC getters because getNepalDate()'s UTC fields represent NPT)
      const hours = nowAd.getUTCHours();
      const mins = nowAd.getUTCMinutes();
      const secs = nowAd.getUTCSeconds();
      const ms = nowAd.getUTCMilliseconds();
      const msSinceMidnight = ((hours * 60 + mins) * 60 + secs) * 1000 + ms;
      const msInDay = 24 * 60 * 60 * 1000;
      let msUntilNextMidnight = msInDay - msSinceMidnight;

      // Safety: if computed time is very small or negative, schedule a short delay
      if (msUntilNextMidnight <= 0) msUntilNextMidnight = 1000;

      // Add a small buffer (200ms) to avoid race conditions around the exact boundary
      timeoutId = setTimeout(() => {
        refreshToday();
      }, msUntilNextMidnight + 200);
    }

    // Initialize
    refreshToday();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const [currentBsYear, setCurrentBsYear] = useState(() => todayBs.year);
  const [currentBsMonth, setCurrentBsMonth] = useState(() => todayBs.month);
  const [tithisByDate, setTithisByDate] = useState({}); // { "YYYY-M-D": [{name,start,end}, ...] }
  const [calendarEvents, setCalendarEvents] = useState([]); // Array of calendar events
  const [activeDate, setActiveDate] = useState(null);

  // Permissions
  const { hasPermission, loading: permsLoading, isSuperUser } = useUserPermissions(user);
  const canManageTithis = isAdmin || (!permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS));
  const canManageEvents = isAdmin || (!permsLoading && hasPermission(PERMISSIONS.MANAGE_EVENTS));

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

  // Load tithis from Firebase on component mount - only after authentication
  useEffect(() => {
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return; // Wait for auth to complete
    }

    console.log('Setting up Firebase listener for tithis...', { user: !!user, authLoading });
    const tithisCollection = collection(db, 'tithis');
    const q = query(tithisCollection, orderBy('startDate'), orderBy('startTime'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Firebase snapshot received:', {
        docsCount: snapshot.docs.length,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
        timestamp: new Date().toLocaleTimeString()
      });
      
      const tithisData = {};
      snapshot.docs.forEach((doc, index) => {
        const tithi = { id: doc.id, ...doc.data() };
        console.log(`Processing tithi ${index + 1}:`, tithi);
        
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
      
      console.log('Final tithisData being set:', tithisData);
      console.log('Total dates with tithis:', Object.keys(tithisData).length);
      setTithisByDate(tithisData);
    }, (error) => {
      console.error('Firebase onSnapshot error:', error);
      console.error('This could be a permissions issue. Check Firestore rules and authentication.');
    });

    return () => {
      console.log('Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [authLoading, user]); // Re-run when auth state changes

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
        // Test Firestore permissions
        try {
          const testCollection = collection(db, 'tithis');
          const testQuery = query(testCollection, orderBy('dateKey'));
          await getDocs(testQuery);
        } catch (permissionError) {
          console.error('Firestore permissions test: FAILED', permissionError);
        }
      }
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [propUser]);

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
      console.log('Auth still loading for events, waiting...');
      return;
    }

    console.log('Setting up Firebase listener for calendar events...', { user: !!user, isAdmin });
    const eventsCollection = collection(db, 'calendarEvents');
    
    if (!user) {
      // Guests: only public events
      const q = query(
        eventsCollection, 
        where('isPublic', '==', true),
        orderBy('dateKey')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Firebase events snapshot received (guest):', {
          docsCount: snapshot.docs.length,
          timestamp: new Date().toLocaleTimeString()
        });
        
        const events = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        
        console.log('Calendar events loaded (guest):', events.length, events);
        setCalendarEvents(events);
      }, (error) => {
        console.error('Firebase events onSnapshot error:', error);
      });

      return () => {
        console.log('Cleaning up calendar events listener');
        unsubscribe();
      };
    } else {
      // Logged-in users: fetch public events AND their own private events
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
      
      const eventsByIdMap = new Map();
      
      const unsubscribe1 = onSnapshot(publicQuery, (snapshot) => {
        console.log('Public events snapshot:', snapshot.docs.length);
        snapshot.docs.forEach(docSnap => {
          eventsByIdMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        setCalendarEvents(Array.from(eventsByIdMap.values()));
      }, (error) => {
        console.error('Public events error:', error);
      });
      
      const unsubscribe2 = onSnapshot(userQuery, (snapshot) => {
        console.log('User events snapshot:', snapshot.docs.length);
        snapshot.docs.forEach(docSnap => {
          eventsByIdMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        setCalendarEvents(Array.from(eventsByIdMap.values()));
      }, (error) => {
        console.error('User events error:', error);
      });

      // If admin, also fetch all admin-created private events
      let unsubscribe3 = null;
      if (isAdmin) {
        const adminPrivateQuery = query(
          eventsCollection,
          where('createdByAdmin', '==', true),
          where('isPublic', '==', false),
          orderBy('dateKey')
        );
        
        unsubscribe3 = onSnapshot(adminPrivateQuery, (snapshot) => {
          console.log('Admin private events snapshot:', snapshot.docs.length);
          snapshot.docs.forEach(docSnap => {
            eventsByIdMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          });
          setCalendarEvents(Array.from(eventsByIdMap.values()));
        }, (error) => {
          console.error('Admin private events error:', error);
        });
      }

      return () => {
        console.log('Cleaning up calendar events listeners');
        unsubscribe1();
        unsubscribe2();
        if (unsubscribe3) unsubscribe3();
      };
    }
  }, [authLoading, user, isAdmin]);


  useEffect(()=>{
    if (currentBsYear < minBsYear) setCurrentBsYear(minBsYear);
    if (currentBsYear > maxBsYear) setCurrentBsYear(maxBsYear);
  }, [currentBsYear]);

  const nepaliMonthDays = useMemo(() => {
    return bsCalendarData[currentBsYear]?.daysInMonths[currentBsMonth-1] ?? 30;
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
    console.log('Manual refresh triggered...');
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
      
      console.log('Manual refresh completed, updating state with:', tithisData);
      setTithisByDate(tithisData);
    } catch (error) {
      console.error('Error in manual refresh:', error);
    }
  }, [setTithisByDate]);

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
  }, []);

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
    console.log('openAddTithiModalForDate called with:', { adYear, adMonthZeroBased, adDay });
    // Use consistently padded YYYY-MM-DD for activeDate
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    setActiveDate(key);
    setModalFocusHint(focusHint);
    
    // Set default start and end dates to the selected date (in YYYY-MM-DD format)
    const defaultDate = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    console.log('openAddTithiModalForDate: Setting defaultDate to:', defaultDate);
    setStartDate(defaultDate);
    setEndDate(defaultDate);
    
    setDetailsModalOpen(false); // Close details modal if open
    setAddTithiModalOpen(true);
  }

  async function addTithi(dateKey, name, startDate, startTime='', endDate, endTime=''){
    console.log('addTithi called with:', { dateKey, name, startDate, startTime, endDate, endTime, user: !!user });

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

      console.log('Tithi spans dates:', affectedDates);

      // Update local state immediately - add to all affected dates
      console.log('Updating local state immediately...');
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
        
        console.log('Local state updated with new tithi across dates:', affectedDates);
        return updatedTithis;
      });

      // Then sync to Firebase
      console.log('Syncing to Firestore...');
      console.log('User authenticated:', !!user, 'User ID:', user?.uid);
      
      // Create data for Firestore (without the temporary ID)
      const tithiData = {
        name: newTithi.name,
        startDate: newTithi.startDate,
        startTime: newTithi.startTime,
        endDate: newTithi.endDate,
        endTime: newTithi.endTime,
        createdAt: newTithi.createdAt
      };
      
      console.log('Data to save:', tithiData);
      
      const tithisCollection = collection(db, 'tithis');
      const docRef = await addDoc(tithisCollection, tithiData);
      console.log('Successfully added tithi to Firestore at', new Date().toLocaleTimeString(), 'with ID:', docRef.id);
      
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
        console.log('Updated local state with real Firebase ID:', docRef.id);
        return updatedTithis;
      });

    } catch (error) {
      console.error('Error adding tithi:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error object:', error);
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

      console.log('Deleting tithi from dates:', affectedDates);
      
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
        console.log('Local state updated after delete');
        return updatedTithis;
      });

      // Then sync to Firebase
      await deleteDoc(doc(db, 'tithis', id));
      console.log('Successfully deleted tithi from Firestore');
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

  // Calendar Event Management Functions
  async function addCalendarEvent(dateKey, eventData) {
    if (!user) {
      console.error('User not authenticated for event creation');
      return;
    }

    try {
      const newEvent = {
        dateKey,
        title: eventData.title,
        description: eventData.description || '',
        createdBy: user.uid,
        // Allow admins OR users with manageEvents permission to create public events
        isPublic: (isAdmin || hasPermission(PERMISSIONS.MANAGE_EVENTS)) && eventData.isPublic === true,
        createdByAdmin: isAdmin || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(eventData.customerId && { customerId: eventData.customerId }),
        ...(eventData.familyMemberId && { familyMemberId: eventData.familyMemberId })
      };

      const eventsCollection = collection(db, 'calendarEvents');
      const docRef = await addDoc(eventsCollection, newEvent);
      console.log('Successfully added calendar event with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding calendar event:', error);
      throw error;
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

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventIsPublic, setEventIsPublic] = useState(false);
  const [showAddEventForm, setShowAddEventForm] = useState(false);

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
    if (!detailsModalOpen && !addTithiModalOpen) {
      setActiveDate(null); // Clear active tile when both modals are closed
    }
    if (!detailsModalOpen) {
      // Reset event form when details modal closes
      setShowAddEventForm(false);
      setEventTitle('');
      setEventDescription('');
      setEventIsPublic(false);
    }
  }, [addTithiModalOpen, detailsModalOpen, modalFocusHint]);

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
    
    console.log('submitAdd called with:', { newPakshya, newTithi, startDate, startTime, endDate, endTime, activeDate });
    
    setValidation('');
    if (!newPakshya) { 
      console.log('Validation failed: No pakshya selected');
      setValidation('Select a Pakshya'); 
      return; 
    }
    if (!newTithi) { 
      console.log('Validation failed: No tithi selected');
      setValidation('Select a Tithi'); 
      return; 
    }
    if (!startDate || !endDate) {
      console.log('Validation failed: Missing date fields', { startDate, endDate });
      if (!startDate) {
        setValidation('Please select a start date');
      } else {
        setValidation('Please select an end date');
      }
      return;
    }
    if (!startTime || !endTime) { 
      console.log('Validation failed: Missing time fields', { startTime, endTime });
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
      console.log('Validation failed: Invalid time format', { startTime, endTime });
      setValidation('Please enter valid time format (HH:MM)');
      return;
    }
    
    // Validate date range: endDate must be >= startDate
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) {
      console.log('Validation failed: End date before start date', { startDate, endDate });
      setValidation('End date cannot be before start date');
      return;
    }
    
    // If same date, validate time range
    if (startDate === endDate && endTime <= startTime) { 
      console.log('Validation failed: End time before start time on same date', { startTime, endTime });
      setValidation('End time must be after start time'); 
      return; 
    }
    
    console.log('Validation passed, attempting to add tithi...');
    setIsLoading(true);
    try {
      const fullTithiName = `${newPakshya} ${newTithi}`;
      await addTithi(activeDate, fullTithiName, startDate, startTime, endDate, endTime);
      console.log('Tithi added successfully, clearing form and closing modal');
      
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
    const dateKey = `${adYear}-${adMonthZeroBased + 1}-${adDay}`;
    return calendarEvents.filter(event => event.dateKey === dateKey);
  }, [calendarEvents]);

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
      if (day <= 5 || tithis.length > 0 || events.length > 0) { // Only log first few days and days with content
        console.log(`Rendering tile for day ${day}:`, {
          dateKey,
          tithisCount: tithis.length,
          eventsCount: events.length,
          tithisNames: tithis.map(t => t.name),
          eventTitles: events.map(e => e.title)
        });
      }

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
          {(canManageTithis) && (
            <button
              className="nt-quick-add-btn"
              aria-label="Quick add tithi"
              title="Add Tithi"
              onClick={(e)=>{ e.stopPropagation(); openAddTithiModalForDate(ad.year, ad.month, ad.day, 'tithi'); }}
            >+</button>
          )}

          <div className="nt-nepali-date" aria-hidden>{toNepaliNumber(day)}</div>
          <div className="nt-english-date" aria-hidden>{ad.day}</div>
          
          {/* Card body - shows events only */}
          <div className="nt-summary" aria-hidden>
            {events.length > 0 && (
              <div className="nt-summary-item event">
                {events.map(e => e.title).join(' | ')}
              </div>
            )}
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

  // Get events for the active date in modal
  const modalEvents = useMemo(() => {
    if (!activeDate || !calendarEvents.length) return [];
    return calendarEvents.filter(event => event.dateKey === activeDate);
  }, [activeDate, calendarEvents]);

  // Expose manual debug helpers to window during development so they're usable and not flagged as unused
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshTithis = refreshTithis;
      window.debugFirestore = debugFirestore;
      // Temporary debug helper: get tithis for a specific AD date key (try both padded and unpadded keys)
      window.getTithisForDate = (dateKey) => {
        console.log('Requested dateKey:', dateKey);
        const k1 = dateKey;
        const k2 = (() => {
          const parts = String(dateKey).split('-').map(p => p.padStart(2,'0'));
          if (parts.length === 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
          return dateKey;
        })();
        const result = tithisByDate[k1] || tithisByDate[k2] || tithisByDate[dateKey] || null;
        console.log('Found tithis:', result);
        return result;
      };
      window.listTithisKeys = () => {
        const keys = Object.keys(tithisByDate || {});
        console.log('tithisByDate keys count:', keys.length);
        console.log(keys.slice(0,200));
        return keys;
      };
      window.getTithisForDateLoose = (dateKey) => {
        // Try multiple common formats and substring matches
        const candidates = [];
        const asParts = String(dateKey).split('-').map(p => p.replace(/^0+/, ''));
        const variants = [
          `${asParts[0]}-${asParts[1]}-${asParts[2]}`,
          `${asParts[0]}-${String(asParts[1]).padStart(2,'0')}-${String(asParts[2]).padStart(2,'0')}`,
          `${asParts[0]}-${String(asParts[1])}-${String(asParts[2]).padStart(2,'0')}`,
          `${asParts[0]}-${String(asParts[1]).padStart(2,'0')}-${asParts[2]}`
        ];
        const keys = Object.keys(tithisByDate || {});
        for (const k of keys) {
          if (variants.includes(k)) candidates.push({ key: k, tithis: tithisByDate[k] });
          if (k.includes(dateKey) || k.includes(dateKey.replace(/0/g, ''))) candidates.push({ key: k, tithis: tithisByDate[k] });
        }
        console.log('Loose search candidates:', candidates.slice(0,50));
        return candidates;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        try { delete window.refreshTithis; } catch (e) { window.refreshTithis = undefined; }
        try { delete window.debugFirestore; } catch (e) { window.debugFirestore = undefined; }
        try { delete window.getTithisForDate; } catch (e) { window.getTithisForDate = undefined; }
        try { delete window.listTithisKeys; } catch (e) { window.listTithisKeys = undefined; }
        try { delete window.getTithisForDateLoose; } catch (e) { window.getTithisForDateLoose = undefined; }
      }
    };
  }, [refreshTithis, debugFirestore, tithisByDate]);
  
  
  // Debug: Log when tithisByDate state changes
  useEffect(() => {
    console.log('=== TITHIS STATE UPDATE ===');
    console.log('tithisByDate changed:', tithisByDate);
    console.log('Total dates with tithis:', Object.keys(tithisByDate).length);
    Object.entries(tithisByDate).forEach(([dateKey, tithis]) => {
      console.log(`Date ${dateKey}: ${tithis.length} tithis`, tithis.map(t => t.name));
    });
    console.log('=== END STATE UPDATE ===');
  }, [tithisByDate]);
  
  // Debug: Log modal tithis when modal is open and activeDate changes
  useEffect(() => {
    if ((detailsModalOpen || addTithiModalOpen) && activeDate) {
      console.log('Modal opened for date:', activeDate);
      console.log('tithisByDate keys:', Object.keys(tithisByDate));
      console.log('modalTithis for', activeDate, ':', modalTithis);
    }
  }, [detailsModalOpen, addTithiModalOpen, activeDate, tithisByDate, modalTithis]);

  return (
    <div className="nepali-calendar-container">
      {/* Top bar above the calendar header */}
      <div className="nc-topbar">
        <button
          className="nc-topbar-btn"
          onClick={handleGoToToday}
          title={`Go to current Nepali month: ${nepaliMonths[todayBs.month-1]} ${toNepaliNumber(todayBs.year)}`}
        >
          Nepali Calendar {toNepaliNumber(todayBs.year)} {nepaliMonths[todayBs.month-1]}
        </button>
          {/* Right-aligned month/year controls (keep selects here) */}
          <div className="nc-topbar-right">
            <div className="nc-select-month-year" role="group" aria-label="Jump to Nepali month and year">
              <select
                className="nc-select-month"
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
                className="nc-select-year"
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
            {/* Screen-reader announcement region: polite live updates when month/year changes */}
            <div className="sr-only" aria-live="polite" aria-atomic="true" id="nc-month-announcement">
              {`Nepali ${nepaliMonths[currentBsMonth-1]} ${toNepaliNumber(currentBsYear)} — ${adMonthRangeDisplay}`}
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
          {/* Restore the BS/AD display back into the calendar header (original place) */}
          <div className="nc-header-display" aria-hidden>
            <div className="nc-header-bs">{nepaliMonths[currentBsMonth-1]} {toNepaliNumber(currentBsYear)}</div>
            <div className="nc-header-ad">{adMonthRangeDisplay}</div>
          </div>
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
              <button onClick={()=> setDetailsModalOpen(false)} aria-label="Close">✕</button>
            </div>

            {/* Tithis Section */}
            <div className="nc-modal-section">
              <h4>Tithis</h4>
              {modalTithis.length===0 && <div className="muted">✨ Tithis will be added soon for this date</div>}
              {modalTithis
                .sort(compareTithisByStart)
                .map(t => (
                <div key={t.id} className="nc-item">
                  <div>
                    <div className="nc-item-title">{t.name}</div>
                    <div className="muted">{formatTithiDateTime(t)}</div>
                  </div>
                  {/* Delete functionality removed - admins should use Admin Management page */}
                </div>
              ))}
            </div>

            {/* Events Section */}
            <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <h4>Events</h4>
              {modalEvents.length===0 && <div className="muted">No events for this date</div>}
              {modalEvents.map(event => (
                <div key={event.id} className="nc-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="nc-item-title">
                        {event.title}
                        {event.createdByAdmin && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#fbbf24', color: '#78350f', borderRadius: '0.25rem', fontWeight: '600' }}>Admin</span>}
                        {!event.isPublic && event.createdByAdmin && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#e9d5ff', color: '#6b21a8', borderRadius: '0.25rem', fontWeight: '600' }}>Admin Private</span>}
                        {!event.isPublic && !event.createdByAdmin && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#dbeafe', color: '#1e40af', borderRadius: '0.25rem', fontWeight: '600' }}>Private</span>}
                      </div>
                      {event.description && <div className="muted" style={{ marginTop: '0.25rem' }}>{event.description}</div>}
                    </div>
                    {/* Delete functionality removed - users/admins should use Admin Management page */}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Event Form - shown when user clicks "Add Event" */}
            {showAddEventForm && user && (
              <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem', background: '#f9fafb' }}>
                <h4>Add New Event</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Event title (required)"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    rows={3}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                  {/* Show public checkbox for admins or users with manageEvents permission */}
                  {(canManageEvents) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={eventIsPublic}
                        onChange={(e) => setEventIsPublic(e.target.checked)}
                      />
                      <span>Make this event public (visible to all users)</span>
                    </label>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={async () => {
                        if (!eventTitle.trim()) {
                          alert('Please enter an event title');
                          return;
                        }
                        try {
                          await addCalendarEvent(activeDate, {
                            title: eventTitle.trim(),
                            description: eventDescription.trim(),
                            isPublic: eventIsPublic
                          });
                          setShowAddEventForm(false);
                          setEventTitle('');
                          setEventDescription('');
                          setEventIsPublic(false);
                        } catch (error) {
                          alert(`Error adding event: ${error.message}`);
                        }
                      }}
                      className="nc-add-btn"
                      style={{ flex: 1 }}
                    >
                      Save Event
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEventForm(false);
                        setEventTitle('');
                        setEventDescription('');
                        setEventIsPublic(false);
                      }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

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
              
              {/* For Logged-in Users: Show "Add Event" button (single shared button for all users) */}
              {user && !showAddEventForm && (
                <button 
                  onClick={() => setShowAddEventForm(true)}
                  className="nc-add-btn"
                  style={{ flex: '1 1 auto' }}
                >
                  Add Event
                </button>
              )}

              {/* For Admins and Super Users with tithi permission: Show "Add Tithi" when in edit mode */}
              {(isAdmin || (isSuperUser && !permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS))) && isEditMode && !showAddEventForm && (
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
              
              <button onClick={()=> setDetailsModalOpen(false)} style={{ flex: '1 1 auto' }}>Close</button>
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
      )}
    </div>
  );
};