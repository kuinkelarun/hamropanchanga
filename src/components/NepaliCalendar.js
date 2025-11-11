import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import './NepaliCalendar.css';
import ConfirmModal from './ConfirmModal';
import bsCalendarData from '../data/bsCalendarData';

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

export default function NepaliCalendar() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
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
  const [activeDate, setActiveDate] = useState(null);

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
    const q = query(tithisCollection, orderBy('dateKey'), orderBy('startTime'));
    
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
        const dateKey = tithi.dateKey;
        
        if (!tithisData[dateKey]) {
          tithisData[dateKey] = [];
        }
        tithisData[dateKey].push({
          id: tithi.id,
          name: tithi.name,
          startTime: tithi.startTime,
          endTime: tithi.endTime
        });
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

  // Authentication state listener
  useEffect(() => {
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
  }, []);


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

  const startDayOfWeek = useMemo(() => {
    if (!firstDayOfBsMonthAd) return 0;
    return new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day).getDay();
  }, [firstDayOfBsMonthAd]);

  function dateKeyFromAd(ad){ return `${ad.year}-${ad.month+1}-${ad.day}`; }

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
      const q = query(tithisCollection, orderBy('dateKey'), orderBy('startTime'));
      const snapshot = await getDocs(q);
      
      const tithisData = {};
      snapshot.docs.forEach((doc) => {
        const tithi = { id: doc.id, ...doc.data() };
        const dateKey = tithi.dateKey;
        
        if (!tithisData[dateKey]) {
          tithisData[dateKey] = [];
        }
        tithisData[dateKey].push({
          id: tithi.id,
          name: tithi.name,
          startTime: tithi.startTime,
          endTime: tithi.endTime
        });
      });
      
      console.log('Manual refresh completed, updating state with:', tithisData);
      setTithisByDate(tithisData);
    } catch (error) {
      console.error('Error in manual refresh:', error);
    }
  }, [setTithisByDate]);

  // Navigate to the current Nepali month/year (today)
  const handleGoToToday = useCallback(async () => {
    // If user has open modals / pending edits, open app modal to confirm
    if (addTithiModalOpen || detailsModalOpen) {
      setConfirmOpen(true);
      return;
    }
    // Otherwise proceed immediately
    await proceedGoToToday();
  }, [addTithiModalOpen, detailsModalOpen, refreshTithis, setActiveDate, setCurrentBsMonth, setCurrentBsYear, setAddTithiModalOpen, setDetailsModalOpen, setModalFocusHint, todayBs]);

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
  }, [refreshTithis, setActiveDate, setCurrentBsMonth, setCurrentBsYear, setAddTithiModalOpen, setDetailsModalOpen, setModalFocusHint, todayBs]);

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

  // open details modal when clicking on tile
  function openDetailsModalForDate(adYear, adMonthZeroBased, adDay){
    const key = `${adYear}-${adMonthZeroBased+1}-${adDay}`;
    setActiveDate(key);
    setDetailsModalOpen(true);
  }

  // open add tithi modal from + button or details modal
  function openAddTithiModalForDate(adYear, adMonthZeroBased, adDay, focusHint = null){
    const key = `${adYear}-${adMonthZeroBased+1}-${adDay}`;
    setActiveDate(key);
    setModalFocusHint(focusHint);
    setDetailsModalOpen(false); // Close details modal if open
    setAddTithiModalOpen(true);
  }

  async function addTithi(dateKey, name, startTime='', endTime=''){
    console.log('addTithi called with:', { dateKey, name, startTime, endTime, user: !!user });

    if (!user) {
      setValidation('Please log in to add tithis.');
      return;
    }

    // Helper: convert Nepali numerals to latin digits
    function nepaliDigitsToLatin(s) {
      if (!s) return s;
      const map = { '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };
      return String(s).split('').map(ch => map[ch] ?? ch).join('');
    }

    // Normalize incoming dateKey to canonical YYYY-MM-DD (zero-padded) and produce nepali display
    function normalizeToCanonical(inKey) {
      const original = String(inKey || '');
      let adYear, adMonth, adDay; // month: 1-12

      // Case 1: already AD like 2025-4-15 or 2025-04-15
      let m = original.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) {
        adYear = +m[1]; adMonth = +m[2]; adDay = +m[3];
      }

      // Case 2: dd/mm/yyyy (common UI english format)
      if (!adYear) {
        m = original.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) {
          adDay = +m[1]; adMonth = +m[2]; adYear = +m[3];
        }
      }

      // Case 3: BS Nepali like "५ माघ २०८१" or "5 माघ 2081" or with extra english date prefix
      if (!adYear) {
        // Try to extract BS tokens: day (maybe nepali digits), month name (nepali), year (maybe nepali digits)
        const bsMatch = original.match(/([\d०-९]{1,2})\s+([^\s]+)\s+([\d०-९]{3,4})/);
        if (bsMatch) {
          let bsDayStr = nepaliDigitsToLatin(bsMatch[1]);
          const bsMonthName = bsMatch[2];
          let bsYearStr = nepaliDigitsToLatin(bsMatch[3]);
          const bsDay = +bsDayStr;
          const bsYear = +bsYearStr;
          const monthIndex = nepaliMonths.findIndex(mn => mn === bsMonthName);
          if (monthIndex >= 0 && bsDay && bsYear) {
            const adObj = convertBsToAd(bsYear, monthIndex+1, bsDay);
            if (adObj) {
              adYear = adObj.year; adMonth = adObj.month + 1; adDay = adObj.day;
            }
          }
        }
      }

      // Fallback: try Date parsing
      if (!adYear) {
        const parsed = new Date(original);
        if (!isNaN(parsed.getTime())) {
          adYear = parsed.getFullYear(); adMonth = parsed.getMonth() + 1; adDay = parsed.getDate();
        }
      }

      if (!adYear) {
        // As a last resort, use today's AD date
        const now = new Date();
        adYear = now.getFullYear(); adMonth = now.getMonth() + 1; adDay = now.getDate();
      }

      const canonical = `${adYear}-${String(adMonth).padStart(2,'0')}-${String(adDay).padStart(2,'0')}`;
      const bs = convertAdToBs(adYear, adMonth-1, adDay);
      const nepaliDisplay = bs ? `${toNepaliNumber(bs.day)} ${nepaliMonths[bs.month-1]} ${toNepaliNumber(bs.year)}` : '';

      return { canonical, original, nepaliDisplay, adYear, adMonth, adDay };
    }

    const normalized = normalizeToCanonical(dateKey);
    const canonicalKey = normalized.canonical;
    const nepaliDateDisplay = normalized.nepaliDisplay;

    try {
      // Create the new tithi object
      const newTithi = {
        id: crypto.randomUUID(), // Generate temporary ID
        dateKey: canonicalKey, // store canonical zero-padded key
        originalDateKey: normalized.original,
        nepaliDateDisplay: nepaliDateDisplay,
        name: name,
        startTime: startTime,
        endTime: endTime,
        createdAt: new Date().toISOString()
      };

      // Update local state immediately (like customer events do)
      console.log('Updating local state immediately...');
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        if (!updatedTithis[canonicalKey]) {
          updatedTithis[canonicalKey] = [];
        }
        updatedTithis[canonicalKey] = [...updatedTithis[canonicalKey], {
          id: newTithi.id,
          name: newTithi.name,
          startTime: newTithi.startTime,
          endTime: newTithi.endTime
        }];
        console.log('Local state updated with new tithi:', updatedTithis);
        return updatedTithis;
      });

      // Then sync to Firebase
      console.log('Syncing to Firestore...');
      console.log('User authenticated:', !!user, 'User ID:', user?.uid);
      console.log('Data to save:', newTithi);
      
      const tithisCollection = collection(db, 'tithis');
      const docRef = await addDoc(tithisCollection, newTithi);
      console.log('Successfully added tithi to Firestore at', new Date().toLocaleTimeString(), 'with ID:', docRef.id);
      
      // Update the local state with the real Firebase ID
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        if (updatedTithis[canonicalKey]) {
          const tithiIndex = updatedTithis[canonicalKey].findIndex(t => t.id === newTithi.id);
          if (tithiIndex >= 0) {
            updatedTithis[canonicalKey][tithiIndex].id = docRef.id;
            console.log('Updated local state with real Firebase ID:', docRef.id);
          }
        }
        return updatedTithis;
      });

    } catch (error) {
      console.error('Error adding tithi:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error object:', error);
      setValidation(`Error adding tithi: ${error.message}`);
      
      // Revert local state on error
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        if (updatedTithis[canonicalKey]) {
          updatedTithis[canonicalKey] = updatedTithis[canonicalKey].filter(t => t.id !== newTithi.id);
        }
        return updatedTithis;
      });
    }
  }

  async function deleteTithi(dateKey, id){
    if (!user) {
      console.error('User not authenticated for delete operation');
      return;
    }

    // Store reference to the deleted tithi for potential rollback
    let deletedTithi = null;
    
    try {
      // Update local state immediately
      setTithisByDate(prevTithis => {
        const updatedTithis = { ...prevTithis };
        if (updatedTithis[dateKey]) {
          deletedTithi = updatedTithis[dateKey].find(t => t.id === id);
          updatedTithis[dateKey] = updatedTithis[dateKey].filter(t => t.id !== id);
          if (updatedTithis[dateKey].length === 0) {
            delete updatedTithis[dateKey];
          }
        }
        console.log('Local state updated after delete:', updatedTithis);
        return updatedTithis;
      });

      // Then sync to Firebase
      await deleteDoc(doc(db, 'tithis', id));
      console.log('Successfully deleted tithi from Firestore');
    } catch (error) {
      console.error('Error deleting tithi:', error);
      
      // Rollback local state on error
      if (deletedTithi) {
        setTithisByDate(prevTithis => {
          const updatedTithis = { ...prevTithis };
          if (!updatedTithis[dateKey]) {
            updatedTithis[dateKey] = [];
          }
          updatedTithis[dateKey].push(deletedTithi);
          return updatedTithis;
        });
      }
    }
  }

  // controlled inputs inside modal
  const [newPakshya, setNewPakshya] = useState('शुक्लपक्ष');
  const [newTithi, setNewTithi] = useState('');
  const [startTime, setStartTime] = useState('06:00'); // Default morning time
  const [endTime, setEndTime] = useState('18:00'); // Default evening time
  const [validation, setValidation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tithiDropdownOpen, setTithiDropdownOpen] = useState(false);

  useEffect(() => {
    if (addTithiModalOpen && modalFocusHint === 'tithi') {
      // focus after modal render
      setTimeout(() => {
        tithiInputRef.current?.focus();
      }, 40);
    }
    if (!addTithiModalOpen) {
      setModalFocusHint(null);
      setNewPakshya('शुक्लपक्ष'); setNewTithi(''); setStartTime('06:00'); setEndTime('18:00'); setValidation(''); setIsLoading(false);
      setTithiDropdownOpen(false); // Close dropdown when modal closes
    }
    if (!detailsModalOpen && !addTithiModalOpen) {
      setActiveDate(null); // Clear active tile when both modals are closed
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
    
    console.log('submitAdd called with:', { newPakshya, newTithi, startTime, endTime, activeDate });
    
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
    if (endTime <= startTime) { 
      console.log('Validation failed: End time before start time', { startTime, endTime });
      setValidation('End must be after start'); 
      return; 
    }
    
    console.log('Validation passed, attempting to add tithi...');
    setIsLoading(true);
    try {
      const fullTithiName = `${newPakshya} ${newTithi}`;
      await addTithi(activeDate, fullTithiName, startTime, endTime);
      console.log('Tithi added successfully, clearing form and closing modal');
      
      // Clear form and close modal on success
      setNewPakshya('शुक्लपक्ष'); 
      setNewTithi(''); 
      setStartTime('06:00'); 
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

        tiles.push(
          <div
            key={`${dateKey}-prev`}
            className="nt-day-tile other-month"
            onClick={() => { handlePrev(); /* navigate to prev month for context */ openDetailsModalForDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()); }}
            tabIndex={0}
            onKeyDown={(e)=> { if (e.key === 'Enter') { handlePrev(); openDetailsModalForDate(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()); } }}
            data-date={dateKey}
          >
            <div className="nt-nepali-date">{toNepaliNumber(displayDay)}</div>
            <div className="nt-english-date">{adDate.getDate()}</div>
            <div className="nt-summary" aria-hidden>
              {tithis.length > 0 && (
                <div className="nt-summary-item tithi">
                  {tithis
                    .sort((a,b)=> a.startTime.localeCompare(b.startTime))
                    .map(t => t.name)
                    .join(' / ')
                  }
                </div>
              )}
            </div>
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
      
      // Debug: Log tile rendering with dateKey and tithis
      if (day <= 5 || tithis.length > 0) { // Only log first few days and days with tithis
        console.log(`Rendering tile for day ${day}:`, {
          dateKey,
          tithisCount: tithis.length,
          tithisNames: tithis.map(t => t.name),
          allDateKeys: Object.keys(tithisByDate)
        });
      }

      tiles.push(
        <div
          key={dateKey}
          className={`nt-day-tile ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}`}
          onClick={()=> openDetailsModalForDate(ad.year, ad.month, ad.day)}
          tabIndex={0}
          onKeyDown={(e)=> { if (e.key === 'Enter') openDetailsModalForDate(ad.year, ad.month, ad.day); }}
          data-date={dateKey}
        >
          <button
            className="nt-quick-add-btn"
            aria-label="Quick add tithi"
            title="Add Tithi"
            onClick={(e)=>{ e.stopPropagation(); openAddTithiModalForDate(ad.year, ad.month, ad.day, 'tithi'); }}
          >+</button>

          {/* removed three-dot edit button: use tile click or quick-add (+) instead */}

          <div className="nt-nepali-date" aria-hidden>{toNepaliNumber(day)}</div>
          <div className="nt-english-date" aria-hidden>{ad.day}</div>
          <div className="nt-summary" aria-hidden>
            {tithis.length > 0 && (
              <div className="nt-summary-item tithi">
                {tithis
                  .sort((a, b) => a.startTime.localeCompare(b.startTime)) // Sort by start time
                  .map(t => t.name)
                  .join(' / ') // Join with slash separator
                }
              </div>
            )}
          </div>
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
            {tithis.length > 0 && (
              <div className="nt-summary-item tithi">
                {tithis
                  .sort((a,b)=> a.startTime.localeCompare(b.startTime))
                  .map(t => t.name)
                  .join(' / ')
                }
              </div>
            )}
          </div>
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

  // Expose manual debug helpers to window during development so they're usable and not flagged as unused
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshTithis = refreshTithis;
      window.debugFirestore = debugFirestore;
    }
    return () => {
      if (typeof window !== 'undefined') {
        try { delete window.refreshTithis; } catch (e) { window.refreshTithis = undefined; }
        try { delete window.debugFirestore; } catch (e) { window.debugFirestore = undefined; }
      }
    };
  }, [refreshTithis, debugFirestore]);
  
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
      </div>
      <div className="nc-header">
        <button onClick={handlePrev} className="nc-btn">‹ Prev</button>
        <div className="nc-center">
          <div className="nc-nepali">{nepaliMonths[currentBsMonth-1]} {toNepaliNumber(currentBsYear)}</div>
          <div className="nc-english">{englishMonths[firstDayOfBsMonthAd?.month ?? 0]} {firstDayOfBsMonthAd?.year ?? ''}</div>
        </div>
        <button onClick={handleNext} className="nc-btn">Next ›</button>
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

      {/* Details Modal - shows existing tithis */}
      {detailsModalOpen && (
        <div className="nc-modal-backdrop" onClick={()=> setDetailsModalOpen(false)}>
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
              <button onClick={()=> setDetailsModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="nc-modal-section">
              <h4>Tithis</h4>
              {modalTithis.length===0 && <div className="muted">No tithis for this date</div>}
              {modalTithis
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(t => (
                <div key={t.id} className="nc-item">
                  <div>
                    <div className="nc-item-title">{t.name}</div>
                    <div className="muted">{t.startTime} — {t.endTime}</div>
                  </div>
                  <button onClick={()=> deleteTithi(activeDate, t.id)} aria-label="Delete tithi">🗑</button>
                </div>
              ))}
            </div>

            <div className="nc-modal-actions">
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
                disabled={!user || authLoading}
              >
                {!user ? 'Log in to Add Tithi' : 'Add Tithi'}
              </button>
              <button onClick={()=> setDetailsModalOpen(false)}>Close</button>
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

              {/* Time Fields */}
              <div className="nc-form-row">
                <label className="nc-label">आरम्भकाल (Start Time):</label>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={e => setStartTime(e.target.value)}
                  onBlur={e => setStartTime(e.target.value)}
                  className="nc-input-time"
                  step="300"
                  required
                />
              </div>

              <div className="nc-form-row">
                <label className="nc-label">समाप्तिकाल (End Time):</label>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={e => setEndTime(e.target.value)}
                  onBlur={e => setEndTime(e.target.value)}
                  className="nc-input-time"
                  step="300"
                  required
                />
              </div>

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