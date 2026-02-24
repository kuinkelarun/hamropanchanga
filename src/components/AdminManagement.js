import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, updateDoc, where, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { Trees, deleteTreeAndAssociations } from './TreeBuilder/utils/firestoreTreeApi';
import * as XLSX from 'xlsx';
import './AdminManagement.css';
import NepaliDatePicker from './NepaliDatePicker';
import NepaliCalendarManagement from './NepaliCalendarManagement';
import { convertAdToBs, toNepaliNumber, nepaliMonths, formatAdDateToNepaliStringWithNumerals, getTithiYearFromAdDate, getTithiLunarMonthName, getTithiIndexByName, getTithisForMonth } from '../utils/nepaliDateUtils';
import { normalizeForCompare } from '../utils/textNormalize';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';
import { ALL_TITHI_NAMES, normalizePakshaToNepali, normalizePakshaToEnglish } from '../constants/calendarConstants';
import { formatTime12Hour, getTithiStartMillis, getTithiEndMillis } from '../utils/adminUtils';
import { parseTithiName } from '../utils/calendarHelpers';
import { validateTithisData as validateTithisDataExternal, validateEventsData as validateEventsDataExternal } from '../utils/adminValidation';
import { downloadTemplate as downloadTemplateExcel, exportData as exportDataExcel, exportProblematicRows as exportProblematicRowsExcel, downloadTreesExcel as downloadTreesExcelService, generateTithiExcel as generateTithiExcelService } from '../services/adminExcelService';
import AdminTreesTab from './Admin/AdminTreesTab';
import AdminDataManagementTab from './Admin/AdminDataManagementTab';
import AdminApiKeyRequestsTab from './Admin/AdminApiKeyRequestsTab';
import DeleteConfirmationModal from './Admin/DeleteConfirmationModal';

