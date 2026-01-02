import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, updateDoc, where, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './AdminManagement.css';
import NepaliDatePicker from './NepaliDatePicker';
import NepaliCalendarManagement from './NepaliCalendarManagement';
import { convertAdToBs, toNepaliNumber, nepaliMonths, parseNepaliDate, formatAdDateToNepaliStringWithNumerals, formatNepaliDateTime } from '../utils/nepaliDateUtils';
import { getEphemerisData, computeTithiFromLongitudes } from '../utils/ephemeris';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

// Tithi options for dropdown
const allTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा", "औंसी"
];

// Nepali Tithi names for Excel generation
const shuklaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"];
const krishnaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"];

// Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Helper to compute start milliseconds for tithi entries (used for sorting)
function getTithiStartMillis_Admin(tithi) {
  try {
    if (!tithi) return Infinity;
    if (tithi.startDate && tithi.startTime) {
      const ts = String(tithi.startTime).trim();
      const m24 = ts.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (m24) return new Date(`${tithi.startDate}T${m24[1].padStart(2,'0')}:${m24[2]}:00`).getTime();
      const m12 = ts.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (m12) {
        let h = parseInt(m12[1],10);
        const mm = m12[2];
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return new Date(`${tithi.startDate}T${String(h).padStart(2,'0')}:${mm}:00`).getTime();
      }
      const dt = new Date(`${tithi.startDate} ${tithi.startTime}`);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : Infinity;
    }
    if (tithi.startDate) return new Date(`${tithi.startDate}T00:00:00`).getTime();
    return Infinity;
  } catch (e) {
    return Infinity;
  }
}

// Helper to compute end milliseconds for tithi entries (used for anomaly detection)
function getTithiEndMillis_Admin(tithi) {
  try {
    if (!tithi) return -Infinity;
    if (tithi.endDate && tithi.endTime) {
      const ts = String(tithi.endTime).trim();
      const m24 = ts.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (m24) return new Date(`${tithi.endDate}T${m24[1].padStart(2,'0')}:${m24[2]}:00`).getTime();
      const m12 = ts.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (m12) {
        let h = parseInt(m12[1],10);
        const mm = m12[2];
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return new Date(`${tithi.endDate}T${String(h).padStart(2,'0')}:${mm}:00`).getTime();
      }
      const dt = new Date(`${tithi.endDate} ${tithi.endTime}`);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : -Infinity;
    }
    if (tithi.endDate) return new Date(`${tithi.endDate}T23:59:59`).getTime();
    return -Infinity;
  } catch (e) {
    return -Infinity;
  }
}


