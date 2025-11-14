import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './AdminManagement.css';
import NepaliDatePicker from './NepaliDatePicker';

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
  const [monthFilter, setMonthFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const fileInputRef = useRef(null);

  // Load existing data on mount
  useEffect(() => {
    if (!isAdmin) return;
    loadTithis();
    loadEvents();
  }, [isAdmin]);

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

  // Generate Excel template for download
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    
    if (activeTab === 'tithis') {
      // Tithis template
      const wsData = [
        ['Name*', 'Pakshya*', 'Start Date* (YYYY-MM-DD)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD)', 'End Time* (HH:MM)', 'Category (optional)'],
        ['शुक्लपक्ष एकादशी', 'शुक्लपक्ष', '2025-11-15', '06:00', '2025-11-16', '18:00', 'Festival'],
        ['कृष्णपक्ष अष्टमी', 'कृष्णपक्ष', '2025-11-20', '10:00', '2025-11-20', '22:00', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
    } else {
      // Events template
      const wsData = [
        ['Title*', 'Description', 'Date* (YYYY-MM-DD)', 'Is Public* (TRUE/FALSE)', 'Associated Person (optional)'],
        ['Family Gathering', 'Annual family reunion', '2025-12-25', 'TRUE', 'John Doe'],
        ['Birthday Celebration', 'Grandmother\'s birthday', '2025-12-01', 'FALSE', 'Mary Smith'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
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
        ['ID', 'Name', 'Pakshya', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Created At'],
        ...tithis.map(t => [
          t.id,
          t.name || '',
          t.name?.split(' ')[0] || '',
          t.startDate || '',
          t.startTime || '',
          t.endDate || '',
          t.endTime || '',
          t.createdAt || ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
      XLSX.writeFile(wb, 'Tithis_Export.xlsx');
      setUploadStatus(`✅ Exported ${tithis.length} tithis to Tithis_Export.xlsx`);
    } else {
      const wsData = [
        ['ID', 'Title', 'Description', 'Date', 'Is Public', 'Created By Admin', 'Created At'],
        ...events.map(e => [
          e.id,
          e.title || '',
          e.description || '',
          e.dateKey || '',
          e.isPublic ? 'TRUE' : 'FALSE',
          e.createdByAdmin ? 'TRUE' : 'FALSE',
          e.createdAt || ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 25 }];
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
      const name = row['Name*']?.toString().trim();
      const pakshya = row['Pakshya*']?.toString().trim();
      const startDate = row['Start Date* (YYYY-MM-DD)']?.toString().trim();
      const startTime = row['Start Time* (HH:MM)']?.toString().trim();
      const endDate = row['End Date* (YYYY-MM-DD)']?.toString().trim();
      const endTime = row['End Time* (HH:MM)']?.toString().trim();

      if (!name) errors.push('Name is required');
      if (!pakshya) errors.push('Pakshya is required');
      if (!startDate) errors.push('Start Date is required');
      if (!startTime) errors.push('Start Time is required');
      if (!endDate) errors.push('End Date is required');
      if (!endTime) errors.push('End Time is required');

      // Validate pakshya value
      if (pakshya && pakshya !== 'शुक्लपक्ष' && pakshya !== 'कृष्णपक्ष') {
        errors.push('Pakshya must be either शुक्लपक्ष or कृष्णपक्ष');
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (startDate && !dateRegex.test(startDate)) {
        errors.push('Start Date must be in YYYY-MM-DD format');
      }
      if (endDate && !dateRegex.test(endDate)) {
        errors.push('End Date must be in YYYY-MM-DD format');
      }

      // Validate time format
      const timeRegex = /^\d{2}:\d{2}$/;
      if (startTime && !timeRegex.test(startTime)) {
        errors.push('Start Time must be in HH:MM format');
      }
      if (endTime && !timeRegex.test(endTime)) {
        errors.push('End Time must be in HH:MM format');
      }

      // Validate date range
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        errors.push('End Date cannot be before Start Date');
      }

      if (errors.length > 0) {
        results.invalid.push({ row: rowNum, data: row, errors });
      } else {
        const tithiData = {
          name: `${pakshya} ${name.replace(pakshya, '').trim()}`,
          startDate,
          startTime,
          endDate,
          endTime
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
      const dateKey = row['Date* (YYYY-MM-DD)']?.toString().trim();
      const isPublicStr = row['Is Public* (TRUE/FALSE)']?.toString().trim().toUpperCase();

      if (!title) errors.push('Title is required');
      if (!dateKey) errors.push('Date is required');
      if (!isPublicStr) errors.push('Is Public is required');

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateKey && !dateRegex.test(dateKey)) {
        errors.push('Date must be in YYYY-MM-DD format');
      }

      // Validate boolean
      if (isPublicStr && isPublicStr !== 'TRUE' && isPublicStr !== 'FALSE') {
        errors.push('Is Public must be TRUE or FALSE');
      }

      if (errors.length > 0) {
        results.invalid.push({ row: rowNum, data: row, errors });
      } else {
        const eventData = {
          title,
          description,
          dateKey,
          isPublic: isPublicStr === 'TRUE',
          associatedPerson: row['Associated Person (optional)']?.toString().trim() || ''
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
      const batch = writeBatch(db);
      const collectionName = activeTab === 'tithis' ? 'tithis' : 'calendarEvents';
      const collectionRef = collection(db, collectionName);

      let addCount = 0;
      let updateCount = 0;

      for (const item of validationResults.valid) {
        if (item.id) {
          // Update existing
          const docRef = doc(db, collectionName, item.id);
          const updateData = { ...item };
          delete updateData.id;
          delete updateData.row;
          updateData.updatedAt = new Date().toISOString();
          batch.update(docRef, updateData);
          updateCount++;
        } else {
          // Add new
          const newDocRef = doc(collectionRef);
          const newData = { ...item };
          delete newData.row;
          newData.createdAt = new Date().toISOString();
          newData.createdBy = user.uid;
          newData.createdByAdmin = true;
          batch.set(newDocRef, newData);
          addCount++;
        }
      }

      await batch.commit();

      setUploadStatus(`✅ Successfully published: ${addCount} new, ${updateCount} updated`);
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

  // Start editing
  function startEdit(record) {
    setEditingId(record.id);
    setEditingData({ ...record });
  }

  // Update editing data
  function updateEditField(field, value) {
    setEditingData(prev => ({ ...prev, [field]: value }));
  }

  // Filter data based on search and month
  const filteredTithis = tithis.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.startDate?.includes(searchTerm) ||
      t.endDate?.includes(searchTerm);
    
    if (monthFilter === 'all') return matchesSearch;
    
    // Extract year-month from startDate (YYYY-MM)
    const tithiMonth = t.startDate?.substring(0, 7);
    return matchesSearch && tithiMonth === monthFilter;
  });

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.dateKey?.includes(searchTerm);
    
    if (monthFilter === 'all') return matchesSearch;
    
    // Extract year-month from dateKey (YYYY-MM)
    const eventMonth = e.dateKey?.substring(0, 7);
    return matchesSearch && eventMonth === monthFilter;
  });

  // Get unique months from data for filter dropdown
  const getUniqueMonths = () => {
    const months = new Set();
    if (activeTab === 'tithis') {
      tithis.forEach(t => {
        if (t.startDate) months.add(t.startDate.substring(0, 7));
      });
    } else {
      events.forEach(e => {
        if (e.dateKey) months.add(e.dateKey.substring(0, 7));
      });
    }
    return Array.from(months).sort().reverse(); // Most recent first
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
                          <td>{item.startTime}</td>
                          <td>{item.endDate}</td>
                          <td>{item.endTime}</td>
                          <td>{item.id ? '🔄 Update' : '✨ New'}</td>
                        </>
                      ) : (
                        <>
                          <td>{item.title}</td>
                          <td>{item.description}</td>
                          <td>{item.dateKey}</td>
                          <td>{item.isPublic ? '✅' : '❌'}</td>
                          <td>{item.id ? '🔄 Update' : '✨ New'}</td>
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
        <h2>📝 Manual Management</h2>
        
        <div className="filter-bar">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="month-filter"
          >
            <option value="all">All Months</option>
            {getUniqueMonths().map(month => (
              <option key={month} value={month}>
                {new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
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
                    <th>Name</th>
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
              {activeTab === 'tithis' ? (
                filteredTithis.length > 0 ? (
                  filteredTithis.map(tithi => (
                    <tr key={tithi.id}>
                      {editingId === tithi.id ? (
                        // Edit mode
                        <>
                          <td>{tithi.name}</td>
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
                          <td>{tithi.name}</td>
                          <td>{tithi.startDate}</td>
                          <td>{tithi.startTime}</td>
                          <td>{tithi.endDate}</td>
                          <td>{tithi.endTime}</td>
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
                filteredEvents.length > 0 ? (
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
                          <td>{event.dateKey}</td>
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
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <p>
            Total: {activeTab === 'tithis' ? filteredTithis.length : filteredEvents.length} records
            {(searchTerm || monthFilter !== 'all') && ` (filtered from ${activeTab === 'tithis' ? tithis.length : events.length})`}
          </p>
        </div>
      </div>
    </div>
  );
}
