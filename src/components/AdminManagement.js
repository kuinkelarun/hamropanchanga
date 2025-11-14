import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy, updateDoc, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './AdminManagement.css';
import NepaliDatePicker from './NepaliDatePicker';
import { convertAdToBs, toNepaliNumber, nepaliMonths, parseNepaliDate, formatAdDateToNepaliStringWithNumerals } from '../utils/nepaliDateUtils';

// Tithi options for dropdown
const allTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा", "औंसी"
];

// Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Convert 12-hour time with AM/PM to 24-hour format (HH:MM)
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

export default function AdminManagement({ user, isAdmin, onBack }) {
  const [activeTab, setActiveTab] = useState('tithis'); // 'tithis' or 'events'
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
  const fileInputRef = useRef(null);

  // Load existing data on mount
  useEffect(() => {
    if (!isAdmin) return;
    loadTithis();
    loadEvents();
  }, [isAdmin]);

  // Reset filters when switching tabs
  useEffect(() => {
    setSearchTerm('');
    setYearFilter('all');
    setMonthFilter('all');
  }, [activeTab]);

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="admin-management">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  async function loadTithis() {
    try {
      setLoading(true);
      const tithisCollection = collection(db, 'tithis');
      const q = query(tithisCollection, orderBy('startDate'), orderBy('startTime'));
      const snapshot = await getDocs(q);
      const tithisData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTithis(tithisData);
    } catch (error) {
      console.error('Error loading tithis:', error);
      setUploadStatus('Error loading tithis: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      setLoading(true);
      const eventsCollection = collection(db, 'calendarEvents');
      const q = query(eventsCollection, orderBy('dateKey'));
      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
      setUploadStatus('Error loading events: ' + error.message);
    } finally {
      setLoading(false);
    }
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
      
      await deleteDoc(doc(db, collectionName, id));
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
        >
          📅 Tithis
        </button>
        <button 
          className={`admin-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          🎉 Events
        </button>
      </div>

      {/* Bulk Upload Section */}
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

      {/* Manual Management Section */}
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
    </div>
  );
}