export default function AdminManagement({ user, isAdmin, onBack }) {
  console.log('AdminManagement loaded - version 2025-11-14-v4', { isAdmin });
  
  const navigate = useNavigate();
  const { tab } = useParams();

  // If user lands on /admin/management without a tab, redirect to the default tithis tab
  React.useEffect(() => {
    if (!tab) {
      navigate('/admin/management/tithis', { replace: true });
    }
  }, [tab, navigate]);
  
  // Get user permissions using the new hook
  const { hasPermission, loading: permsLoading } = useUserPermissions(user);

  // Determine whether the current user can access admin management features
  const canAccessAdminPage = isAdmin ||
    hasPermission(PERMISSIONS.BULK_UPLOAD) ||
    hasPermission(PERMISSIONS.MANAGE_TITHIS) ||
    hasPermission(PERMISSIONS.MANAGE_EVENTS) ||
    hasPermission(PERMISSIONS.MANAGE_HOME_CARDS);
  
  // Get active tab from URL parameter, default to 'tithis'
  const [activeTab, setActiveTabLocal] = useState(tab || 'tithis');
  
  // Update local state when URL param changes
  useEffect(() => {
    if (tab) {
      setActiveTabLocal(tab);
    }
  }, [tab]);
  
  // Wrapper to update both local state and URL
  const setActiveTab = (tabName) => {
    setActiveTabLocal(tabName);
    navigate(`/admin/management/${tabName}`);
  };
  
  const [tithis, setTithis] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [validationResults, setValidationResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRecordData, setNewRecordData] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, type: '', count: 0, confirmText: '' });
  
  // Auto Management state
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoEndDate, setAutoEndDate] = useState('');
  const [autoProgress, setAutoProgress] = useState(null);
  const [autoStatus, setAutoStatus] = useState(null);
  
  const fileInputRef = useRef(null);
  const hasLoadedData = useRef(false);

  // Helper function to convert AD date to Nepali display
  const getNepaliDateDisplay = (adDateString) => {
    if (!adDateString) return '';
    try {
      const [year, month, day] = adDateString.split('-').map(Number);
      const bs = convertAdToBs(year, month - 1, day);
      return `(${toNepaliNumber(bs.year)}/${toNepaliNumber(bs.month)}/${toNepaliNumber(bs.day)})`;
    } catch (e) {
      return '';
    }
  };

  // Admin-only scan state for detecting tithis where end < start
  const [scanResults, setScanResults] = useState([]);
  const [scanning, setScanning] = useState(false);

  // Scan all tithis in Firestore and find records where end < start
  async function scanTithisForBoundaryErrors() {
    setScanning(true);
    setUploadStatus('🔎 Scanning tithis for boundary anomalies...');
    try {
      const collectionRef = collection(db, 'tithis');
      const snapshot = await getDocs(collectionRef);
      const anomalies = [];
      snapshot.docs.forEach(d => {
        const data = d.data() || {};
        const startMs = getTithiStartMillis_Admin(data);
        const endMs = getTithiEndMillis_Admin(data);
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
          anomalies.push({
            docId: d.id,
            embeddedId: data.id || null,
            name: data.name || '',
            startDate: data.startDate || '',
            startTime: data.startTime || '',
            endDate: data.endDate || '',
            endTime: data.endTime || '',
            startIso: isFinite(startMs) ? new Date(startMs).toISOString() : '',
            endIso: isFinite(endMs) ? new Date(endMs).toISOString() : ''
          });
        }
      });
      setScanResults(anomalies);
      setUploadStatus(`🔎 Scan complete: ${anomalies.length} anomalies found`);
    } catch (error) {
      console.error('Error scanning tithis:', error);
      setUploadStatus('❌ Error scanning tithis: ' + error.message);
    } finally {
      setScanning(false);
    }
  }

  // Fix a tithi by swapping its start/end fields when end < start
  async function fixTithiSwap(docId) {
    if (!docId) return;
    if (!window.confirm(`Swap start/end for tithi document ${docId}?`)) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'tithis', docId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setUploadStatus('❌ Document not found: ' + docId);
        return;
      }
      const data = snap.data() || {};
      const updated = {
        startDate: data.endDate || data.startDate,
        startTime: data.endTime || data.startTime,
        endDate: data.startDate || data.endDate,
        endTime: data.startTime || data.endTime,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(docRef, updated);
      setUploadStatus(`✅ Swapped start/end for ${docId}`);
      // Refresh list and scan results
      await loadTithis();
      await scanTithisForBoundaryErrors();
    } catch (error) {
      console.error('Error fixing tithi swap:', error);
      setUploadStatus('❌ Error fixing tithi: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Define load functions with useCallback
  const loadTithis = useCallback(async () => {
    try {
      const tithisCollection = collection(db, 'tithis');
      // Don't use orderBy in query - it excludes documents without those fields
      // Instead, fetch all and sort in JavaScript
      const snapshot = await getDocs(tithisCollection);
      const tithisData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in JavaScript (handles missing fields gracefully)
      tithisData.sort((a, b) => {
        const sa = getTithiStartMillis_Admin(a);
        const sb = getTithiStartMillis_Admin(b);
        if (sa !== sb) return sa - sb;
        // Fallback to lexical compare on name
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setTithis(tithisData);
    } catch (error) {
      console.error('Error loading tithis:', error);
      setUploadStatus('Error loading tithis: ' + error.message);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const eventsCollection = collection(db, 'calendarEvents');
      // Don't use orderBy in query - it excludes documents without those fields
      const snapshot = await getDocs(eventsCollection);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in JavaScript (handles missing fields gracefully)
      eventsData.sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || ''));
      
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
      setUploadStatus('Error loading events: ' + error.message);
    }
  }, []);

  // Load existing data on mount
  useEffect(() => {
    console.log('useEffect triggered - canAccessAdminPage:', canAccessAdminPage, 'hasLoadedData:', hasLoadedData.current);
    if (!canAccessAdminPage || hasLoadedData.current) return;
    console.log('Loading data...');
    hasLoadedData.current = true;
    setLoading(true);
    Promise.all([loadTithis(), loadEvents()]).finally(() => {
      setLoading(false);
    });
  }, [canAccessAdminPage, loadTithis, loadEvents]);

  // Reset filters when switching tabs
  useEffect(() => {
    setSearchTerm('');
    setYearFilter('all');
    setMonthFilter('all');
  }, [activeTab]);

  // Compute recent (last 30 days) item counts for UI enable/disable
  const recentThreshold = new Date();
  recentThreshold.setDate(recentThreshold.getDate() - 30);
  const recentIso = recentThreshold.toISOString();
  const recentTithisCount = tithis.filter(t => t.createdAt && t.createdAt > recentIso).length;
  const recentEventsCount = events.filter(e => e.createdAt && e.createdAt > recentIso).length;
  const recentCount = recentTithisCount + recentEventsCount;

  

  // While permissions are loading, show a loading state instead of denying access prematurely
  if (permsLoading) {
    return (
      <div className="admin-management">
        <div className="loading">Checking permissions...</div>
      </div>
    );
  }

  // Redirect if user has no admin-like permissions
  if (!canAccessAdminPage) {
    return (
      <div className="admin-management">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  // Generate Excel template for download with data validation dropdowns
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    
    if (activeTab === 'tithis') {
      // Tithis template with examples using Nepali dates
      const wsData = [
        ['Tithi*', 'Pakshya*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
        ['एकादशी', 'शुक्लपक्ष', '२०८२-०७-३१', '06:00', '२०८२-०८-०१', '18:00', 'ADD', 'Festival'],
        ['अष्टमी', 'कृष्णपक्ष', '२०८२-०८-०६', '10:00', '२०८२-०८-०६', '22:00', 'ADD', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
      
      // Add data validation for Pakshya column (column B, starting from row 2)
      // eslint-disable-next-line no-unused-vars
      const pakshyaValidation = {
        type: 'list',
        allowBlank: false,
        formula1: '"शुक्लपक्ष,कृष्णपक्ष"',
        showErrorMessage: true,
        errorTitle: 'Invalid Pakshya',
        error: 'Please select either शुक्लपक्ष or कृष्णपक्ष'
      };
      
      // Apply validation to first 1000 rows
      if (!ws['!dataValidation']) ws['!dataValidation'] = [];
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'B2:B1000',
        formulas: ['"शुक्लपक्ष,कृष्णपक्ष"']
      });
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'G2:G1000',
        formulas: ['"ADD,REPLACE"']
      });
      
      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
      
      // Add reference sheet with all valid tithi names
      const tithiReference = [
        ['Pakshya Values', 'Shukla Pakshya Tithis', 'Krishna Pakshya Tithis'],
        ['शुक्लपक्ष', 'प्रतिपदा', 'प्रतिपदा'],
        ['कृष्णपक्ष', 'द्वितीया', 'द्वितीया'],
        ['', 'तृतीया', 'तृतीया'],
        ['', 'चतुर्थी', 'चतुर्थी'],
        ['', 'पञ्चमी', 'पञ्चमी'],
        ['', 'षष्ठी', 'षष्ठी'],
        ['', 'सप्तमी', 'सप्तमी'],
        ['', 'अष्टमी', 'अष्टमी'],
        ['', 'नवमी', 'नवमी'],
        ['', 'दशमी', 'दशमी'],
        ['', 'एकादशी', 'एकादशी'],
        ['', 'द्वादशी', 'द्वादशी'],
        ['', 'त्रयोदशी', 'त्रयोदशी'],
        ['', 'चतुर्दशी', 'चतुर्दशी'],
        ['', 'पूर्णिमा', 'औंसी'],
        ['', '', ''],
        ['Instructions:', '', ''],
        ['1. Enter only the Tithi name (e.g., एकादशी) in Tithi column', '', ''],
        ['2. Select Pakshya from dropdown', '', ''],
        ['3. Date format: YYYY-MM-DD Nepali (e.g., २०८२-०७-३१)', '', ''],
        ['4. Time format: HH:MM in 24-hour (e.g., 06:00, 18:00)', '', ''],
        ['5. End Date can be same as Start Date or next day', '', ''],
        ['6. AddOrReplace: ADD (append) or REPLACE (delete existing for date & add new)', '', ''],
      ];
      const wsRef = XLSX.utils.aoa_to_sheet(tithiReference);
      wsRef['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
      
    } else {
      // Events template with validation using Nepali dates
      const wsData = [
        ['Title*', 'Description', 'Date* (YYYY-MM-DD Nepali)', 'Is Public* (TRUE/FALSE)', 'AddOrReplace*', 'Associated Person (optional)'],
        ['Family Gathering', 'Annual family reunion', '२०८२-०९-१०', 'TRUE', 'ADD', 'John Doe'],
        ['Birthday Celebration', 'Grandmother\'s birthday', '२०८२-०८-१६', 'FALSE', 'ADD', 'Mary Smith'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 25 }];
      
      // Add data validation for Is Public column (column D) and AddOrReplace column (column E)
      if (!ws['!dataValidation']) ws['!dataValidation'] = [];
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'D2:D1000',
        formulas: ['"TRUE,FALSE"']
      });
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'E2:E1000',
        formulas: ['"ADD,REPLACE"']
      });
      
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
      
      // Add reference sheet with instructions
      const eventReference = [
        ['Instructions:', ''],
        ['1. Title is required - brief event name', ''],
        ['2. Description is optional - detailed information', ''],
        ['3. Date format: YYYY-MM-DD Nepali (e.g., २०८२-०९-१०)', ''],
        ['4. Is Public: Select TRUE or FALSE from dropdown', ''],
        ['   - TRUE: Visible to all users', ''],
        ['   - FALSE: Only visible to you', ''],
        ['5. AddOrReplace: ADD (append) or REPLACE (delete existing for date & add new)', ''],
        ['6. Associated Person is optional', ''],
      ];
      const wsRef = XLSX.utils.aoa_to_sheet(eventReference);
      wsRef['!cols'] = [{ wch: 45 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    }
    
    const fileName = activeTab === 'tithis' ? 'Tithis_Template.xlsx' : 'Events_Template.xlsx';
    XLSX.writeFile(wb, fileName);
    setUploadStatus(`✅ Template downloaded: ${fileName}`);
  }

  // Export existing data to Excel
  function exportData() {
    const wb = XLSX.utils.book_new();
    
    if (activeTab === 'tithis') {
      // Deduplicate exported rows by composite key to avoid exact duplicates in Excel
      const seen = new Set();
      const uniqueRows = [];
      tithis.forEach(t => {
        const nameParts = (t.name || '').split(' ');
        const pakshya = nameParts[0] || '';
        const tithi = nameParts.slice(1).join(' ') || t.name || '';
        const row = [
          tithi,
          pakshya,
          formatAdDateToNepaliStringWithNumerals(t.startDate),
          t.startTime || '',
          formatAdDateToNepaliStringWithNumerals(t.endDate),
          t.endTime || '',
          'ADD'
        ];
        const key = `${tithi}|${pakshya}|${t.startDate || ''}|${t.startTime || ''}|${t.endDate || ''}|${t.endTime || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.push(row);
        }
      });

      const wsData = [
        ['Tithi*', 'Pakshya*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*'],
        ...uniqueRows
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
      XLSX.writeFile(wb, 'Tithis_Export.xlsx');
      const removed = tithis.length - uniqueRows.length;
      setUploadStatus(`✅ Exported ${uniqueRows.length} tithis to Tithis_Export.xlsx${removed > 0 ? ` (removed ${removed} duplicate rows)` : ''}`);
    } else {
      const wsData = [
        ['Title*', 'Description', 'Date* (YYYY-MM-DD Nepali)', 'Is Public* (TRUE/FALSE)', 'AddOrReplace*'],
        ...events.map(e => [
          e.title || '',
          e.description || '',
          formatAdDateToNepaliStringWithNumerals(e.dateKey),
          e.isPublic ? 'TRUE' : 'FALSE',
          'ADD'
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 30 }, { wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
      XLSX.writeFile(wb, 'Events_Export.xlsx');
      setUploadStatus(`✅ Exported ${events.length} events to Events_Export.xlsx`);
    }
  }

  // Export problematic rows (from validationResults.problematic) to Excel for audit
  function exportProblematicRows() {
    if (!validationResults || !validationResults.problematic || validationResults.problematic.length === 0) {
      setUploadStatus('❌ No problematic rows to export');
      return;
    }

    const wb = XLSX.utils.book_new();
    const header = ['Row', 'Tithi', 'Pakshya', 'Start Date (Nepali)', 'Start Time', 'End Date (Nepali)', 'End Time', 'AddOrReplace', 'Category', 'Reason'];
    const wsData = [header];

    validationResults.problematic.forEach(item => {
      const row = item.data || {};
      wsData.push([
        item.row || '',
        row['Tithi*'] || row['Tithi'] || '',
        row['Pakshya*'] || row['Pakshya'] || '',
        row['Start Date* (MM-DD-YYYY Nepali)'] || row['Start Date'] || '',
        row['Start Time* (HH:MM)'] || row['Start Time'] || '',
        row['End Date* (MM-DD-YYYY Nepali)'] || row['End Date'] || '',
        row['End Time* (HH:MM)'] || row['End Time'] || '',
        row['AddOrReplace*'] || row['AddOrReplace'] || '',
        row['Category (optional)'] || '',
        item.reason || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Problematic Rows');

    const fileName = `Problematic_Rows_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setUploadStatus(`✅ Exported ${validationResults.problematic.length} problematic rows to ${fileName}`);
  }

  // Generate Tithi Excel file for date range
  async function generateTithiExcel() {
    if (!autoStartDate || !autoEndDate) {
      setAutoStatus('❌ Please select both start and end dates');
      return;
    }

    // Parse the date input as UTC midnight to avoid local timezone ambiguities
    // Input `autoStartDate` and `autoEndDate` come from <input type="date" /> which yields
    // a YYYY-MM-DD string. Construct an explicit UTC instant to ensure consistent behavior
    // across client timezones when calling the ephemeris function.
    const start = new Date(`${autoStartDate}T00:00:00Z`);
    const end = new Date(`${autoEndDate}T00:00:00Z`);

    if (start > end) {
      setAutoStatus('❌ Start date must be before end date');
      return;
    }

    setAutoProgress(0);
    setAutoStatus('🔄 Calculating Tithis...');

    try {
      // We'll collect candidate rows with parsed UTC instants and epoch ms,
      // then sort them chronologically before exporting.
      const candidateRows = []; // { startIsoUtc, endIsoUtc, startEpoch, row }
      const seenStartIsos = new Set();
      let duplicatesSkipped = 0;
      let outOfRangeSkipped = 0;
      const rangeStartEpoch = start.getTime();
      const rangeEndExclusive = end.getTime() + 24 * 60 * 60 * 1000; // endUTC + 24h (exclusive)

      const diagnostics = []; // per-seed diagnostics for debugging and audit
      // Instead of sampling once per UTC day, iterate by tithi boundaries to ensure
      // every tithi start is captured. Start at the beginning of the requested UTC window
      // and repeatedly ask the ephemeris for the tithi at `current`. Advance `current` to
      // the reported tithi end + 1s and repeat until past the requested range.
      let current = new Date(rangeStartEpoch);
      const maxIterations = 1000;
      let iter = 0;
      while (current.getTime() < rangeEndExclusive && iter < maxIterations) {
        iter++;
        let ephemerisData;
        try {
          ephemerisData = await getEphemerisData(current);
          console.log('Ephemeris data for', current.toISOString(), ':', ephemerisData);
          if (ephemerisData && ephemerisData.error) {
            console.error('Firebase function error:', ephemerisData.error);
            setAutoStatus(`❌ Firebase function error for ${current.toDateString()}: ${ephemerisData.error.message || 'Unknown error'}`);
            break;
          }
        } catch (error) {
          console.error('Error calling getEphemerisData for', current.toISOString(), ':', error);
          // Fallback: create a synthetic ephemeris window to avoid infinite loop
          ephemerisData = {
            moonLon: 0,
            sunLon: 0,
            tithiStart: current.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            tithiEnd: new Date(current.getTime() + 12 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
          };
          setAutoStatus(`⚠️ Using estimated data for ${current.toDateString()} (Firebase unavailable)`);
        }

        if (!ephemerisData || typeof ephemerisData !== 'object' || !ephemerisData.tithiStart || !ephemerisData.tithiEnd) {
          console.error('Invalid ephemeris data for', current.toISOString(), ephemerisData);
          // Advance by 12 hours to avoid stalling
          current = new Date(current.getTime() + 12 * 60 * 60 * 1000);
          continue;
        }

        const tithiResult = computeTithiFromLongitudes(ephemerisData.moonLon, ephemerisData.sunLon);
        let finalTithiResult = tithiResult;
        if (!tithiResult || typeof tithiResult !== 'object' || !tithiResult.paksha) {
          finalTithiResult = { paksha: 'Shukla', pakshaIndex: 1 };
        }

        // Parse UTC times
        let startTimeUTC = new Date(ephemerisData.tithiStart);
        let endTimeUTC = new Date(ephemerisData.tithiEnd);
        if (!isNaN(startTimeUTC.getTime()) && !isNaN(endTimeUTC.getTime()) && endTimeUTC.getTime() < startTimeUTC.getTime()) {
          const tmp = startTimeUTC; startTimeUTC = endTimeUTC; endTimeUTC = tmp;
        }

        if (isNaN(startTimeUTC.getTime()) || isNaN(endTimeUTC.getTime())) {
          console.error('Invalid tithi start/end for', current.toISOString(), ephemerisData);
          current = new Date(current.getTime() + 12 * 60 * 60 * 1000);
          continue;
        }

        // Formatting
        const startFmt = formatNepaliDateTime(startTimeUTC);
        const endFmt = formatNepaliDateTime(endTimeUTC);
        const startNepaliDate = formatAdDateToNepaliStringWithNumerals(startFmt.adDateIso);
        const endNepaliDate = formatAdDateToNepaliStringWithNumerals(endFmt.adDateIso);
        const startTimeStr = startFmt.time24;
        const endTimeStr = endFmt.time24;

        const pakshya = finalTithiResult.paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';
        const tithiNames = finalTithiResult.paksha === 'Shukla' ? shuklaNames : krishnaNames;
        const tithiName = tithiNames[finalTithiResult.pakshaIndex - 1] || `Tithi ${finalTithiResult.pakshaIndex}`;

        const startIso = startTimeUTC.toISOString();
        const endIso = endTimeUTC.toISOString();
        const startEpoch = startTimeUTC.getTime();

        const inRange = (startEpoch >= rangeStartEpoch && startEpoch < rangeEndExclusive);
        const isDuplicate = seenStartIsos.has(startIso);

        // Include Nepal local AD date and BS date in diagnostics for boundary validation
        const startFmtLocal = formatNepaliDateTime(startTimeUTC);
        diagnostics.push({
          seedDateUtc: current.toISOString(),
          tithiStartUtc: startIso,
          tithiEndUtc: endIso,
          startEpoch,
          paksha: finalTithiResult.paksha,
          pakshaIndex: finalTithiResult.pakshaIndex,
          tithiName,
          inRange,
          isDuplicate,
          startAdDateNpt: startFmtLocal ? startFmtLocal.adDateIso : null,
          startBsDate: startFmtLocal ? startFmtLocal.bsDate : null
        });

        if (!inRange) {
          outOfRangeSkipped++;
        } else if (isDuplicate) {
          duplicatesSkipped++;
        } else {
          seenStartIsos.add(startIso);
          candidateRows.push({ startIsoUtc: startIso, endIsoUtc: endIso, startEpoch, row: [tithiName, pakshya, startNepaliDate, startTimeStr, endNepaliDate, endTimeStr, 'ADD', ''] });
        }

        // Advance current to just after this tithi's end to find the next tithi
        current = new Date(endTimeUTC.getTime() + 1000);
        // Update progress relative to the requested UTC window
        const progress = Math.min(100, Math.round(((current.getTime() - rangeStartEpoch) / (rangeEndExclusive - rangeStartEpoch)) * 100));
        setAutoProgress(progress);
      }

      // Sort and export candidate rows
      if (candidateRows.length === 0) {
        setAutoStatus('❌ No Tithi data calculated for the selected range');
        return;
      }

      candidateRows.sort((a, b) => a.startEpoch - b.startEpoch);

      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Tithi*', 'Pakshya*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
        ...candidateRows.map(c => c.row)
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];

      // Add data validation
      if (!ws['!dataValidation']) ws['!dataValidation'] = [];
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'B2:B1000',
        formulas: ['"शुक्लपक्ष,कृष्णपक्ष"']
      });
      ws['!dataValidation'].push({
        type: 'list',
        allowBlank: false,
        sqref: 'G2:G1000',
        formulas: ['"ADD,REPLACE"']
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
      // If duplicates were skipped earlier, report count; otherwise report generated count
      const fileName = `Tithis_Auto_${autoStartDate.replace(/-/g, '')}_to_${autoEndDate.replace(/-/g, '')}.xlsx`;
      // Also append diagnostics sheet to the workbook for auditing
      try {
        const diagWs = XLSX.utils.json_to_sheet(diagnostics.map(d => ({
          seedDateUtc: d.seedDateUtc,
          tithiStartUtc: d.tithiStartUtc,
          tithiEndUtc: d.tithiEndUtc,
          startEpoch: d.startEpoch,
          paksha: d.paksha,
          pakshaIndex: d.pakshaIndex,
          tithiName: d.tithiName,
          inRange: d.inRange ? 'YES' : 'NO',
          isDuplicate: d.isDuplicate ? 'YES' : 'NO'
        })));
        XLSX.utils.book_append_sheet(wb, diagWs, 'Diagnostics');
      } catch (diagErr) {
        console.warn('Failed to append diagnostics sheet:', diagErr);
      }

      XLSX.writeFile(wb, fileName);
      const generated = candidateRows.length;
      const removedMsgParts = [];
      if (duplicatesSkipped > 0) removedMsgParts.push(`${duplicatesSkipped} duplicate` + (duplicatesSkipped > 1 ? 's' : '') + ' skipped');
      if (outOfRangeSkipped > 0) removedMsgParts.push(`${outOfRangeSkipped} out-of-range` + (outOfRangeSkipped > 1 ? ' rows' : ' row') + ' skipped');
      const removedMsg = removedMsgParts.length > 0 ? ` (${removedMsgParts.join(', ')})` : '';
      setAutoStatus(`✅ Generated ${generated} Tithi records in ${fileName}${removedMsg}`);
      setAutoProgress(100);
      
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setAutoProgress(0);
        setAutoStatus('');
      }, 5000);

    } catch (error) {
      console.error('Error generating Tithi Excel:', error);
      setAutoStatus('❌ Error generating Tithi Excel: ' + error.message);
    }
  }

  // Handle file selection
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadStatus(`File selected: ${file.name}`);
      setValidationResults(null);
      setPreviewData([]);
    }
  }

  // Handle file drop
  function handleFileDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadFile(file);
      setUploadStatus(`File selected: ${file.name}`);
      setValidationResults(null);
      setPreviewData([]);
    } else {
      setUploadStatus('❌ Please upload a valid Excel file (.xlsx or .xls)');
    }
  }

  // Validate and parse Excel file
  async function validateAndParseFile() {
    if (!uploadFile) {
      setUploadStatus('❌ Please select a file first');
      return;
    }

    setLoading(true);
    setUploadStatus('Validating file...');

    try {
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setUploadStatus('❌ File is empty');
        setLoading(false);
        return;
      }

      const results = {
        valid: [],
        invalid: [],
        problematic: [],
        toAdd: [],
        toUpdate: []
      };

      if (activeTab === 'tithis') {
        validateTithisData(jsonData, results);
      } else {
        validateEventsData(jsonData, results);
      }

      setValidationResults(results);
      setPreviewData(results.valid);
      
      const summary = `
        ✅ Validation Complete:
        • ${results.valid.length} valid records
        • ${results.toAdd.length} new records to add
        • ${results.toUpdate.length} existing records to update
        • ${results.invalid.length} invalid records (see errors below)
        • ${results.problematic.length} problematic records (exportable)
      `;
      setUploadStatus(summary);
    } catch (error) {
      console.error('Error parsing file:', error);
      setUploadStatus('❌ Error parsing file: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function validateTithisData(jsonData, results) {
    jsonData.forEach((row, index) => {
      const errors = [];
      const rowNum = index + 2; // +2 because Excel starts at 1 and we have header row

      // Required fields
      const tithi = row['Tithi*']?.toString().trim();
      const pakshya = row['Pakshya*']?.toString().trim();
      const startDateRaw = row['Start Date* (YYYY-MM-DD Nepali)']?.toString().trim();
      const startTime = row['Start Time* (HH:MM)']?.toString().trim();
      const endDateRaw = row['End Date* (YYYY-MM-DD Nepali)']?.toString().trim();
      const endTime = row['End Time* (HH:MM)']?.toString().trim();
      const addOrReplace = row['AddOrReplace*']?.toString().trim().toUpperCase();

      if (!tithi) errors.push('Tithi is required');
      if (!pakshya) errors.push('Pakshya is required');
      if (!startDateRaw) errors.push('Start Date is required');
      if (!startTime) errors.push('Start Time is required');
      if (!endDateRaw) errors.push('End Date is required');
      if (!endTime) errors.push('End Time is required');
      if (!addOrReplace) errors.push('AddOrReplace is required');

      // Validate pakshya value
      if (pakshya && pakshya !== 'शुक्लपक्ष' && pakshya !== 'कृष्णपक्ष') {
        errors.push('Pakshya must be either शुक्लपक्ष or कृष्णपक्ष');
      }

      // Validate AddOrReplace value
      if (addOrReplace && addOrReplace !== 'ADD' && addOrReplace !== 'REPLACE') {
        errors.push('AddOrReplace must be either ADD or REPLACE');
      }

      // Parse Nepali dates to AD format
      const startDate = startDateRaw ? parseNepaliDate(startDateRaw) : null;
      const endDate = endDateRaw ? parseNepaliDate(endDateRaw) : null;

      if (startDateRaw && !startDate) {
        errors.push('Start Date must be in YYYY-MM-DD format (Nepali)');
      }
      if (endDateRaw && !endDate) {
        errors.push('End Date must be in YYYY-MM-DD format (Nepali)');
      }

      // Normalize and validate time formats. Accept both 24-hour (HH:MM) and 12-hour with AM/PM.
      function normalizeTimeTo24(ts) {
        if (!ts) return null;
        const s = String(ts).trim();
        // 24-hour e.g., 05:05 or 17:30
        const m24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (m24) return `${m24[1].padStart(2,'0')}:${m24[2]}`;
        // 12-hour with AM/PM e.g., 5:05 AM, 05:05PM
        const m12 = s.match(/^(1[0-2]|0?\d):([0-5]\d)\s*([AaPp][Mm])$/);
        if (m12) {
          let h = parseInt(m12[1], 10);
          const mm = m12[2];
          const ampm = m12[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return `${String(h).padStart(2,'0')}:${mm}`;
        }
        // Try to parse loose formats like '5:05AM' or '5:05am'
        const m12b = s.match(/^(1[0-2]|0?\d):([0-5]\d)([AaPp][Mm])$/);
        if (m12b) {
          let h = parseInt(m12b[1], 10);
          const mm = m12b[2];
          const ampm = m12b[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return `${String(h).padStart(2,'0')}:${mm}`;
        }
        return null;
      }

      const parsedStartTime = normalizeTimeTo24(startTime);
      const parsedEndTime = normalizeTimeTo24(endTime);
      if (!parsedStartTime) errors.push('Start Time must be in HH:MM (24h) or h:MM AM/PM format');
      if (!parsedEndTime) errors.push('End Time must be in HH:MM (24h) or h:MM AM/PM format');

      // Validate date range (only if both dates are valid)
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        errors.push('End Date cannot be before Start Date');
      }

      // If dates are equal, check time ordering. If end time is earlier than start time
      // on the same AD date, treat this row as problematic (don't accept automatically).
      let isProblematic = false;
      if (startDate && endDate && startDate === endDate && parsedStartTime && parsedEndTime) {
        const startMs = new Date(`${startDate}T${parsedStartTime}:00`).getTime();
        const endMs = new Date(`${endDate}T${parsedEndTime}:00`).getTime();
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
          // Mark as problematic (separate list) rather than invalid; admin can review.
          isProblematic = true;
        }
      }

      if (errors.length > 0) {
        results.invalid.push({ row: rowNum, data: row, errors });
      } else if (isProblematic) {
        // Add to problematic list with a helpful message
        results.problematic.push({ row: rowNum, data: row, reason: 'End time is earlier than start time on the same date' });
      } else {
        // Combine pakshya and tithi for storage
        const fullName = `${pakshya} ${tithi}`;
        
        const tithiData = {
          name: fullName,
          startDate,
          startTime: parsedStartTime || startTime,
          endDate,
          endTime: parsedEndTime || endTime,
          addOrReplace
        };
        
        // Only add category if provided
        const categoryValue = row['Category (optional)']?.toString().trim();
        if (categoryValue) {
          tithiData.category = categoryValue;
        }

        // Check if exists (by name and date range - more flexible matching)
        const existing = tithis.find(t => 
          t.name === tithiData.name && 
          t.startDate === tithiData.startDate &&
          t.startTime === tithiData.startTime
        );
        if (existing) {
          tithiData.id = existing.id;
          results.toUpdate.push(tithiData);
        } else {
          results.toAdd.push(tithiData);
        }
        results.valid.push({ row: rowNum, ...tithiData });
      }
    });
  }

  function validateEventsData(jsonData, results) {
    jsonData.forEach((row, index) => {
      const errors = [];
      const rowNum = index + 2;

      const title = row['Title*']?.toString().trim();
      const description = row['Description']?.toString().trim() || '';
      const dateRaw = row['Date* (MM-DD-YYYY Nepali)']?.toString().trim();
      const isPublicStr = row['Is Public* (TRUE/FALSE)']?.toString().trim().toUpperCase();
      const addOrReplace = row['AddOrReplace*']?.toString().trim().toUpperCase();

      if (!title) errors.push('Title is required');
      if (!dateRaw) errors.push('Date is required');
      if (!isPublicStr) errors.push('Is Public is required');
      if (!addOrReplace) errors.push('AddOrReplace is required');

      // Parse Nepali date to AD format
      const dateKey = dateRaw ? parseNepaliDate(dateRaw) : null;

      if (dateRaw && !dateKey) {
        errors.push('Date must be in YYYY-MM-DD format (Nepali)');
      }

      // Validate boolean
      if (isPublicStr && isPublicStr !== 'TRUE' && isPublicStr !== 'FALSE') {
        errors.push('Is Public must be TRUE or FALSE');
      }

      // Validate AddOrReplace value
      if (addOrReplace && addOrReplace !== 'ADD' && addOrReplace !== 'REPLACE') {
        errors.push('AddOrReplace must be either ADD or REPLACE');
      }

      if (errors.length > 0) {
        results.invalid.push({ row: rowNum, data: row, errors });
      } else {
        const eventData = {
          title,
          description,
          dateKey,
          isPublic: isPublicStr === 'TRUE',
          associatedPerson: row['Associated Person (optional)']?.toString().trim() || '',
          addOrReplace
        };

        // Check if exists (by title and date)
        const existing = events.find(e => e.title === eventData.title && e.dateKey === eventData.dateKey);
        if (existing) {
          eventData.id = existing.id;
          results.toUpdate.push(eventData);
        } else {
          results.toAdd.push(eventData);
        }
        results.valid.push({ row: rowNum, ...eventData });
      }
    });
  }

  // Publish changes to Firestore
  async function publishChanges() {
    if (!validationResults || validationResults.valid.length === 0) {
      setUploadStatus('❌ No valid records to publish');
      return;
    }

    if (!window.confirm(`Are you sure you want to publish ${validationResults.valid.length} records?`)) {
      return;
    }

    setLoading(true);
    setUploadStatus('Publishing changes...');

    try {
      const collectionName = activeTab === 'tithis' ? 'tithis' : 'calendarEvents';
      const collectionRef = collection(db, collectionName);

      let addCount = 0;
      let replaceCount = 0;
      let updateCount = 0;

      // Group items by AddOrReplace mode
      const itemsToReplace = validationResults.valid.filter(item => item.addOrReplace === 'REPLACE');

      // Handle REPLACE operations first (delete existing records for those dates)
      if (itemsToReplace.length > 0) {
        for (const item of itemsToReplace) {
          // Get the date field based on type
          const dateField = activeTab === 'tithis' ? 'startDate' : 'dateKey';
          const dateValue = item[dateField];

          if (activeTab === 'tithis') {
            // For tithis, we need to handle date ranges (startDate to endDate)
            // Avoid querying with multiple range filters (which requires a composite index).
            // Instead query by a single range on 'startDate' and filter by 'endDate' client-side.
            const q = query(collectionRef, where('startDate', '<=', item.endDate));
            const snapshot = await getDocs(q);

            // Delete in batches (Firestore batch limit is 500)
            const deleteBatch = writeBatch(db);
            let deleteOps = 0;

            snapshot.docs.forEach((docSnapshot) => {
              const data = docSnapshot.data() || {};
              // Keep only those that actually overlap the requested range
              if (data.endDate && data.endDate >= item.startDate) {
                deleteBatch.delete(docSnapshot.ref);
                deleteOps++;
              }
            });

            if (deleteOps > 0) {
              await deleteBatch.commit();
              replaceCount += deleteOps;
            }
          } else {
            // For events, delete all events on the same date
            const q = query(collectionRef, where('dateKey', '==', dateValue));
            const snapshot = await getDocs(q);
            
            const deleteBatch = writeBatch(db);
            let deleteOps = 0;
            
            snapshot.docs.forEach((docSnapshot) => {
              deleteBatch.delete(docSnapshot.ref);
              deleteOps++;
            });
            
            if (deleteOps > 0) {
              await deleteBatch.commit();
              replaceCount += deleteOps;
            }
          }
        }
      }

      // Now add all records (both REPLACE and ADD)
      const batch = writeBatch(db);
      const keysAdded = new Set();

      for (const item of validationResults.valid) {
        // Build a composite key and existing-doc query behavior depending on active tab
        let key;
        if (activeTab === 'tithis') {
          // Use tithi identity (name + start/end timestamps)
          key = `${item.name || ''}|${item.startDate || ''}|${item.startTime || ''}|${item.endDate || ''}|${item.endTime || ''}`;
        } else {
          // For events, use title + dateKey + isPublic as the uniqueness key
          key = `${item.title || ''}|${item.dateKey || ''}|${item.isPublic ? '1' : '0'}`;
        }

        if (keysAdded.has(key)) {
          // Skip duplicate row within the upload file
          continue;
        }

        // Before creating a new doc, check if an exact document already exists in Firestore
        // Use collection-specific matching fields
        let existingDocId = null;
        try {
          let q;
          if (activeTab === 'tithis') {
            q = query(collectionRef, where('name', '==', item.name || ''), where('startDate', '==', item.startDate || ''), where('startTime', '==', item.startTime || ''));
          } else {
            q = query(collectionRef, where('title', '==', item.title || ''), where('dateKey', '==', item.dateKey || ''));
          }

          const snap = await getDocs(q);
          if (!snap.empty) {
            existingDocId = snap.docs[0].id;
          }
        } catch (qerr) {
          // Ignore query errors here and fall back to creating a new doc
          console.warn('Error querying for existing document during publish:', qerr);
        }

        const newData = { ...item };
        delete newData.row;
        delete newData.id;
        delete newData.addOrReplace; // Don't store this field in Firestore
        newData.updatedAt = new Date().toISOString();
        newData.createdBy = user.uid;
        newData.createdByAdmin = true;

        if (existingDocId) {
          // Update existing document instead of creating a duplicate
          const existingRef = doc(db, collectionName, existingDocId);
          // Use set with merge to update fields safely
          batch.set(existingRef, newData, { merge: true });
          updateCount++;
        } else {
          const newDocRef = doc(collectionRef);
          batch.set(newDocRef, newData);
          addCount++;
        }

        keysAdded.add(key);
      }

      await batch.commit();

      const summary = itemsToReplace.length > 0
        ? `✅ Successfully published: ${addCount} added, ${replaceCount} existing deleted (replaced), ${updateCount} updated`
        : `✅ Successfully published: ${addCount} added, ${updateCount} updated`;
      
      setUploadStatus(summary);
      setValidationResults(null);
      setPreviewData([]);
      setUploadFile(null);
      
      // Reload data
      if (activeTab === 'tithis') {
        await loadTithis();
      } else {
        await loadEvents();
      }
    } catch (error) {
      console.error('Error publishing changes:', error);
      setUploadStatus('❌ Error publishing changes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Delete single record
  async function deleteRecord(id) {
    if (!id) {
      console.error('Delete called with no ID');
      setUploadStatus('❌ Error: No record ID provided');
      return;
    }

    console.log('Deleting record:', id, 'from', activeTab);
    
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      const collectionName = activeTab === 'tithis' ? 'tithis' : 'calendarEvents';
      console.log('Deleting from collection:', collectionName);

      const docRef = doc(db, collectionName, id);
      console.log('Doc ref path (attempt 1):', docRef.path);

      // First check if document exists at this path
      const before = await getDoc(docRef);
      if (before.exists()) {
        await deleteDoc(docRef);
        console.log('deleteDoc resolved for', docRef.path);
        // Verify deletion
        try {
          const after = await getDoc(docRef);
          console.log('Post-delete getDoc.exists():', after.exists());
        } catch (verifyError) {
          console.error('Error verifying deletion with getDoc:', verifyError);
        }
      } else {
        // Document didn't exist at this path; try to find by embedded `id` field
        console.log('No document at path; attempting lookup by embedded id field');
        const collectionRef = collection(db, collectionName);
        const q = query(collectionRef, where('id', '==', id));
        const snap = await getDocs(q);
        if (snap.empty) {
          console.warn('No document found by embedded id lookup for', id);
          setUploadStatus('❌ No matching record found to delete');
          return;
        }

        // Delete all matching documents found
        for (const d of snap.docs) {
          const foundRef = doc(db, collectionName, d.id);
          console.log('Deleting found doc at', foundRef.path);
          await deleteDoc(foundRef);
          const after = await getDoc(foundRef);
          console.log('Post-delete exists for found doc:', after.exists(), 'path:', foundRef.path);
        }
      }

      // Also log remaining count in collection for debugging
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        console.log('Remaining documents in', collectionName, ':', snapshot.size);
      } catch (countError) {
        console.error('Error counting after delete:', countError);
      }

      console.log('Successfully deleted');

      setUploadStatus('✅ Record deleted successfully');

      if (activeTab === 'tithis') {
        await loadTithis();
      } else {
        await loadEvents();
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setUploadStatus('❌ Error deleting record: ' + error.message);
    }
  }

  // Save edited record
  async function saveEdit(id) {
    if (!id || !editingData) {
      setUploadStatus('❌ Error: Invalid edit data');
      return;
    }

    try {
      const collectionName = activeTab === 'tithis' ? 'tithis' : 'calendarEvents';
      const docRef = doc(db, collectionName, id);
      
      const updateData = { ...editingData };
      
      // For Tithis, recombine tithi and pakshya into name
      if (activeTab === 'tithis' && updateData.tithi && updateData.pakshya) {
        updateData.name = `${updateData.pakshya} ${updateData.tithi}`;
        delete updateData.tithi;
        delete updateData.pakshya;
      }
      
      updateData.updatedAt = new Date().toISOString();
      
      await updateDoc(docRef, updateData);
      setUploadStatus('✅ Record updated successfully');
      setEditingId(null);
      setEditingData({});
      
      if (activeTab === 'tithis') {
        await loadTithis();
      } else {
        await loadEvents();
      }
    } catch (error) {
      console.error('Error updating record:', error);
      setUploadStatus('❌ Error updating record: ' + error.message);
    }
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null);
    setEditingData({});
  }

  // Handle adding new record
  async function handleAddRecord() {
    try {
      // Validate required fields
      if (activeTab === 'tithis') {
        if (!newRecordData.tithi || !newRecordData.pakshya || !newRecordData.startDate || 
            !newRecordData.endDate || !newRecordData.startTime || !newRecordData.endTime) {
          setUploadStatus('❌ Please fill all required fields');
          return;
        }
        
        // Create Tithi record
        const tithiData = {
          name: `${newRecordData.pakshya} ${newRecordData.tithi}`,
          startDate: newRecordData.startDate,
          endDate: newRecordData.endDate,
          startTime: newRecordData.startTime,
          endTime: newRecordData.endTime,
          createdAt: new Date().toISOString(),
          createdByAdmin: true
        };
        
        await addDoc(collection(db, 'tithis'), tithiData);
        setUploadStatus('✅ Tithi added successfully');
        await loadTithis();
        
      } else {
        if (!newRecordData.title || !newRecordData.dateKey) {
          setUploadStatus('❌ Please fill all required fields');
          return;
        }
        
        // Create Event record
        const eventData = {
          title: newRecordData.title,
          description: newRecordData.description || '',
          dateKey: newRecordData.dateKey,
          isPublic: newRecordData.isPublic || false,
          associatedPerson: '',
          createdAt: new Date().toISOString(),
          createdByAdmin: true,
          createdBy: user?.uid || ''
        };
        
        await addDoc(collection(db, 'calendarEvents'), eventData);
        setUploadStatus('✅ Event added successfully');
        await loadEvents();
      }
      
      // Reset inline form
      setIsAddingNew(false);
      setNewRecordData({});
      
    } catch (error) {
      console.error('Error adding record:', error);
      setUploadStatus('❌ Error adding record: ' + error.message);
    }
  }

  // Cancel adding new record
  function cancelAddNew() {
    setIsAddingNew(false);
    setNewRecordData({});
  }

  // Update new record field
  function updateNewRecordField(field, value) {
    setNewRecordData(prev => ({ ...prev, [field]: value }));
  }

  // Bulk delete functions
  async function handleBulkDelete(type) {
    const collectionName = type === 'tithis' ? 'tithis' : 'calendarEvents';
    
    // Fetch actual count from Firestore
    setLoading(true);
    setUploadStatus(`🔍 Counting ${type} in database...`);
    
    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      const actualCount = snapshot.size;
      
      if (actualCount === 0) {
        setUploadStatus(`ℹ️ No ${type} found in database`);
        setLoading(false);
        return;
      }
      
      // Show confirmation dialog with actual count
      setDeleteConfirmation({
        show: true,
        type: type,
        count: actualCount,
        confirmText: ''
      });
      
    } catch (error) {
      console.error('Error counting records:', error);
      setUploadStatus(`❌ Error counting ${type}: ` + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeBulkDelete() {
    const { type, confirmText } = deleteConfirmation;
    
    // Verify confirmation text
    const expectedText = `DELETE ALL ${type.toUpperCase()}`;
    if (confirmText !== expectedText) {
      setUploadStatus(`❌ Please type exactly: ${expectedText}`);
      return;
    }

    setLoading(true);
    setUploadStatus(`🔍 Fetching all ${type} from database...`);
    
    try {
      const collectionName = type === 'tithis' ? 'tithis' : 'calendarEvents';
      
      // Fetch ALL records from Firestore (not just from state)
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      // Use explicit firestore doc id (docId) and keep the stored data separate.
      const allRecords = snapshot.docs.map(d => ({
        docId: d.id,
        data: d.data()
      }));
      console.log('Fetched allRecords length:', allRecords.length);
      console.log('Sample docIds:', allRecords.slice(0, 20).map(r => r.docId));
      console.log('Sample data.ids:', allRecords.slice(0, 20).map(r => r.data && r.data.id));
      
      if (allRecords.length === 0) {
        setUploadStatus(`ℹ️ No ${type} found in database`);
        setLoading(false);
        setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' });
        return;
      }
      
      setUploadStatus(`📦 Creating backup of ${allRecords.length} ${type}...`);
      
      // Create backup data for download (with error handling)
      let backupData;
      try {
        backupData = allRecords.map(item => {
          const d = item.data || {};
          if (type === 'tithis') {
            const parts = (d.name || '').split(' ') || [];
            return {
              Tithi: parts.slice(1).join(' ') || '',
              Pakshya: parts[0] || '',
              'Start Date': d.startDate ? formatAdDateToNepaliStringWithNumerals(d.startDate) : 'N/A',
              'Start Time': d.startTime || 'N/A',
              'End Date': d.endDate ? formatAdDateToNepaliStringWithNumerals(d.endDate) : 'N/A',
              'End Time': d.endTime || 'N/A',
              'Created At': d.createdAt || 'N/A',
              'Created By Admin': d.createdByAdmin ? 'Yes' : 'No',
              'Created By': d.createdBy || 'N/A',
              'ID (embedded)': d.id || 'N/A',
              'FirestoreDocId': item.docId
            };
          } else {
            return {
              Title: d.title || 'N/A',
              Description: d.description || '',
              Date: d.dateKey ? formatAdDateToNepaliStringWithNumerals(d.dateKey) : 'N/A',
              'Is Public': d.isPublic ? 'Yes' : 'No',
              'Associated Person': d.associatedPerson || '',
              'Created At': d.createdAt || 'N/A',
              'Created By Admin': d.createdByAdmin ? 'Yes' : 'No',
              'Created By': d.createdBy || 'N/A',
              'ID (embedded)': d.id || 'N/A',
              'FirestoreDocId': item.docId
            };
          }
        });
      } catch (backupError) {
        console.error('Error creating backup data:', backupError);
        setUploadStatus(`⚠️ Warning: Backup creation failed. Proceeding with deletion...`);
        backupData = [{ Error: 'Failed to create backup', Details: backupError.message }];
      }
      
      // Trigger backup download
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(backupData);
      XLSX.utils.book_append_sheet(workbook, worksheet, type === 'tithis' ? 'Tithis Backup' : 'Events Backup');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      XLSX.writeFile(workbook, `${type}_backup_${timestamp}.xlsx`);
      
      setUploadStatus(`🗑️ Deleting ${allRecords.length} ${type}...`);
      
      // Delete all records in batches (Firestore limit: 500 per batch)
      const batchSize = 500;
      let deletedCount = 0;
      const deleteErrors = [];
      
      for (let i = 0; i < allRecords.length; i += batchSize) {
        try {
          const batch = writeBatch(db);
          const batchItems = allRecords.slice(i, i + batchSize);
          
          batchItems.forEach(item => {
            const docRef = doc(db, collectionName, item.docId);
            console.log('Scheduling delete for', docRef.path);
            batch.delete(docRef);
          });
          
          // Before committing, verify first doc exists
          try {
            const firstRef = doc(db, collectionName, batchItems[0].docId);
            const beforeSnap = await getDoc(firstRef);
            console.log('Before commit - first item exists:', beforeSnap.exists(), 'path:', firstRef.path);
          } catch (preVerifyErr) {
            console.error('Error verifying before commit:', preVerifyErr);
          }

          await batch.commit();
          deletedCount += batchItems.length;
          setUploadStatus(`🗑️ Deleted ${deletedCount} of ${allRecords.length} ${type}...`);
          // Quick verification: count remaining docs after this batch and check first item
          try {
            const snapshotAfter = await getDocs(collection(db, collectionName));
            console.log(`After batch commit, remaining in ${collectionName}:`, snapshotAfter.size);
            // Verify the first item in this batch was deleted
            const firstRef = doc(db, collectionName, batchItems[0].docId);
            const afterSnap = await getDoc(firstRef);
            console.log('After commit - first item exists?:', afterSnap.exists(), 'path:', firstRef.path);
          } catch (verifyBatchError) {
            console.error('Error verifying remaining docs after batch commit:', verifyBatchError);
          }
        } catch (batchError) {
          console.error(`Error deleting batch ${i / batchSize + 1}:`, batchError);
          deleteErrors.push(`Batch ${i / batchSize + 1}: ${batchError.message}`);
        }
      }
      
      if (deleteErrors.length > 0) {
        setUploadStatus(`⚠️ Deleted ${deletedCount} of ${allRecords.length}. ${deleteErrors.length} batch(es) failed. Check console.`);
        console.error('Delete errors:', deleteErrors);
      } else {
        setUploadStatus(`✅ Successfully deleted all ${allRecords.length} ${type}. Backup saved to Downloads.`);
      }
      
      // Reload data
      if (type === 'tithis') {
        await loadTithis();
      } else {
        await loadEvents();
      }
      
      // Close confirmation dialog
      setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' });
      
    } catch (error) {
      console.error('Error deleting records:', error);
      setUploadStatus('❌ Error deleting records: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Delete all test data from collections
  // eslint-disable-next-line no-unused-vars
  async function deleteTestData() {
    // This function has been replaced by a two-step flow: requestDeleteTestData
    // triggers confirmation modal; performDeleteTestData executes the deletion.
    console.warn('deleteTestData() should not be called directly. Use requestDeleteTestData() to show confirmation.');
  }

  // Request confirmation for deleting recent test data (created in last 30 days)
  function requestDeleteTestData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const recentTithis = tithis.filter(t => t.createdAt && t.createdAt > cutoffDate);
    const recentEvents = events.filter(e => e.createdAt && e.createdAt > cutoffDate);

    const total = recentTithis.length + recentEvents.length;
    if (total === 0) {
      setUploadStatus('ℹ️ No recent data found (created in last 30 days)');
      return;
    }

    // Store counts in deleteConfirmation.details for use in modal
    setDeleteConfirmation({ show: true, type: 'recent', count: total, confirmText: '', details: { tithis: recentTithis.length, events: recentEvents.length } });
  }

  // Execute deletion of recent test data after user confirms
  async function performDeleteTestData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const recentTithis = tithis.filter(t => t.createdAt && t.createdAt > cutoffDate);
    const recentEvents = events.filter(e => e.createdAt && e.createdAt > cutoffDate);

    setLoading(true);
    setUploadStatus('🗑️ Deleting recent test data...');

    try {
      const batch = writeBatch(db);
      let deletedCount = 0;

      recentTithis.forEach(tithi => {
        const docRef = doc(db, 'tithis', tithi.id);
        batch.delete(docRef);
        deletedCount++;
      });

      recentEvents.forEach(event => {
        const docRef = doc(db, 'calendarEvents', event.id);
        batch.delete(docRef);
        deletedCount++;
      });

      await batch.commit();

      setUploadStatus(`✅ Deleted ${deletedCount} recent records (${recentTithis.length} Tithis, ${recentEvents.length} Events)`);

      // Reload data
      await loadTithis();
      await loadEvents();

      // Close confirmation dialog
      setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '', details: null });
    } catch (error) {
      console.error('Error deleting test data:', error);
      setUploadStatus('❌ Error deleting test data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Start editing
  function startEdit(record) {
    setEditingId(record.id);
    const editData = { ...record };
    
    // Split name into tithi and pakshya for Tithis
    if (activeTab === 'tithis' && record.name) {
      const parts = record.name.split(' ');
      editData.pakshya = parts[0] || 'शुक्लपक्ष';
      editData.tithi = parts.slice(1).join(' ') || '';
    }
    
    setEditingData(editData);
  }

  // Update editing data
  function updateEditField(field, value) {
    setEditingData(prev => ({ ...prev, [field]: value }));
  }

  // Convert AD date string (YYYY-MM-DD) to Nepali format (MM-DD-YYYY with Nepali numerals)
  function formatDateToNepali(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const bs = convertAdToBs(year, month - 1, day); // month is 0-indexed in Date
    return `${toNepaliNumber(bs.year)}-${toNepaliNumber(bs.month).padStart(2, '०')}-${toNepaliNumber(bs.day).padStart(2, '०')}`;
  }

  // Filter data based on search, year, and month
  const filteredTithis = tithis.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.startDate?.includes(searchTerm) ||
      t.endDate?.includes(searchTerm);
    
    if (yearFilter === 'all' && monthFilter === 'all') return matchesSearch;
    
    // Extract year-month-day from startDate and convert to BS
    const [year, month, day] = t.startDate?.split('-').map(Number) || [];
    if (!year || !month || !day) return matchesSearch && yearFilter === 'all' && monthFilter === 'all';
    
    const bs = convertAdToBs(year, month - 1, day); // month is 0-indexed
    
    let matchesYear = yearFilter === 'all' || (bs && bs.year.toString() === yearFilter);
    let matchesMonth = monthFilter === 'all' || (bs && bs.month.toString() === monthFilter);
    
    return matchesSearch && matchesYear && matchesMonth;
  });

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.dateKey?.includes(searchTerm);
    
    if (yearFilter === 'all' && monthFilter === 'all') return matchesSearch;
    
    // Extract year-month-day from dateKey and convert to BS
    const [year, month, day] = e.dateKey?.split('-').map(Number) || [];
    if (!year || !month || !day) return matchesSearch && yearFilter === 'all' && monthFilter === 'all';
    
    const bs = convertAdToBs(year, month - 1, day); // month is 0-indexed
    
    let matchesYear = yearFilter === 'all' || (bs && bs.year.toString() === yearFilter);
    let matchesMonth = monthFilter === 'all' || (bs && bs.month.toString() === monthFilter);
    
    return matchesSearch && matchesYear && matchesMonth;
  });

  // Get unique BS years from data
  const getUniqueYears = () => {
    const years = new Set();
    const dataSource = activeTab === 'tithis' ? tithis : events;
    const dateField = activeTab === 'tithis' ? 'startDate' : 'dateKey';
    
    dataSource.forEach(item => {
      const dateStr = item[dateField];
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const bs = convertAdToBs(year, month - 1, day);
        years.add(bs.year);
      }
    });
    
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  };

  return (
    <div className="admin-management">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-title">
            <h1>📊 Admin Management</h1>
          </div>
          </div>
        </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'tithis' ? 'active' : ''}`}
          onClick={() => setActiveTab('tithis')}
          disabled={!hasPermission(PERMISSIONS.MANAGE_TITHIS)}
          title={!hasPermission(PERMISSIONS.MANAGE_TITHIS) ? 'No permission to manage tithis' : ''}
        >
          📅 Tithis
        </button>
        <button 
          className={`admin-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
          disabled={!hasPermission(PERMISSIONS.MANAGE_EVENTS)}
          title={!hasPermission(PERMISSIONS.MANAGE_EVENTS) ? 'No permission to manage events' : ''}
        >
          🎉 Events
        </button>
        <button 
          className={`admin-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          disabled={!hasPermission(PERMISSIONS.MANAGE_CALENDAR)}
          title={!hasPermission(PERMISSIONS.MANAGE_CALENDAR) ? 'No permission to manage calendar' : ''}
        >
          🗓️ Calendar Manager
        </button>
        <button 
          className={`admin-tab ${activeTab === 'dataManagement' ? 'active' : ''}`}
          onClick={() => setActiveTab('dataManagement')}
          disabled={!hasPermission(PERMISSIONS.MANUAL_DASHBOARD)}
          title={!hasPermission(PERMISSIONS.MANUAL_DASHBOARD) ? 'No permission to access data management' : ''}
        >
          🗂️ Data Management
        </button>
      </div>

      {/* Tab Descriptions */}
      {activeTab === 'tithis' && (
        <div className="tab-description">
          <p>📅 Bulk upload and manage Tithis for the Nepali calendar. Import, edit, and track tithi data.</p>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="tab-description">
          <p>🎉 Bulk upload and manage calendar events. Create, edit, and organize events for the family calendar.</p>
        </div>
      )}

      {/* User Management moved to Settings -> User Management (top-level). */}

      {/* Data Management Tab */}
      {activeTab === 'dataManagement' && (
        <div className="admin-section data-management-section">
          <h2>🗂️ Data Management & Cleanup</h2>
          <p className="section-description">
            Manage and clean up your data before going to production. All bulk delete operations create automatic backups.
          </p>

          <div className="data-stats">
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-label">Total Tithis</div>
                <div className="stat-value">{tithis.length}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🎉</div>
              <div className="stat-content">
                <div className="stat-label">Total Events</div>
                <div className="stat-value">{events.length}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🕒</div>
              <div className="stat-content">
                <div className="stat-label">Recent (30 days)</div>
                <div className="stat-value">
                  {tithis.filter(t => t.createdAt && t.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length +
                   events.filter(e => e.createdAt && e.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length}
                </div>
              </div>
            </div>
          </div>

          <div className="danger-zone">
            <h3>⚠️ Danger Zone</h3>
            <p className="danger-description">
              These actions are irreversible. A backup will be automatically downloaded before deletion.
            </p>

            <div className="danger-actions">
              <div className="danger-action-card">
                <div className="danger-action-info">
                  <h4>🗑️ Delete All Tithis</h4>
                  <p>Remove all {tithis.length} Tithis from the database. A backup file will be downloaded automatically.</p>
                </div>
                <button 
                  onClick={() => handleBulkDelete('tithis')}
                  className="btn-danger"
                  disabled={loading || tithis.length === 0}
                >
                  Delete All Tithis
                </button>
              </div>

              <div className="danger-action-card">
                <div className="danger-action-info">
                  <h4>🗑️ Delete All Events</h4>
                  <p>Remove all {events.length} Events from the database. A backup file will be downloaded automatically.</p>
                </div>
                <button 
                  onClick={() => handleBulkDelete('events')}
                  className="btn-danger"
                  disabled={loading || events.length === 0}
                >
                  Delete All Events
                </button>
              </div>

              <div className="danger-action-card">
                <div className="danger-action-info">
                  <h4>🧹 Delete Test Data</h4>
                  <p>Remove all Tithis and Events created in the last 30 days. Useful for cleaning up test entries.</p>
                </div>
                <button 
                  onClick={requestDeleteTestData}
                  className="btn-warning"
                  disabled={loading || recentCount === 0}
                  title={recentCount === 0 ? 'No recent data found (last 30 days)' : 'Delete recent test data'}
                >
                  Delete Recent Test Data
                </button>
              </div>
            </div>

            <div className="admin-section scan-anomalies-section" style={{ marginTop: '1rem' }}>
              <h3>🔎 Scan Tithi Boundary Anomalies</h3>
              <p>Detect tithis where the recorded end is earlier than the start. Only visible to admins.</p>
              <div style={{ marginBottom: '0.5rem' }}>
                <button
                  onClick={scanTithisForBoundaryErrors}
                  className="btn-secondary"
                  disabled={scanning || loading}
                >
                  {scanning ? 'Scanning…' : 'Scan Tithis for Boundary Anomalies'}
                </button>
              </div>

              {scanning && <div className="status-message info">Scanning all tithis. This may take a moment...</div>}

              {scanResults && scanResults.length > 0 && (
                <div className="scan-results" style={{ marginTop: '1rem' }}>
                  <h4>Found {scanResults.length} anomalies</h4>
                  <div className="preview-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>DocId</th>
                          <th>Name</th>
                          <th>Start (ISO / displayed)</th>
                          <th>End (ISO / displayed)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResults.map(r => (
                          <tr key={r.docId}>
                            <td><code style={{ whiteSpace: 'nowrap' }}>{r.docId}</code></td>
                            <td>{r.name}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.startIso}<br/>{r.startDate} {r.startTime}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.endIso}<br/>{r.endDate} {r.endTime}</td>
                            <td>
                              <button onClick={() => fixTithiSwap(r.docId)} className="btn-primary">Swap Start/End</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scanResults && scanResults.length === 0 && !scanning && (
                <div className="status-message success">No anomalies found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nepali Calendar Manager Tab */}
      {activeTab === 'calendar' && (
        <NepaliCalendarManagement 
          hasPermission={hasPermission} 
          PERMISSIONS={PERMISSIONS}
        />
      )}
      {/* Bulk Upload Section - Only show for tithis/events tabs */}
      {(activeTab === 'tithis' || activeTab === 'events') && (
      <div className="admin-section">
        <h2>📤 Bulk Upload</h2>
        
        <div className="template-actions">
          <button onClick={downloadTemplate} className="btn-primary">
            ⬇️ Download Template
          </button>
          <button onClick={exportData} className="btn-secondary">
            📥 Export Existing Data
          </button>
        </div>

        <div 
          className="file-upload-area"
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="upload-icon">📂</div>
          <p>{uploadFile ? uploadFile.name : 'Click or drag Excel file here'}</p>
          <small>Supported formats: .xlsx, .xls</small>
        </div>

        {uploadFile && (
          <div className="upload-actions">
            <button 
              onClick={validateAndParseFile} 
              disabled={loading}
              className="btn-primary"
            >
              {loading ? '⏳ Validating...' : '✓ Validate File'}
            </button>
            <button 
              onClick={() => {
                setUploadFile(null);
                setValidationResults(null);
                setPreviewData([]);
                setUploadStatus('');
              }}
              className="btn-secondary"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.includes('❌') ? 'error' : 'success'}`}>
            <pre>{uploadStatus}</pre>
          </div>
        )}

        {/* Validation Errors */}
        {validationResults && validationResults.invalid.length > 0 && (
          <div className="validation-errors">
            <h3>❌ Invalid Records ({validationResults.invalid.length})</h3>
            <div className="error-list">
              {validationResults.invalid.map((item, idx) => (
                <div key={idx} className="error-item">
                  <strong>Row {item.row}:</strong>
                  <ul>
                    {item.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Problematic Records (end < start on same date) */}
        {validationResults && validationResults.problematic && validationResults.problematic.length > 0 && (
          <div className="problematic-records">
            <h3>⚠️ Problematic Records ({validationResults.problematic.length})</h3>
            <p>
              These rows have an end time earlier than the start time on the same AD date.
              They are not auto-published — please review and fix or export for audit.
            </p>
            <div className="problematic-list">
              <table className="problematic-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Tithi</th>
                    <th>Pakshya</th>
                    <th>Start Date</th>
                    <th>Start Time</th>
                    <th>End Date</th>
                    <th>End Time</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResults.problematic.slice(0, 50).map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.row}</td>
                      <td>{item.data?.['Tithi*'] || item.data?.['Tithi'] || ''}</td>
                      <td>{item.data?.['Pakshya*'] || item.data?.['Pakshya'] || ''}</td>
                      <td>{item.data?.['Start Date* (MM-DD-YYYY Nepali)'] || item.data?.['Start Date'] || ''}</td>
                      <td>{item.data?.['Start Time* (HH:MM)'] || item.data?.['Start Time'] || ''}</td>
                      <td>{item.data?.['End Date* (MM-DD-YYYY Nepali)'] || item.data?.['End Date'] || ''}</td>
                      <td>{item.data?.['End Time* (HH:MM)'] || item.data?.['End Time'] || ''}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validationResults.problematic.length > 50 && (
                <p className="preview-note">Showing first 50 of {validationResults.problematic.length} problematic rows</p>
              )}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <button onClick={exportProblematicRows} className="btn-secondary">⬇️ Export Problematic Rows</button>
            </div>
          </div>
        )}

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div className="preview-section">
            <h3>📋 Preview ({previewData.length} records)</h3>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {activeTab === 'tithis' ? (
                      <>
                        <th>Name</th>
                        <th>Start Date</th>
                        <th>Start Time</th>
                        <th>End Date</th>
                        <th>End Time</th>
                        <th>Status</th>
                      </>
                    ) : (
                      <>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Public</th>
                        <th>Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((item, idx) => (
                    <tr key={idx}>
                      {activeTab === 'tithis' ? (
                        <>
                          <td>{item.name}</td>
                          <td>{item.startDate}</td>
                          <td>{formatTime12Hour(item.startTime)}</td>
                          <td>{item.endDate}</td>
                          <td>{formatTime12Hour(item.endTime)}</td>
                          <td>{item.addOrReplace === 'REPLACE' ? '🔄 Replace' : '✨ Add'}</td>
                        </>
                      ) : (
                        <>
                          <td>{item.title}</td>
                          <td>{item.description}</td>
                          <td>{item.dateKey}</td>
                          <td>{item.isPublic ? '✅' : '❌'}</td>
                          <td>{item.addOrReplace === 'REPLACE' ? '🔄 Replace' : '✨ Add'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <p className="preview-note">Showing first 10 of {previewData.length} records</p>
              )}
            </div>
            <button 
              onClick={publishChanges}
              disabled={loading}
              className="btn-publish"
            >
              {loading ? '⏳ Publishing...' : '🚀 Publish Changes'}
            </button>
          </div>
        )}
      </div>
      )}

      

      {/* Manual Management Section - Only show for tithis/events tabs */}
      {(activeTab === 'tithis' || activeTab === 'events') && (
      <div className="admin-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📝 Manual Management</h2>
          <button 
            onClick={() => {
              setIsAddingNew(true);
              setNewRecordData(activeTab === 'tithis' 
                ? { pakshya: 'शुक्लपक्ष', tithi: allTithis[0], startDate: '', endDate: '', startTime: '', endTime: '' } 
                : { isPublic: false, title: '', description: '', dateKey: '' });
            }}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '1.2rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`Add new ${activeTab === 'tithis' ? 'Tithi' : 'Event'}`}
            disabled={isAddingNew}
          >
            +
          </button>
        </div>
        
        <div className="filter-bar">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setMonthFilter('all'); // Reset month when year changes
            }}
            className="year-filter"
          >
            <option value="all">सबै वर्ष (All Years)</option>
            {getUniqueYears().map(year => (
              <option key={year} value={year}>
                {toNepaliNumber(year)}
              </option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="month-filter"
            disabled={yearFilter === 'all'}
          >
            <option value="all">सबै महिना (All Months)</option>
            {nepaliMonths.map((month, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                {activeTab === 'tithis' ? (
                  <>
                    <th>Tithi</th>
                    <th>Pakshya</th>
                    <th>Start Date</th>
                    <th>Start Time</th>
                    <th>End Date</th>
                    <th>End Time</th>
                    <th>Actions</th>
                  </>
                ) : (
                  <>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Public</th>
                    <th>Admin</th>
                    <th>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Inline add new record row */}
              {isAddingNew && activeTab === 'tithis' && (
                <tr className="new-record-row">
                  <td>
                    <select
                      value={newRecordData.tithi || allTithis[0]}
                      onChange={(e) => updateNewRecordField('tithi', e.target.value)}
                      className="edit-input"
                    >
                      {allTithis.map(tithi => (
                        <option key={tithi} value={tithi}>{tithi}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRecordData.pakshya || 'शुक्लपक्ष'}
                      onChange={(e) => updateNewRecordField('pakshya', e.target.value)}
                      className="edit-input"
                    >
                      <option value="शुक्लपक्ष">शुक्लपक्ष</option>
                      <option value="कृष्णपक्ष">कृष्णपक्ष</option>
                    </select>
                  </td>
                  <td>
                    {newRecordData.startDate ? (
                      <NepaliDatePicker
                        value={newRecordData.startDate}
                        onChange={(adDate) => updateNewRecordField('startDate', adDate)}
                      />
                    ) : (
                      <div 
                        className="date-placeholder"
                        onClick={() => {
                          const today = new Date();
                          const adDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          updateNewRecordField('startDate', adDate);
                        }}
                      >
                        -- -- ----
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="time"
                      value={newRecordData.startTime || ''}
                      onChange={(e) => updateNewRecordField('startTime', e.target.value)}
                      className="edit-input"
                      placeholder="--:--"
                    />
                  </td>
                  <td>
                    {newRecordData.endDate ? (
                      <NepaliDatePicker
                        value={newRecordData.endDate}
                        onChange={(adDate) => updateNewRecordField('endDate', adDate)}
                      />
                    ) : (
                      <div 
                        className="date-placeholder"
                        onClick={() => {
                          const today = new Date();
                          const adDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          updateNewRecordField('endDate', adDate);
                        }}
                      >
                        -- -- ----
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="time"
                      value={newRecordData.endTime || ''}
                      onChange={(e) => updateNewRecordField('endTime', e.target.value)}
                      className="edit-input"
                      placeholder="--:--"
                    />
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={handleAddRecord} className="btn-save">💾</button>
                      <button onClick={cancelAddNew} className="btn-cancel">✖️</button>
                    </div>
                  </td>
                </tr>
              )}
              
              {activeTab === 'tithis' ? (
                filteredTithis.length > 0 ? (
                  filteredTithis.map(tithi => (
                    <tr key={tithi.id}>
                      {editingId === tithi.id ? (
                        // Edit mode
                        <>
                          <td>
                            <select
                              value={editingData.tithi || allTithis[0]}
                              onChange={(e) => updateEditField('tithi', e.target.value)}
                              className="edit-input"
                            >
                              {allTithis.map(tithi => (
                                <option key={tithi} value={tithi}>{tithi}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={editingData.pakshya || 'शुक्लपक्ष'}
                              onChange={(e) => updateEditField('pakshya', e.target.value)}
                              className="edit-input"
                            >
                              <option value="शुक्लपक्ष">शुक्लपक्ष</option>
                              <option value="कृष्णपक्ष">कृष्णपक्ष</option>
                            </select>
                          </td>
                          <td>
                            <NepaliDatePicker
                              value={editingData.startDate || ''}
                              onChange={(adDate) => updateEditField('startDate', adDate)}
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={editingData.startTime || ''}
                              onChange={(e) => updateEditField('startTime', e.target.value)}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <NepaliDatePicker
                              value={editingData.endDate || ''}
                              onChange={(adDate) => updateEditField('endDate', adDate)}
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={editingData.endTime || ''}
                              onChange={(e) => updateEditField('endTime', e.target.value)}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={() => saveEdit(tithi.id)} className="btn-save">💾</button>
                              <button onClick={cancelEdit} className="btn-cancel">✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // View mode
                        <>
                          <td>{(tithi.name || '').split(' ').slice(1).join(' ') || tithi.name}</td>
                          <td>{(tithi.name || '').split(' ')[0] || ''}</td>
                          <td>{formatDateToNepali(tithi.startDate)}</td>
                          <td>{formatTime12Hour(tithi.startTime)}</td>
                          <td>{formatDateToNepali(tithi.endDate)}</td>
                          <td>{formatTime12Hour(tithi.endTime)}</td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={() => startEdit(tithi)} className="btn-edit">✏️</button>
                              <button onClick={() => deleteRecord(tithi.id)} className="btn-delete">🗑️</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="empty-state">No tithis found</td></tr>
                )
              ) : (
                <>
                  {/* Inline add new event row */}
                  {isAddingNew && (
                    <tr className="new-record-row">
                      <td>
                        <input
                          type="text"
                          value={newRecordData.title || ''}
                          onChange={(e) => updateNewRecordField('title', e.target.value)}
                          className="edit-input"
                          placeholder="Event title"
                        />
                      </td>
                      <td>
                        <textarea
                          value={newRecordData.description || ''}
                          onChange={(e) => updateNewRecordField('description', e.target.value)}
                          className="edit-input"
                          placeholder="Description (optional)"
                          rows="2"
                        />
                      </td>
                      <td>
                        {newRecordData.dateKey ? (
                          <NepaliDatePicker
                            value={newRecordData.dateKey}
                            onChange={(adDate) => updateNewRecordField('dateKey', adDate)}
                          />
                        ) : (
                          <div 
                            className="date-placeholder"
                            onClick={() => {
                              const today = new Date();
                              const adDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                              updateNewRecordField('dateKey', adDate);
                            }}
                          >
                            -- -- ----
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={newRecordData.isPublic || false}
                          onChange={(e) => updateNewRecordField('isPublic', e.target.checked)}
                        />
                      </td>
                      <td>✅</td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={handleAddRecord} className="btn-save">💾</button>
                          <button onClick={cancelAddNew} className="btn-cancel">✖️</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map(event => (
                    <tr key={event.id}>
                      {editingId === event.id ? (
                        // Edit mode
                        <>
                          <td>
                            <input
                              type="text"
                              value={editingData.title || ''}
                              onChange={(e) => updateEditField('title', e.target.value)}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <textarea
                              value={editingData.description || ''}
                              onChange={(e) => updateEditField('description', e.target.value)}
                              className="edit-input"
                              rows="2"
                            />
                          </td>
                          <td>
                            <NepaliDatePicker
                              value={editingData.dateKey || ''}
                              onChange={(adDate) => updateEditField('dateKey', adDate)}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={editingData.isPublic || false}
                              onChange={(e) => updateEditField('isPublic', e.target.checked)}
                            />
                          </td>
                          <td>{event.createdByAdmin ? '✅' : '❌'}</td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={() => saveEdit(event.id)} className="btn-save">💾</button>
                              <button onClick={cancelEdit} className="btn-cancel">✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // View mode
                        <>
                          <td>{event.title}</td>
                          <td>{event.description}</td>
                          <td>{formatDateToNepali(event.dateKey)}</td>
                          <td>{event.isPublic ? '✅' : '❌'}</td>
                          <td>{event.createdByAdmin ? '✅' : '❌'}</td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={() => startEdit(event)} className="btn-edit">✏️</button>
                              <button onClick={() => deleteRecord(event.id)} className="btn-delete">🗑️</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="empty-state">No events found</td></tr>
                )}
              </>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <p>
            Total: {activeTab === 'tithis' ? filteredTithis.length : filteredEvents.length} records
            {(searchTerm || yearFilter !== 'all' || monthFilter !== 'all') && ` (filtered from ${activeTab === 'tithis' ? tithis.length : events.length})`}
          </p>
        </div>
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Confirm Bulk Delete</h3>
              <button onClick={() => setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' })} className="modal-close">✕</button>
            </div>
            
            <div className="modal-body">
              <div className="confirmation-warning">
                <div className="warning-icon">🚨</div>
                {deleteConfirmation.type === 'recent' ? (
                  <>
                    <p className="warning-text">
                      You are about to permanently delete <strong>{deleteConfirmation.count} recent test records</strong> created in the last 30 days.
                    </p>
                    <p className="warning-subtext">
                      This will delete <strong>{deleteConfirmation.details?.tithis || 0} Tithis</strong> and <strong>{deleteConfirmation.details?.events || 0} Events</strong>. A backup file will be automatically downloaded before deletion.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="warning-text">
                      You are about to permanently delete <strong>{deleteConfirmation.count} {deleteConfirmation.type}</strong>.
                    </p>
                    <p className="warning-subtext">
                      A backup file will be automatically downloaded before deletion.
                    </p>
                  </>
                )}
              </div>

              <div className="form-group">
                <label>
                  {deleteConfirmation.type === 'recent' ? (
                    <>Type <code>DELETE RECENT TEST DATA</code> to confirm:</>
                  ) : (
                    <>Type <code>DELETE ALL {deleteConfirmation.type.toUpperCase()}</code> to confirm:</>
                  )}
                </label>
                <input
                  type="text"
                  value={deleteConfirmation.confirmText}
                  onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, confirmText: e.target.value }))}
                  className="form-input"
                  placeholder={deleteConfirmation.type === 'recent' ? 'DELETE RECENT TEST DATA' : `DELETE ALL ${deleteConfirmation.type.toUpperCase()}`}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' })} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (deleteConfirmation.type === 'recent') {
                    performDeleteTestData();
                  } else {
                    executeBulkDelete();
                  }
                }}
                className="btn-danger"
                disabled={deleteConfirmation.confirmText !== (deleteConfirmation.type === 'recent' ? 'DELETE RECENT TEST DATA' : `DELETE ALL ${deleteConfirmation.type.toUpperCase()}`)}
              >
                {deleteConfirmation.type === 'recent' ? `Delete ${deleteConfirmation.count} Recent Test Records` : `Delete All ${deleteConfirmation.count} ${deleteConfirmation.type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tithi Auto Generator Section - Only show for tithis tab */}
      {activeTab === 'tithis' && (
      <div className="admin-section">
        <h2>⚡ Tithi Auto Generator</h2>
        <p>Automatically calculate Tithis for a date range and generate Excel file for bulk upload.</p>
        <p className="text-sm text-gray-600 mt-1">
          <strong>Note:</strong> Calculations use <strong>Kathmandu, Nepal</strong> coordinates (27.7172° N, 85.3240° E) for astronomical accuracy.
        </p>
        
        <div className="auto-management-form">
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Start Date</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="form-input"
                  value={autoStartDate}
                  onChange={e => {
                    setAutoStartDate(e.target.value);
                    if (autoProgress === 100) {
                      setAutoProgress(0);
                      setAutoStatus('');
                    }
                  }}
                />
                {autoStartDate && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    marginTop: '0.25rem'
                  }}>
                    {getNepaliDateDisplay(autoStartDate)}
                  </div>
                )}
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">End Date</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="form-input"
                  value={autoEndDate}
                  onChange={e => {
                    setAutoEndDate(e.target.value);
                    if (autoProgress === 100) {
                      setAutoProgress(0);
                      setAutoStatus('');
                    }
                  }}
                />
                {autoEndDate && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    marginTop: '0.25rem'
                  }}>
                    {getNepaliDateDisplay(autoEndDate)}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              onClick={generateTithiExcel}
              className="btn-primary"
              disabled={loading || !autoStartDate || !autoEndDate || (autoProgress > 0 && autoProgress < 100)}
            >
              {autoProgress === 100 ? '✅ Complete' : autoProgress > 0 ? '🔄 Generating...' : '📊 Generate Tithi Excel'}
            </button>
            {autoProgress > 0 && autoProgress < 100 && (
              <div className="progress-indicator">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${autoProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">{autoProgress}% Complete</span>
              </div>
            )}
            {autoProgress === 100 && (
              <div className="progress-indicator complete">
                <span className="progress-text">🎉 Generation Complete!</span>
              </div>
            )}
          </div>
          
          {autoStatus && (
            <div className={`status-message ${autoStatus.startsWith('❌') ? 'error' : autoStatus.startsWith('✅') ? 'success' : 'info'}`}>
              {autoStatus}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
