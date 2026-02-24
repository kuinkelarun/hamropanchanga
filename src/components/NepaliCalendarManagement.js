import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/firestoreCollections';
import bsCalendarData from '../data/bsCalendarData';
import { NEPALI_MONTHS } from '../constants/calendarConstants';
import '../styles/NepaliCalendarManagement.css';

const nepaliMonthNames = NEPALI_MONTHS;

const NepaliCalendarManagement = ({ hasPermission, PERMISSIONS }) => {
  const [mode, setMode] = useState('view'); // 'view', 'add', 'edit'
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearsList, setYearsList] = useState([]);
  const [formData, setFormData] = useState({
    year: '',
    startAdDate: '',
    isLeapYear: false,
    daysInMonths: Array(12).fill(30)
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Initialize years list
  useEffect(() => {
    loadYearsList();
  }, []);

  // Load years from Firestore and merge with bsCalendarData
  const loadYearsList = async () => {
    try {
      const years = Object.keys(bsCalendarData)
        .map(y => parseInt(y))
        .sort((a, b) => a - b);
      
      // Also try to load custom years from Firestore
      try {
        const customYearsSnapshot = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
        const customYears = customYearsSnapshot.docs.map(doc => {
          const data = doc.data();
          const year = parseInt(data.year);
          if (!years.includes(year)) {
            years.push(year);
          }
          return year;
        });
        years.sort((a, b) => a - b);
      } catch (e) {
        // Collection may not exist yet or user lacks permissions; that's fine
        if (e.message && e.message.includes('permission')) {
          console.warn('Permission denied accessing nepaliCalendarYears collection');
        } else {
          console.log('nepaliCalendarYears collection not yet created, using only bsCalendarData');
        }
      }

      setYearsList(years);
    } catch (error) {
      console.error('Error loading years:', error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      year: '',
      startAdDate: '',
      isLeapYear: false,
      daysInMonths: Array(12).fill(30)
    });
    setSelectedYear(null);
    setMessage('');
  };

  // Load year for editing
  const loadYearForEdit = async (year) => {
    try {
      // Try to load from Firestore first (user edits)
      let yearData = null;
      try {
        const docRef = doc(db, COLLECTIONS.NEPALI_CALENDAR_YEARS, year.toString());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          yearData = docSnap.data();
        }
      } catch (e) {
        // Fall through to bsCalendarData
      }

      // If not in Firestore, use bsCalendarData
      if (!yearData) {
        yearData = bsCalendarData[year];
      }

      if (yearData) {
        const adDate = yearData.startAdDate || yearData.startAdDateString;
        const dateStr = typeof adDate === 'string' 
          ? adDate 
          : new Date(adDate).toISOString().split('T')[0];
        
        setFormData({
          year: year.toString(),
          startAdDate: dateStr,
          isLeapYear: yearData.isLeapYear !== undefined 
            ? yearData.isLeapYear 
            : yearData.daysInMonths.reduce((a, b) => a + b, 0) === 366,
          daysInMonths: [...yearData.daysInMonths]
        });
        setSelectedYear(year);
        setMode('edit');
        setMessage('');
      }
    } catch (error) {
      setMessage(`❌ Error loading year: ${error.message}`);
      setMessageType('error');
    }
  };

  // Handle month days change
  const handleMonthDaysChange = (monthIndex, value) => {
    const newDays = [...formData.daysInMonths];
    const numValue = Math.min(Math.max(parseInt(value) || 29, 29), 32);
    newDays[monthIndex] = numValue;
    
    setFormData(prev => ({
      ...prev,
      daysInMonths: newDays,
      isLeapYear: newDays.reduce((a, b) => a + b, 0) === 366
    }));
  };

  // Handle add new year
  const handleAddYear = () => {
    setFormData({
      year: '',
      startAdDate: '',
      isLeapYear: false,
      daysInMonths: Array(12).fill(30)
    });
    setSelectedYear(null);
    setMode('add');
    setMessage('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.year || !formData.startAdDate) {
      setMessage('Year and Start Date are required');
      setMessageType('error');
      return false;
    }

    const year = parseInt(formData.year);
    if (isNaN(year) || year < 1900 || year > 2500) {
      setMessage('Year must be between 1900 and 2500');
      setMessageType('error');
      return false;
    }

    if (mode === 'add' && yearsList.includes(year)) {
      setMessage('Year already exists. Use Edit mode to update it.');
      setMessageType('error');
      return false;
    }

    const totalDays = formData.daysInMonths.reduce((a, b) => a + b, 0);
    if (totalDays !== 365 && totalDays !== 366) {
      setMessage(`Total days must be 365 or 366. Current: ${totalDays}`);
      setMessageType('error');
      return false;
    }

    return true;
  };

  // Save year
  const handleSaveYear = async () => {
    if (!validateForm()) return;

    try {
      const year = parseInt(formData.year);
      
      // Create new calendar data
      const newYearData = {
        year,
        startAdDate: formData.startAdDate,
        daysInMonths: formData.daysInMonths,
        isLeapYear: formData.isLeapYear,
        totalDays: formData.daysInMonths.reduce((a, b) => a + b, 0),
        lastModified: new Date().toISOString()
      };

      // Save to Firestore in nepaliCalendarYears collection
      const yearDocRef = doc(db, COLLECTIONS.NEPALI_CALENDAR_YEARS, year.toString());
      await setDoc(yearDocRef, newYearData);

      const actionType = mode === 'add' ? 'added' : 'updated';
      
      // Show detailed success message
      setMessage(
        `✅ Year ${year} ${actionType} successfully!\n` +
        `📁 Saved to database (nepaliCalendarYears collection).\n` +
        `This will be reflected across the app after reload.`
      );
      setMessageType('success');

      // Keep success message visible for 3.5 seconds, then switch to view mode
      setTimeout(() => {
        setMode('view');
        resetForm();
        setMessage('');
        // Reload years list
        loadYearsList();
      }, 3500);
    } catch (error) {
      console.error('Firestore save error:', error);
      const errorMsg = error.message.includes('permission') 
        ? '❌ Permission denied. You may not have permission to save calendar data.'
        : error.message.includes('not found')
        ? '❌ Database collection not found. An admin may need to create the nepaliCalendarYears collection.'
        : `❌ Error saving: ${error.message}`;
      setMessage(errorMsg);
      setMessageType('error');
    }
  };

  // Calculate total days in year
  const totalDays = formData.daysInMonths.reduce((a, b) => a + b, 0);

  return (
    <div className="nepali-calendar-management">
      <div className="calendar-header">
        <h2>📅 Nepali Calendar Management</h2>
        <p>Add, edit, or view Nepali calendar years and month configurations</p>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`}>
          {message}
          <button 
            className="alert-close" 
            onClick={() => setMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {/* Mode Selection */}
      <div className="mode-selector">
        <button 
          className={`mode-btn ${mode === 'view' ? 'active' : ''}`}
          onClick={() => { setMode('view'); resetForm(); }}
        >
          👁️ View Years
        </button>
        <button 
          className={`mode-btn ${mode === 'add' ? 'active' : ''}`}
          onClick={handleAddYear}
          disabled={!hasPermission(PERMISSIONS.MANAGE_CALENDAR)}
        >
          Add Year
        </button>
        <button 
          className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}
          disabled={!selectedYear || !hasPermission(PERMISSIONS.MANAGE_CALENDAR)}
        >
          ✏️ Edit Year
        </button>
      </div>

      {/* View Mode */}
      {mode === 'view' && (
        <div className="view-section">
          <div className="years-grid">
            {yearsList.map(year => {
              const yearData = bsCalendarData[year];
              const totalDaysInYear = yearData.daysInMonths.reduce((a, b) => a + b, 0);
              const isLeap = totalDaysInYear === 366;
              const startDate = new Date(yearData.startAdDate);
              const startDateStr = startDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              });

              return (
                <div 
                  key={year} 
                  className={`year-card ${selectedYear === year ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedYear(year);
                    loadYearForEdit(year);
                  }}
                >
                  <div className="year-number">{year}</div>
                  <div className="year-badge">
                    <span className={`leap-badge ${isLeap ? 'leap' : ''}`}>
                      {isLeap ? '🔄 Leap' : 'Regular'}
                    </span>
                  </div>
                  <div className="year-info">
                    <div className="info-row">
                      <span className="label">Starts:</span>
                      <span className="value">{startDateStr}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Total Days:</span>
                      <span className="value">{totalDaysInYear}</span>
                    </div>
                  </div>
                  {hasPermission(PERMISSIONS.MANAGE_CALENDAR) && (
                    <button 
                      className="edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadYearForEdit(year);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Mode */}
      {(mode === 'add' || mode === 'edit') && (
        <div className="form-section">
          <div className="form-container">
            <h3>{mode === 'add' ? 'Add New Nepali Year' : `Edit Year ${selectedYear}`}</h3>

            <div className="form-group">
              <label htmlFor="year">Nepali Year *</label>
              <input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                placeholder="Enter year (e.g., 2082)"
                min="1900"
                max="2500"
                disabled={mode === 'edit'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="startAdDate">Start AD Date *</label>
              <input
                id="startAdDate"
                type="date"
                value={formData.startAdDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startAdDate: e.target.value }))}
              />
              <small>The Gregorian (AD) date when this Nepali year begins</small>
            </div>

            {/* Month Days Editor */}
            <div className="months-editor">
              <h4>Days in Each Month</h4>
              <p className="editor-info">
                Each month must have 29-32 days. Total days: <strong>{totalDays}</strong> 
                <span className={`total-status ${totalDays === 365 ? 'valid' : totalDays === 366 ? 'leap' : 'invalid'}`}>
                  {totalDays === 365 ? ' ✅ Regular Year' : totalDays === 366 ? ' 🔄 Leap Year' : ' ❌ Invalid'}
                </span>
              </p>

              <div className="months-grid">
                {nepaliMonthNames.map((monthName, idx) => (
                  <div key={idx} className="month-input-group">
                    <label htmlFor={`month-${idx}`}>{monthName}</label>
                    <input
                      id={`month-${idx}`}
                      type="number"
                      value={formData.daysInMonths[idx]}
                      onChange={(e) => handleMonthDaysChange(idx, e.target.value)}
                      min="29"
                      max="32"
                    />
                    <span className="days-label">days</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leap Year Info */}
            <div className={`leap-year-info ${formData.isLeapYear ? 'leap' : ''}`}>
              <input
                type="checkbox"
                id="leapYear"
                checked={formData.isLeapYear}
                onChange={(e) => setFormData(prev => ({ ...prev, isLeapYear: e.target.checked }))}
                title="Leap year checkbox is now editable. Manual edits here will be saved."
              />
              <label htmlFor="leapYear">
                {formData.isLeapYear ? '🔄 This is a Leap Year (366 days)' : 'Regular Year (365 days)'}
              </label>
              <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                The leap year status is auto-calculated from total days, but you can override it if needed.
              </small>
            </div>

            {/* Summary */}
            <div className="form-summary">
              <h4>Summary</h4>
              <div className="summary-row">
                <span>Year:</span>
                <strong>{formData.year || '-'}</strong>
              </div>
              <div className="summary-row">
                <span>Start Date:</span>
                <strong>
                  {formData.startAdDate 
                    ? (() => {
                        // Parse date without timezone offset to avoid off-by-one day issues
                        const [year, month, day] = formData.startAdDate.split('-');
                        const date = new Date(year, parseInt(month) - 1, parseInt(day));
                        return date.toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        });
                      })()
                    : '-'}
                </strong>
              </div>
              <div className="summary-row">
                <span>Total Days:</span>
                <strong>{totalDays}</strong>
              </div>
              <div className="summary-row">
                <span>Type:</span>
                <strong>{formData.isLeapYear ? '🔄 Leap Year' : 'Regular Year'}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="form-actions">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setMode('view');
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-save" 
                onClick={handleSaveYear}
              >
                {mode === 'add' ? 'Add Year' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="info-card">
        <h4>ℹ️ Information</h4>
        <ul>
          <li>Nepali year has 12 months</li>
          <li>Each month must have between 29-32 days</li>
          <li>A regular year has 365 days, leap year has 366 days</li>
          <li>The "Start AD Date" is when the Nepali year begins in Gregorian calendar</li>
          <li>Only administrators can add or edit calendar data</li>
          <li>Changes are saved to the calendar database after confirmation</li>
        </ul>
      </div>
    </div>
  );
};

export default NepaliCalendarManagement;
