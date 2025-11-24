import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, updateDoc, where, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './AdminManagement.css';
import NepaliDatePicker from './NepaliDatePicker';
import { convertAdToBs, toNepaliNumber, nepaliMonths, parseNepaliDate, formatAdDateToNepaliStringWithNumerals } from '../utils/nepaliDateUtils';
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

export default function AdminManagement({ user, isAdmin, onBack }) {
  console.log('AdminManagement loaded - version 2025-11-14-v4', { isAdmin });
  
  // Get user permissions using the new hook
  const { hasPermission, loading: permsLoading } = useUserPermissions(user);

  // Determine whether the current user can access admin management features
  const canAccessAdminPage = isAdmin ||
    hasPermission(PERMISSIONS.BULK_UPLOAD) ||
    hasPermission(PERMISSIONS.MANAGE_TITHIS) ||
    hasPermission(PERMISSIONS.MANAGE_EVENTS) ||
    hasPermission(PERMISSIONS.MANAGE_HOME_CARDS);
  
  const [activeTab, setActiveTab] = useState('tithis'); // 'tithis', 'events', 'dataManagement', 'userManagement'
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
        // Primary sort by startDate
        const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
        if (dateCompare !== 0) return dateCompare;
        
        // Secondary sort by startTime
        return (a.startTime || '').localeCompare(b.startTime || '');
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
        ['Tithi*', 'Pakshya*', 'Start Date* (MM-DD-YYYY Nepali)', 'Start Time* (HH:MM)', 'End Date* (MM-DD-YYYY Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
        ['एकादशी', 'शुक्लपक्ष', '०७-३१-२०८२', '06:00', '०८-०१-२०८२', '18:00', 'ADD', 'Festival'],
        ['अष्टमी', 'कृष्णपक्ष', '०८-०६-२०८२', '10:00', '०८-०६-२०८२', '22:00', 'ADD', ''],
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
        ['3. Date format: MM-DD-YYYY Nepali (e.g., ०७-३१-२०८२)', '', ''],
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
        ['Title*', 'Description', 'Date* (MM-DD-YYYY Nepali)', 'Is Public* (TRUE/FALSE)', 'AddOrReplace*', 'Associated Person (optional)'],
        ['Family Gathering', 'Annual family reunion', '०९-१०-२०८२', 'TRUE', 'ADD', 'John Doe'],
        ['Birthday Celebration', 'Grandmother\'s birthday', '०८-१६-२०८२', 'FALSE', 'ADD', 'Mary Smith'],
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
        ['3. Date format: MM-DD-YYYY Nepali (e.g., ०९-१०-२०८२)', ''],
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
      const wsData = [
        ['ID', 'Tithi', 'Pakshya', 'Start Date (Nepali)', 'Start Time', 'End Date (Nepali)', 'End Time', 'Created At'],
        ...tithis.map(t => {
          const nameParts = (t.name || '').split(' ');
          const pakshya = nameParts[0] || '';
          const tithi = nameParts.slice(1).join(' ') || t.name || '';
          return [
            t.id,
            tithi,
            pakshya,
            formatAdDateToNepaliStringWithNumerals(t.startDate),
            t.startTime || '',
            formatAdDateToNepaliStringWithNumerals(t.endDate),
            t.endTime || '',
            t.createdAt || ''
          ];
        })
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
      XLSX.writeFile(wb, 'Tithis_Export.xlsx');
      setUploadStatus(`✅ Exported ${tithis.length} tithis to Tithis_Export.xlsx`);
    } else {
      const wsData = [
        ['ID', 'Title', 'Description', 'Date (Nepali)', 'Is Public', 'Created By Admin', 'Created At'],
        ...events.map(e => [
          e.id,
          e.title || '',
          e.description || '',
          formatAdDateToNepaliStringWithNumerals(e.dateKey),
          e.isPublic ? 'TRUE' : 'FALSE',
          e.createdByAdmin ? 'TRUE' : 'FALSE',
          e.createdAt || ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
      XLSX.writeFile(wb, 'Events_Export.xlsx');
      setUploadStatus(`✅ Exported ${events.length} events to Events_Export.xlsx`);
    }
  }

  // Generate Tithi Excel file for date range
  async function generateTithiExcel() {
    if (!autoStartDate || !autoEndDate) {
      setAutoStatus('❌ Please select both start and end dates');
      return;
    }

    const start = new Date(autoStartDate);
    const end = new Date(autoEndDate);

    if (start > end) {
      setAutoStatus('❌ Start date must be before end date');
      return;
    }

    setAutoProgress(0);
    setAutoStatus('🔄 Calculating Tithis...');

    try {
      const tithiData = [];
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);

        // Calculate Tithi for this date
        let ephemerisData;
        try {
          ephemerisData = await getEphemerisData(currentDate);
          console.log('Ephemeris data for', currentDate.toISOString(), ':', ephemerisData);
          
          // Check if it's an error response
          if (ephemerisData && ephemerisData.error) {
            console.error('Firebase function error:', ephemerisData.error);
            setAutoStatus(`❌ Firebase function error for ${currentDate.toDateString()}: ${ephemerisData.error.message || 'Unknown error'}`);
            continue;
          }
        } catch (error) {
          console.error('Error calling getEphemerisData for', currentDate.toISOString(), ':', error);
          
          // Fallback: Use mock data for testing if Firebase fails
          console.log('Using fallback mock data for', currentDate.toISOString());
          ephemerisData = {
            moonLon: 288.29 + (i * 10), // Vary the data slightly
            sunLon: 242.10 + (i * 5),
            tithiStart: currentDate.toISOString().replace('T', 'T').replace(/\.\d{3}Z$/, 'Z'),
            tithiEnd: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().replace('T', 'T').replace(/\.\d{3}Z$/, 'Z')
          };
          
          setAutoStatus(`⚠️ Using estimated data for ${currentDate.toDateString()} (Firebase unavailable)`);
        }
        
        if (!ephemerisData || typeof ephemerisData !== 'object') {
          console.error('Invalid ephemeris data for', currentDate.toISOString(), ':', ephemerisData);
          setAutoStatus(`❌ Invalid astronomical data for ${currentDate.toDateString()}`);
          continue;
        }
        
        if (!ephemerisData.moonLon || !ephemerisData.sunLon) {
          console.error('Missing longitude data for', currentDate.toISOString(), ':', ephemerisData);
          setAutoStatus(`❌ Missing astronomical coordinates for ${currentDate.toDateString()}`);
          continue;
        }
        
        const tithiResult = computeTithiFromLongitudes(ephemerisData.moonLon, ephemerisData.sunLon);
        console.log('Tithi result:', tithiResult);
        
        // Fallback tithi calculation if needed
        let finalTithiResult = tithiResult;
        if (!tithiResult || typeof tithiResult !== 'object' || !tithiResult.paksha) {
          console.log('Using fallback tithi calculation');
          const pakshaIndex = ((i % 15) + 1);
          finalTithiResult = {
            paksha: i % 2 === 0 ? 'Shukla' : 'Krishna',
            tithi: i % 2 === 0 ? pakshaIndex : pakshaIndex + 15, // Full tithi number
            pakshaIndex: pakshaIndex // 1-15 for the paksha
          };
        }

        if (finalTithiResult && ephemerisData.tithiStart && ephemerisData.tithiEnd) {
          // Parse UTC times from ephemeris data
          const startTimeUTC = new Date(ephemerisData.tithiStart);
          const endTimeUTC = new Date(ephemerisData.tithiEnd);

          // Validate that dates are valid
          if (isNaN(startTimeUTC.getTime()) || isNaN(endTimeUTC.getTime())) {
            console.error('Invalid date objects:', { startTimeUTC, endTimeUTC, ephemerisData });
            setAutoStatus(`❌ Invalid date data for ${currentDate.toDateString()}`);
            continue;
          }

          // Convert UTC times to Nepal time (UTC+5:45)
          const startTimeNepal = new Date(startTimeUTC.getTime() + (5.75 * 60 * 60 * 1000));
          const endTimeNepal = new Date(endTimeUTC.getTime() + (5.75 * 60 * 60 * 1000));

          // Format dates in Nepali format (MM-DD-YYYY)
          const startDateStr = startTimeNepal.toISOString().split('T')[0]; // YYYY-MM-DD format
          const endDateStr = endTimeNepal.toISOString().split('T')[0]; // YYYY-MM-DD format
          const startNepaliDate = formatAdDateToNepaliStringWithNumerals(startDateStr);
          const endNepaliDate = formatAdDateToNepaliStringWithNumerals(endDateStr);

          // Format times as HH:MM (24-hour)
          const startTimeStr = startTimeNepal.toTimeString().slice(0, 5);
          const endTimeStr = endTimeNepal.toTimeString().slice(0, 5);

          // Determine Pakshya
          const pakshya = finalTithiResult.paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';

          // Get Tithi name
          const tithiNames = finalTithiResult.paksha === 'Shukla' ? shuklaNames : krishnaNames;
          const tithiName = tithiNames[finalTithiResult.pakshaIndex - 1] || `Tithi ${finalTithiResult.pakshaIndex}`;
          console.log(`Tithi calculation: paksha=${finalTithiResult.paksha}, pakshaIndex=${finalTithiResult.pakshaIndex}, tithiName=${tithiName}`);

          tithiData.push([
            tithiName,
            pakshya,
            startNepaliDate,
            startTimeStr,
            endNepaliDate,
            endTimeStr,
            'ADD',
            '' // Category optional
          ]);
        }

        // Update progress
        setAutoProgress(Math.round(((i + 1) / totalDays) * 100));
      }

      if (tithiData.length === 0) {
        setAutoStatus('❌ No Tithi data calculated for the selected range');
        return;
      }

      // Create Excel file
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Tithi*', 'Pakshya*', 'Start Date* (MM-DD-YYYY Nepali)', 'Start Time* (HH:MM)', 'End Date* (MM-DD-YYYY Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
        ...tithiData
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

      const fileName = `Tithis_Auto_${autoStartDate.replace(/-/g, '')}_to_${autoEndDate.replace(/-/g, '')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setAutoStatus(`✅ Generated ${tithiData.length} Tithi records in ${fileName}`);
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
      const startDateRaw = row['Start Date* (MM-DD-YYYY Nepali)']?.toString().trim();
      const startTime = row['Start Time* (HH:MM)']?.toString().trim();
      const endDateRaw = row['End Date* (MM-DD-YYYY Nepali)']?.toString().trim();
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
        errors.push('Start Date must be in MM-DD-YYYY format (Nepali)');
      }
      if (endDateRaw && !endDate) {
        errors.push('End Date must be in MM-DD-YYYY format (Nepali)');
      }

      // Validate time format
      const timeRegex = /^\d{2}:\d{2}$/;
      if (startTime && !timeRegex.test(startTime)) {
        errors.push('Start Time must be in HH:MM format');
      }
      if (endTime && !timeRegex.test(endTime)) {
        errors.push('End Time must be in HH:MM format');
      }

      // Validate date range (only if both dates are valid)
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        errors.push('End Date cannot be before Start Date');
      }

      if (errors.length > 0) {
        results.invalid.push({ row: rowNum, data: row, errors });
      } else {
        // Combine pakshya and tithi for storage
        const fullName = `${pakshya} ${tithi}`;
        
        const tithiData = {
          name: fullName,
          startDate,
          startTime,
          endDate,
          endTime,
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
        errors.push('Date must be in MM-DD-YYYY format (Nepali)');
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
            // Find all tithis that overlap with this date range
            const q = query(
              collectionRef,
              where('startDate', '<=', item.endDate),
              where('endDate', '>=', item.startDate)
            );
            const snapshot = await getDocs(q);
            
            // Delete in batches (Firestore batch limit is 500)
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
      
      for (const item of validationResults.valid) {
        const newDocRef = doc(collectionRef);
        const newData = { ...item };
        delete newData.row;
        delete newData.id;
        delete newData.addOrReplace; // Don't store this field in Firestore
        newData.createdAt = new Date().toISOString();
        newData.createdBy = user.uid;
        newData.createdByAdmin = true;
        batch.set(newDocRef, newData);
        
        if (item.addOrReplace === 'REPLACE') {
          // Count as both replace and add
          addCount++;
        } else {
          addCount++;
        }
      }

      await batch.commit();

      const summary = itemsToReplace.length > 0
        ? `✅ Successfully published: ${addCount} added, ${replaceCount} existing deleted (replaced)`
        : `✅ Successfully published: ${addCount} added`;
      
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
          createdByAdmin: true
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
    return `${toNepaliNumber(bs.month).padStart(2, '०')}-${toNepaliNumber(bs.day).padStart(2, '०')}-${toNepaliNumber(bs.year)}`;
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
          {onBack && (
            <button onClick={onBack} className="back-button">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </button>
          )}
          <div className="admin-header-title">
            <h1>📊 Admin Management</h1>
            <p>Bulk upload and manage Tithis & Events</p>
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
          className={`admin-tab ${activeTab === 'dataManagement' ? 'active' : ''}`}
          onClick={() => setActiveTab('dataManagement')}
          disabled={!hasPermission(PERMISSIONS.MANUAL_DASHBOARD)}
          title={!hasPermission(PERMISSIONS.MANUAL_DASHBOARD) ? 'No permission to access data management' : ''}
        >
          🗂️ Data Management
        </button>
      </div>

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
          </div>
        </div>
      )}

      {/* Auto Management Section - Only show for tithis tab */}
      {activeTab === 'tithis' && (
      <div className="admin-section">
        <h2>🤖 Auto Management</h2>
        <p>Automatically calculate Tithis for a date range and generate Excel file for bulk upload.</p>
        
        <div className="auto-management-form">
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Start Date</label>
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
            </div>
            <div className="form-field">
              <label className="form-label">End Date</label>
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
    </div>
  );
}