// Tithi lists from single source of truth
const allTithis = ALL_TITHI_NAMES;

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
  const [trees, setTrees] = useState([]);
  const [softDeletedTreesCount, setSoftDeletedTreesCount] = useState(0);
  const [deletionProgress, setDeletionProgress] = useState({ active: false, deleted: 0, total: 0, currentTree: '' });
    // Load trees for admin (all trees, or by owner)
    const loadTrees = useCallback(async () => {
      try {
        // Admin: fetch all trees including soft-deleted so we can show purge button
        const treesList = await Trees.list(null, { includeDeleted: true });
        const active = treesList.filter(t => !t.deleted);
        const softDeleted = treesList.filter(t => t.deleted);
        setTrees(active);
        setSoftDeletedTreesCount(softDeleted.length);
      } catch (error) {
        console.error('Error loading trees:', error);
        setUploadStatus('Error loading trees: ' + error.message);
      }
    }, []);
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
  
  // Event Entry Mode state (for events tab)
  const [eventEntryMode, setEventEntryMode] = useState('date'); // 'date' or 'tithi'
  const [newRecordTithiMonth, setNewRecordTithiMonth] = useState('');
  const [newRecordTithiName, setNewRecordTithiName] = useState('');
  const [adminCalendarData, setAdminCalendarData] = useState(null);
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
      const collectionRef = collection(db, COLLECTIONS.TITHIS);
      const snapshot = await getDocs(collectionRef);
      const anomalies = [];
      snapshot.docs.forEach(d => {
        const data = d.data() || {};
        const startMs = getTithiStartMillis(data);
        const endMs = getTithiEndMillis(data);
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
      const docRef = doc(db, COLLECTIONS.TITHIS, docId);
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
      const tithisCollection = collection(db, COLLECTIONS.TITHIS);
      // Don't use orderBy in query - it excludes documents without those fields
      // Instead, fetch all and sort in JavaScript
      const snapshot = await getDocs(tithisCollection);
      const tithisData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in JavaScript (handles missing fields gracefully)
      tithisData.sort((a, b) => {
        const sa = getTithiStartMillis(a);
        const sb = getTithiStartMillis(b);
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
      const eventsCollection = collection(db, COLLECTIONS.CALENDAR_EVENTS);
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
    Promise.all([loadTithis(), loadEvents(), loadTrees()]).finally(() => {
      setLoading(false);
    });
  }, [canAccessAdminPage, loadTithis, loadEvents, loadTrees]);

  // Load admin calendar data for validation
  useEffect(() => {
    async function loadAdminCalendar() {
      try {
        const calendarSnap = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
        if (calendarSnap.size > 0) {
          const calendarData = {};
          calendarSnap.docs.forEach(doc => {
            const year = parseInt(doc.id);
            const yearData = doc.data() || {};
            calendarData[year] = {
              startAdDate: yearData.startAdDate,
              daysInMonths: yearData.daysInMonths
            };
          });
          setAdminCalendarData(calendarData);
          console.log('Loaded admin calendar data for years:', Object.keys(calendarData).sort((a, b) => a - b).join(', '));
        }
      } catch (error) {
        console.error('Error loading admin calendar data:', error);
      }
    }
    loadAdminCalendar();
  }, []);

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
  const recentTreesCount = trees.filter(t => t.createdAt && t.createdAt > recentIso).length;
  const recentCount = recentTithisCount + recentEventsCount + recentTreesCount;
  // Helper: normalize createdAt to ISO string for comparison
  const getCreatedAtIso = (t) => {
    if (!t || !t.createdAt) return '';
    if (typeof t.createdAt === 'string') return t.createdAt;
    if (t.createdAt instanceof Date) return t.createdAt.toISOString();
    if (t.createdAt && typeof t.createdAt.toDate === 'function') return t.createdAt.toDate().toISOString();
    return '';
  };

  // Compute filtered trees for the modal preview/labels based on current deleteConfirmation filters
  const computeFilteredTreesForModal = () => {
    if (!deleteConfirmation || deleteConfirmation.type !== 'trees') return [];
    const { range = '30', userType = 'all', userFilter = '' } = deleteConfirmation;
    const days = parseInt(range, 10) || 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();
    return (trees || []).filter(t => {
      const iso = getCreatedAtIso(t);
      if (!iso) return false;
      if (iso <= cutoffIso) return false;
      if (userType === 'email' && userFilter) return (t.ownerEmail || '').toLowerCase() === userFilter.toLowerCase();
      if (userType === 'id' && userFilter) return (t.ownerUid || '') === userFilter;
      return true;
    });
  };
  const filteredTreesForModal = computeFilteredTreesForModal();
  // Bulk delete trees with range/user filter
  async function handleBulkDeleteTrees() {
    setLoading(true);
    setUploadStatus('🔍 Counting trees in database...');
    try {
      // Include soft-deleted trees so the confirmation modal opens even when
      // all trees have been archived but not yet hard-deleted.
      const allTrees = await Trees.list(null, { includeDeleted: true });
      const actualCount = allTrees.length;
      if (actualCount === 0) {
        setUploadStatus('ℹ️ No trees found in database');
        setLoading(false);
        return;
      }
      setDeleteConfirmation({
        show: true,
        type: 'trees',
        count: actualCount,
        confirmText: '',
        range: '30',
        userFilter: '',
        userType: 'all',
      });
    } catch (error) {
      console.error('Error counting trees:', error);
      setUploadStatus('❌ Error counting trees: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeBulkDeleteTrees() {
    const { confirmText, range = '30', userFilter = '', userType = 'all' } = deleteConfirmation;
    const expectedText = 'DELETE ALL TREES';
    if (confirmText !== expectedText) {
      setUploadStatus(`❌ Please type exactly: ${expectedText}`);
      return;
    }
    setLoading(true);
    setUploadStatus('🔍 Fetching trees for deletion...');
    try {
      // Fetch ALL trees (including soft-deleted) so we can fully purge them
      let allTrees = await Trees.list(null, { includeDeleted: true });
      // Separate active and soft-deleted trees
      const activeTrees = allTrees.filter(t => !t.deleted);
      const softDeletedTrees = allTrees.filter(t => t.deleted);
      // Filter active trees by range
      const days = parseInt(range, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDate = cutoff.toISOString();
      let filteredActive = activeTrees.filter(t => {
        if (!t.createdAt) return false;
        let createdAtIso = '';
        if (typeof t.createdAt === 'string') {
          createdAtIso = t.createdAt;
        } else if (t.createdAt && typeof t.createdAt.toDate === 'function') {
          // Firestore Timestamp object
          createdAtIso = t.createdAt.toDate().toISOString();
        } else if (t.createdAt instanceof Date) {
          createdAtIso = t.createdAt.toISOString();
        }
        return createdAtIso > cutoffDate;
      });
      // Filter by user
      if (userType === 'email' && userFilter) {
        filteredActive = filteredActive.filter(t => t.ownerEmail === userFilter);
      } else if (userType === 'id' && userFilter) {
        filteredActive = filteredActive.filter(t => t.ownerUid === userFilter);
      }
      // Combine: active trees matching filters + ALL soft-deleted trees (always purge)
      const filteredTrees = [...filteredActive, ...softDeletedTrees];
      if (filteredTrees.length === 0) {
        setUploadStatus('ℹ️ No trees found for the selected filter');
        setLoading(false);
        setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' });
        return;
      }
      // Backup
      setUploadStatus(`📦 Creating backup of ${filteredTrees.length} trees...`);
      const backupData = filteredTrees.map(t => ({
        Title: t.title || '',
        Owner: t.ownerEmail || t.ownerUid || '',
        CreatedAt: t.createdAt || '',
        TreeId: t.id
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(backupData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Trees Backup');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      XLSX.writeFile(workbook, `trees_backup_${timestamp}.xlsx`);
      // Close confirmation modal and show full-screen progress overlay
      setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' });
      setDeletionProgress({ active: true, deleted: 0, total: filteredTrees.length, currentTree: '' });
      // Delete recursively
      let deletedCount = 0;
      for (const tree of filteredTrees) {
        try {
          setDeletionProgress(prev => ({ ...prev, currentTree: tree.title || tree.name || tree.id }));
          await deleteTreeAndAssociations(tree.id);
          deletedCount++;
          setDeletionProgress(prev => ({ ...prev, deleted: deletedCount }));
          setUploadStatus(`🗑️ Deleted ${deletedCount} of ${filteredTrees.length} trees...`);
        } catch (err) {
          console.error('Error deleting tree', tree.id, err);
        }
      }
      setDeletionProgress({ active: false, deleted: 0, total: 0, currentTree: '' });
      setUploadStatus(`✅ Successfully deleted ${deletedCount} trees. Backup saved to Downloads.`);
      await loadTrees();
    } catch (error) {
      console.error('Error deleting trees:', error);
      setDeletionProgress({ active: false, deleted: 0, total: 0, currentTree: '' });
      setUploadStatus('❌ Error deleting trees: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  

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
    const result = downloadTemplateExcel(activeTab);
    setUploadStatus(`✅ Template downloaded: ${result.fileName}`);
  }

  // Export existing data to Excel
  function exportData() {
    const result = exportDataExcel(activeTab, tithis, events);
    if (activeTab === 'tithis') {
      const removed = result.duplicatesRemoved || 0;
      setUploadStatus(`✅ Exported ${result.count} tithis to ${result.fileName}${removed > 0 ? ` (removed ${removed} duplicate rows)` : ''}`);
    } else {
      setUploadStatus(`✅ Exported ${result.count} events to ${result.fileName}`);
    }
  }

  // Export problematic rows (from validationResults.problematic) to Excel for audit
  function exportProblematicRows() {
    const result = exportProblematicRowsExcel(validationResults);
    if (!result) {
      setUploadStatus('❌ No problematic rows to export');
      return;
    }
    setUploadStatus(`✅ Exported ${result.count} problematic rows to ${result.fileName}`);
  }

  // Generate Tithi Excel file for date range
  async function generateTithiExcel_handler() {
    const result = await generateTithiExcelService(autoStartDate, autoEndDate, { setAutoProgress, setAutoStatus });
    if (result) {
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setAutoProgress(0);
        setAutoStatus('');
      }, 5000);
    }
  }

  // Download Trees Excel (all trees currently loaded)
  function handleDownloadTreesExcel() {
    try {
      const result = downloadTreesExcelService(trees);
      setUploadStatus(`✅ Exported ${result.count} trees to ${result.fileName}`);
    } catch (err) {
      console.error('Error exporting trees:', err);
      setUploadStatus('❌ Error exporting trees: ' + (err.message || err));
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
        validateTithisDataExternal(jsonData, results, { existingTithis: tithis, calendarData: adminCalendarData });
      } else {
        validateEventsDataExternal(jsonData, results, { existingEvents: events, calendarData: adminCalendarData });
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

  // ─── Migrate existing tithi docs: add tithiMonth, tithiYear, pakshya, tithiName fields ───
  async function migrateTithiData() {
    if (!window.confirm(
      'This will migrate ALL tithi documents to add tithiMonth, tithiYear, pakshya, and tithiName fields, and update names to 3-part format.\n\nThis is safe to run multiple times. Continue?'
    )) return;

    setLoading(true);
    setUploadStatus('🔄 Migrating tithi data...');

    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.TITHIS));
      let currentBatch = writeBatch(db);
      let migratedCount = 0;
      let skippedCount = 0;
      let batchCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Skip if already migrated (has tithiMonth field with value)
        if (data.tithiMonth && data.pakshya && data.tithiName) {
          skippedCount++;
          continue;
        }

        // Parse the existing name (2-part or 3-part)
        const parsed = parseTithiName(data.name || '');
        let tithiMonthVal = parsed.tithiMonth || '';
        let tithiYearVal = null;

        // Compute tithiMonth and tithiYear from startDate if not already in name
        if (!tithiMonthVal && parsed.pakshya && parsed.tithi && data.startDate) {
          const pakshaEn = normalizePakshaToEnglish(parsed.pakshya);
          const tIdx = getTithiIndexByName(parsed.tithi, { fallbackToOne: false });
          if (tIdx) {
            tithiMonthVal = getTithiLunarMonthName(pakshaEn, tIdx, data.startDate) || '';
            const yearInfo = getTithiYearFromAdDate(data.startDate, null, pakshaEn, tIdx);
            tithiYearVal = yearInfo.tithiYear || null;
          }
        }

        // Build 3-part name
        const newName = tithiMonthVal
          ? `${tithiMonthVal} ${parsed.pakshya} ${parsed.tithi}`
          : `${parsed.pakshya} ${parsed.tithi}`;

        const updateFields = {
          name: newName,
          tithiMonth: tithiMonthVal,
          tithiYear: tithiYearVal,
          pakshya: parsed.pakshya || '',
          tithiName: parsed.tithi || '',
        };

        currentBatch.update(doc(db, COLLECTIONS.TITHIS, docSnap.id), updateFields);
        migratedCount++;
        batchCount++;

        // Firestore batch limit is 500 — commit and start new batch
        if (batchCount >= 450) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchCount = 0;
          setUploadStatus(`🔄 Migrated ${migratedCount} tithis so far...`);
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await currentBatch.commit();
      }

      setUploadStatus(`✅ Migration complete: ${migratedCount} migrated, ${skippedCount} already up-to-date`);
      await loadTithis();
    } catch (error) {
      console.error('Migration error:', error);
      setUploadStatus('❌ Migration error: ' + error.message);
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
      
      // For Tithis, recombine tithi and pakshya into name with tithiMonth
      if (activeTab === 'tithis' && updateData.tithi && updateData.pakshya) {
        // Compute tithiMonth from startDate if available
        let editTithiMonth = updateData.tithiMonth || '';
        let editTithiYear = updateData.tithiYear || null;
        if (updateData.startDate && !editTithiMonth) {
          const pakshaEn = normalizePakshaToEnglish(updateData.pakshya);
          const tIdx = getTithiIndexByName(updateData.tithi, { fallbackToOne: false });
          if (tIdx) {
            editTithiMonth = getTithiLunarMonthName(pakshaEn, tIdx, updateData.startDate) || '';
            const yearInfo = getTithiYearFromAdDate(updateData.startDate, null, pakshaEn, tIdx);
            editTithiYear = yearInfo.tithiYear || null;
          }
        }
        updateData.name = editTithiMonth
          ? `${editTithiMonth} ${updateData.pakshya} ${updateData.tithi}`
          : `${updateData.pakshya} ${updateData.tithi}`;
        updateData.tithiMonth = editTithiMonth;
        updateData.tithiYear = editTithiYear;
        updateData.pakshya = updateData.pakshya;
        updateData.tithiName = updateData.tithi;
        delete updateData.tithi;
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
        
        // Compute tithiMonth and tithiYear from start date
        let computedTithiMonth = '';
        let computedTithiYear = null;
        if (newRecordData.startDate && newRecordData.pakshya && newRecordData.tithi) {
          const pakshaEn = normalizePakshaToEnglish(newRecordData.pakshya);
          const tIdx = getTithiIndexByName(newRecordData.tithi, { fallbackToOne: false });
          if (tIdx) {
            computedTithiMonth = getTithiLunarMonthName(pakshaEn, tIdx, newRecordData.startDate) || '';
            const yearInfo = getTithiYearFromAdDate(newRecordData.startDate, null, pakshaEn, tIdx);
            computedTithiYear = yearInfo.tithiYear || null;
          }
        }

        // Build 3-part name: "month pakshya tithi"
        const tithiFullName = computedTithiMonth
          ? `${computedTithiMonth} ${newRecordData.pakshya} ${newRecordData.tithi}`
          : `${newRecordData.pakshya} ${newRecordData.tithi}`;

        // Create Tithi record
        const tithiData = {
          name: tithiFullName,
          tithiMonth: computedTithiMonth,
          tithiYear: computedTithiYear,
          pakshya: newRecordData.pakshya || '',
          tithiName: newRecordData.tithi || '',
          startDate: newRecordData.startDate,
          endDate: newRecordData.endDate,
          startTime: newRecordData.startTime,
          endTime: newRecordData.endTime,
          createdAt: new Date().toISOString(),
          createdByAdmin: true
        };
        
        await addDoc(collection(db, COLLECTIONS.TITHIS), tithiData);
        setUploadStatus('✅ Tithi added successfully');
        await loadTithis();
        
      } else {
        // Event logic
        
        // Resolve date from Tithi if in tithi mode
        let tithiInfo = null;
        if (eventEntryMode === 'tithi') {
           if (!newRecordTithiMonth || !newRecordTithiName) {
             setUploadStatus('❌ Please select Month and Tithi');
             return;
           }
           
           const [pakshaKey, tithiName] = newRecordTithiName.split('-');
           const paksha = normalizePakshaToEnglish(pakshaKey);
           const pakshaNepali = normalizePakshaToNepali(pakshaKey);
           
           // Determine current BS Year
           const today = new Date();
           const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
           const currentBsYear = bsToday.year;
           const selectedMonthName = nepaliMonths[parseInt(newRecordTithiMonth) - 1];
           
           // Find matching tithi
           const matchingTithi = tithis.find(t => {
             if (!t.name.includes(tithiName) || !t.name.includes(pakshaNepali)) return false;
             
             // Calculate Tithi Lunar Month & Year
             const tithiIndex = getTithiIndexByName(tithiName);
             const lunarMonthName = getTithiLunarMonthName(paksha, tithiIndex, t.startDate);
             const tithiYearInfo = getTithiYearFromAdDate(t.startDate, null, paksha, tithiIndex);
             
             return lunarMonthName === selectedMonthName && tithiYearInfo.tithiYear === currentBsYear;
           });
           
           if (matchingTithi) {
             newRecordData.dateKey = matchingTithi.startDate;
             const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
             if (!tithiIndex) {
               setUploadStatus(`❌ Could not determine tithi index for "${tithiName}". Please re-select the tithi.`);
               return;
             }
             const lunarMonthName = getTithiLunarMonthName(paksha, tithiIndex, matchingTithi.startDate);
             
             // Store tithi info for the event
             tithiInfo = {
               month: lunarMonthName,
               id: newRecordTithiName,  // e.g., 'shukla-Pratipada'
               name: tithiName,
               paksha: paksha
             };
           } else {
             setUploadStatus(`❌ Could not find date for ${selectedMonthName} ${pakshaNepali} ${tithiName} in year ${currentBsYear}. Please ensure Tithis are generated.`);
             return;
           }
        }

        if (!newRecordData.title || !newRecordData.dateKey) {
          setUploadStatus('❌ Please fill all required fields');
          return;
        }
        
        // Create Event record
        const eventData = {
          title: newRecordData.title,
          titleNormalized: normalizeForCompare(newRecordData.title),
          description: newRecordData.description || '',
          descriptionNormalized: normalizeForCompare(newRecordData.description || ''),
          dateKey: newRecordData.dateKey,
          isPublic: newRecordData.isPublic || false,
          associatedPerson: '',
          createdAt: new Date().toISOString(),
          createdByAdmin: true,
          createdBy: user?.uid || '',
          repetition: newRecordData.repetition || 'none'  // Default to no repeat
        };
        
        // Standardize: always set `tithi` field; null when not used.
        eventData.tithi = tithiInfo || null;
        
        await addDoc(collection(db, COLLECTIONS.CALENDAR_EVENTS), eventData);
        setUploadStatus('✅ Event added successfully');
        await loadEvents();
      }
      
      // Reset inline form
      setIsAddingNew(false);
      setNewRecordData({});
      setEventEntryMode('date');  // Reset to date mode
      setNewRecordTithiMonth('');  // Reset tithi fields
      setNewRecordTithiName('');
      
    } catch (error) {
      console.error('Error adding record:', error);
      setUploadStatus('❌ Error adding record: ' + error.message);
    }
  }

  // Cancel adding new record
  function cancelAddNew() {
    setIsAddingNew(false);
    setNewRecordData({});
    setEventEntryMode('date');  // Reset to date mode
    setNewRecordTithiMonth('');  // Reset tithi fields
    setNewRecordTithiName('');
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
            const parsed = parseTithiName(d.name || '');
            return {
              Tithi: d.tithiName || parsed.tithi || '',
              Pakshya: d.pakshya || parsed.pakshya || '',
              'Tithi Month': d.tithiMonth || parsed.tithiMonth || '',
              'Tithi Year': d.tithiYear || '',
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

  // Request confirmation for deleting test data by range/user
  function requestDeleteTestData() {
    setDeleteConfirmation({
      show: true,
      type: 'recent',
      count: 0,
      confirmText: '',
      details: null,
      range: '30', // default to 30 days
      userFilter: '',
      userType: 'all', // 'all', 'email', 'id'
    });
  }

  // Execute deletion of test data after user confirms, with range/user filter
  async function performDeleteTestData() {
    const { range = '30', userFilter = '', userType = 'all' } = deleteConfirmation;
    const days = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString();

    // Filter tithis/events by date and user
    let filteredTithis = tithis.filter(t => t.createdAt && t.createdAt > cutoffDate);
    let filteredEvents = events.filter(e => e.createdAt && e.createdAt > cutoffDate);
    if (userType === 'email' && userFilter) {
      filteredTithis = filteredTithis.filter(t => t.createdBy === userFilter);
      filteredEvents = filteredEvents.filter(e => e.createdBy === userFilter);
    } else if (userType === 'id' && userFilter) {
      filteredTithis = filteredTithis.filter(t => t.createdById === userFilter);
      filteredEvents = filteredEvents.filter(e => e.createdById === userFilter);
    }

    setLoading(true);
    setUploadStatus('🗑️ Deleting test data...');

    try {
      const batch = writeBatch(db);
      let deletedCount = 0;

      filteredTithis.forEach(tithi => {
        const docRef = doc(db, COLLECTIONS.TITHIS, tithi.id);
        batch.delete(docRef);
        deletedCount++;
      });

      filteredEvents.forEach(event => {
        const docRef = doc(db, COLLECTIONS.CALENDAR_EVENTS, event.id);
        batch.delete(docRef);
        deletedCount++;
      });

      await batch.commit();

      setUploadStatus(`✅ Deleted ${deletedCount} records (${filteredTithis.length} Tithis, ${filteredEvents.length} Events)`);

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
    
    // Parse name into components for Tithis (handles 2-part and 3-part names)
    if (activeTab === 'tithis' && record.name) {
      const { tithiMonth: parsedMonth, pakshya: parsedPakshya, tithi: parsedTithi } = parseTithiName(record.name);
      editData.pakshya = parsedPakshya || 'शुक्लपक्ष';
      editData.tithi = parsedTithi || '';
      editData.tithiMonth = record.tithiMonth || parsedMonth || '';
      editData.tithiYear = record.tithiYear || null;
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
          className={`admin-tab ${activeTab === 'trees' ? 'active' : ''}`}
          onClick={() => setActiveTab('trees')}
          disabled={!isAdmin}
          title={!isAdmin ? 'Admin only' : ''}
        >
          🌳 Trees
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
        {isAdmin && (
          <button 
            className={`admin-tab ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            🔑 API Keys
          </button>
        )}
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

      {activeTab === 'trees' && (
        <AdminTreesTab
          trees={trees}
          loading={loading}
          onDownloadExcel={handleDownloadTreesExcel}
          uploadStatus={uploadStatus}
        />
      )}

      {/* User Management moved to Settings -> User Management (top-level). */}

      {/* Data Management Tab */}
      {activeTab === 'dataManagement' && (
        <AdminDataManagementTab
          tithis={tithis}
          events={events}
          trees={trees}
          softDeletedTreesCount={softDeletedTreesCount}
          loading={loading}
          scanning={scanning}
          scanResults={scanResults}
          recentCount={recentCount}
          onBulkDelete={handleBulkDelete}
          onBulkDeleteTrees={handleBulkDeleteTrees}
          onRequestDeleteTestData={requestDeleteTestData}
          onScanTithis={scanTithisForBoundaryErrors}
          onFixTithiSwap={fixTithiSwap}
        />
      )}

      {/* Nepali Calendar Manager Tab */}
      {activeTab === 'calendar' && (
        <NepaliCalendarManagement 
          hasPermission={hasPermission} 
          PERMISSIONS={PERMISSIONS}
        />
      )}

      {/* API Key Requests Tab */}
      {activeTab === 'api-keys' && isAdmin && (
        <div className="admin-section">
          <AdminApiKeyRequestsTab user={user} />
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
        <div className="manual-mgmt-header">
          <h2 className="manual-mgmt-title">📝 Manual Management</h2>
        </div>
        
        <div className="manual-mgmt-search-filters-container">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <div className="manual-mgmt-filters-section">
            <div className="manual-mgmt-filter-item">
              <div className="manual-mgmt-filters-label">🔍 FILTERS</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setMonthFilter('all');
                  }}
                  className="manual-mgmt-filter-compact"
                >
                  <option value="all">All Years</option>
                  {getUniqueYears().map(year => (
                    <option key={year} value={year}>
                      {toNepaliNumber(year)}
                    </option>
                  ))}
                </select>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="manual-mgmt-filter-compact"
                  disabled={yearFilter === 'all'}
                >
                  <option value="all">All Months</option>
                  {nepaliMonths.map((month, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'events' && (
          <div className="manual-mgmt-entry-row">
            <span className="manual-mgmt-entry-label">Entry Mode:</span>
            <select 
              value={eventEntryMode} 
              onChange={(e) => setEventEntryMode(e.target.value)}
              className="manual-mgmt-entry-select"
            >
              <option value="date">📅 By Calendar Date</option>
              <option value="tithi">🔱 By Tithi + Month</option>
            </select>
            <button 
              onClick={() => {
                setIsAddingNew(true);
                setNewRecordData({ isPublic: false, title: '', description: '', dateKey: '' });
              }}
              className="btn-primary manual-mgmt-add-btn"
              title="Add new Event"
              disabled={isAddingNew}
            >
              Add Event
            </button>
          </div>
        )}
        {activeTab === 'tithis' && (
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                setIsAddingNew(true);
                setNewRecordData({ pakshya: 'शुक्लपक्ष', tithi: allTithis[0], startDate: '', endDate: '', startTime: '', endTime: '' });
              }}
              className="btn-primary manual-mgmt-add-btn"
              title="Add new Tithi"
              disabled={isAddingNew}
            >
              Add Tithi
            </button>
            <button
              onClick={migrateTithiData}
              className="btn-primary"
              title="Migrate existing tithis to add tithiMonth, tithiYear fields and 3-part name format"
              disabled={loading}
              style={{ backgroundColor: '#6366f1' }}
            >
              {loading ? '⏳ Migrating...' : '🔄 Migrate Tithi Data'}
            </button>
          </div>
        )}

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                {activeTab === 'tithis' ? (
                  <>
                    <th>Tithi</th>
                    <th>Pakshya</th>
                    <th>Tithi Month</th>
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
                    <span className="computed-field">(auto)</span>
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
                            <span className="computed-field">{editingData.tithiMonth || '(auto)'}</span>
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
                          <td>{tithi.tithiName || parseTithiName(tithi.name).tithi || tithi.name}</td>
                          <td>{tithi.pakshya || parseTithiName(tithi.name).pakshya || ''}</td>
                          <td>{tithi.tithiMonth || parseTithiName(tithi.name).tithiMonth || ''}</td>
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
                  <tr><td colSpan="8" className="empty-state">No tithis found</td></tr>
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
                        {eventEntryMode === 'date' ? (
                          // Calendar date mode
                          <>
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
                                📅 Select Date
                              </div>
                            )}
                          </>
                        ) : (
                          // Tithi + Month mode
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <select 
                              value={newRecordTithiMonth} 
                              onChange={(e) => setNewRecordTithiMonth(e.target.value)}
                              className="edit-input"
                              style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                            >
                              <option value="">Select Month</option>
                              {nepaliMonths.map((month, idx) => (
                                <option key={idx} value={idx + 1}>{month}</option>
                              ))}
                            </select>
                            <select 
                              value={newRecordTithiName} 
                              onChange={(e) => setNewRecordTithiName(e.target.value)}
                              className="edit-input"
                              style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                              disabled={!newRecordTithiMonth}
                            >
                              <option value="">Select Tithi</option>
                              {newRecordTithiMonth && getTithisForMonth(newRecordTithiMonth).map(tithi => (
                                <option key={tithi.tithiId} value={tithi.tithiId}>
                                  {tithi.name} ({tithi.pakshya})
                                </option>
                              ))}
                            </select>
                            {newRecordTithiMonth && newRecordTithiName && (
                              <small style={{ color: '#666', fontSize: '0.75rem' }}>
                                Note: Date will be looked up from calendar
                              </small>
                            )}
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
      <DeleteConfirmationModal
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        filteredTreesForModal={filteredTreesForModal}
        softDeletedTreesCount={softDeletedTreesCount}
        trees={trees}
        onExecuteBulkDelete={executeBulkDelete}
        onExecuteBulkDeleteTrees={executeBulkDeleteTrees}
        onPerformDeleteTestData={performDeleteTestData}
      />

      {/* Deletion Progress Overlay */}
      {deletionProgress.active && (
        <div className="deletion-progress-overlay">
          <div className="deletion-progress-card">
            <div className="deletion-spinner"></div>
            <h3>🗑️ Deletion In Progress</h3>
            <div className="deletion-progress-bar-track">
              <div
                className="deletion-progress-bar-fill"
                style={{ width: `${Math.round((deletionProgress.deleted / deletionProgress.total) * 100)}%` }}
              />
            </div>
            <p className="deletion-count">
              {deletionProgress.deleted} of {deletionProgress.total} trees deleted
              ({Math.round((deletionProgress.deleted / deletionProgress.total) * 100)}%)
            </p>
            {deletionProgress.currentTree && (
              <p className="deletion-current">Currently: {deletionProgress.currentTree}</p>
            )}
            <p className="deletion-warning">
              ⚠️ Please do not close or refresh this tab — closing the page will interrupt the deletion and leave partial data in the database.
            </p>
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
              onClick={generateTithiExcel_handler}
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
