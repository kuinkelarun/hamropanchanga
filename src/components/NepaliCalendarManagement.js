import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { NEPALI_MONTHS } from '../constants/calendarConstants';
import '../styles/NepaliCalendarManagement.css';

const nepaliMonthNames = NEPALI_MONTHS;

const NepaliCalendarManagement = ({ hasPermission, PERMISSIONS }) => {
  const [mode, setMode] = useState('view'); // 'view', 'add', 'edit'
  const [selectedYear, setSelectedYear] = useState(null);
  const [calendarData, setCalendarData] = useState({}); // year (int) → full doc data — single source of truth
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    year: '',
    startAdDate: '',
    isLeapYear: false,
    daysInMonths: Array(12).fill(30)
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [scrollTarget, setScrollTarget] = useState(null); // year to scroll back to when returning to view
  const yearCardRefs = useRef({}); // year → DOM element

  // ── Load all calendar data from Firestore (single source of truth) ──────────
  const loadAllCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
      const data = {};
      snapshot.docs.forEach(docSnap => {
        const year = parseInt(docSnap.id);
        if (isNaN(year)) return;
        const d = docSnap.data();
        // Normalize startAdDate to YYYY-MM-DD string regardless of how it was stored
        let startAdDate = d.startAdDate;
        if (startAdDate && typeof startAdDate.toDate === 'function') {
          startAdDate = startAdDate.toDate().toISOString().split('T')[0];
        } else if (startAdDate instanceof Date) {
          startAdDate = startAdDate.toISOString().split('T')[0];
        }
        data[year] = { ...d, startAdDate };
      });
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setMessage('❌ Error loading calendar data: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCalendarData();
  }, [loadAllCalendarData]);

  // ── Scroll back to the edited year card when returning to view mode ──────────
  useEffect(() => {
    if (mode === 'view' && scrollTarget) {
      // Wait one animation frame so the grid has re-rendered
      requestAnimationFrame(() => {
        const el = yearCardRefs.current[scrollTarget];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setScrollTarget(null);
      });
    }
  }, [mode, scrollTarget]);

  // ── Reset form ───────────────────────────────────────────────────────────────
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

  // ── Load a year into the edit form (from local calendarData state) ───────────
  const loadYearForEdit = (year) => {
    const yearData = calendarData[year];
    if (!yearData) return;

    setFormData({
      year: year.toString(),
      startAdDate: yearData.startAdDate || '',
      isLeapYear: yearData.isLeapYear !== undefined
        ? yearData.isLeapYear
        : (yearData.daysInMonths || []).reduce((a, b) => a + b, 0) === 366,
      daysInMonths: [...(yearData.daysInMonths || Array(12).fill(30))]
    });
    setSelectedYear(year);
    setScrollTarget(year); // remember which card to scroll back to
    setMode('edit');
    setMessage('');
  };

  // ── Month days input ─────────────────────────────────────────────────────────
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

  // ── Add new year ─────────────────────────────────────────────────────────────
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

  // ── Validate form ────────────────────────────────────────────────────────────
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
    if (mode === 'add' && calendarData[year]) {
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

  // ── Save year to Firestore and update local state ────────────────────────────
  const handleSaveYear = async () => {
    if (!validateForm()) return;
    try {
      const year = parseInt(formData.year);
      const newYearData = {
        year,
        startAdDate: formData.startAdDate,
        daysInMonths: formData.daysInMonths,
        isLeapYear: formData.isLeapYear,
        totalDays: formData.daysInMonths.reduce((a, b) => a + b, 0),
        lastModified: new Date().toISOString()
      };

      await setDoc(doc(db, COLLECTIONS.NEPALI_CALENDAR_YEARS, year.toString()), newYearData);

      // Update local state immediately — no full reload needed
      setCalendarData(prev => ({ ...prev, [year]: newYearData }));

      const actionType = mode === 'add' ? 'added' : 'updated';
      setMessage(`✅ Year ${year} ${actionType} successfully!`);
      setMessageType('success');

      setScrollTarget(year); // scroll back to this year's card
      setTimeout(() => {
        setMode('view');
        resetForm();
        setMessage('');
      }, 2000);
    } catch (error) {
      console.error('Firestore save error:', error);
      const errorMsg = error.message.includes('permission')
        ? '❌ Permission denied. You may not have permission to save calendar data.'
        : `❌ Error saving: ${error.message}`;
      setMessage(errorMsg);
      setMessageType('error');
    }
  };

  const totalDays = formData.daysInMonths.reduce((a, b) => a + b, 0);
  const sortedYears = Object.keys(calendarData).map(Number).sort((a, b) => a - b);

  return (
    <div className="nepali-calendar-management">
      <div className="calendar-header">
        <h2>📅 Nepali Calendar Management</h2>
        <p>Manage Nepali calendar years and month configurations. All data is stored in and read from the database.</p>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`}>
          {message}
          <button className="alert-close" onClick={() => setMessage('')}>×</button>
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
          {loading ? (
            <div className="loading-state">Loading calendar data from database…</div>
          ) : sortedYears.length === 0 ? (
            <div className="empty-state">
              <p>No calendar years found in the database.</p>
              <p>Use the "Add Year" button to add calendar data.</p>
            </div>
          ) : (
            <div className="years-grid">
              {sortedYears.map(year => {
                const yearData = calendarData[year];
                const daysInMonths = yearData.daysInMonths || [];
                const totalDaysInYear = daysInMonths.reduce((a, b) => a + b, 0);
                const isLeap = yearData.isLeapYear ?? (totalDaysInYear === 366);
                const startDateStr = yearData.startAdDate
                  ? (() => {
                      const [y, m, d] = yearData.startAdDate.split('-');
                      return new Date(y, parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      });
                    })()
                  : '—';

                return (
                  <div
                    key={year}
                    ref={el => { yearCardRefs.current[year] = el; }}
                    className={`year-card ${selectedYear === year ? 'selected' : ''}`}
                    onClick={() => loadYearForEdit(year)}
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
                        onClick={(e) => { e.stopPropagation(); loadYearForEdit(year); }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                Each month must have 29–32 days. Total days: <strong>{totalDays}</strong>
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
              />
              <label htmlFor="leapYear">
                {formData.isLeapYear ? '🔄 This is a Leap Year (366 days)' : 'Regular Year (365 days)'}
              </label>
              <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                Auto-calculated from total days, but can be overridden if needed.
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
                        const [y, m, d] = formData.startAdDate.split('-');
                        return new Date(y, parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
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
                onClick={() => { setMode('view'); resetForm(); }}
              >
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveYear}>
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
          <li>Each month must have between 29–32 days</li>
          <li>A regular year has 365 days, leap year has 366 days</li>
          <li>The "Start AD Date" is when the Nepali year begins in the Gregorian calendar</li>
          <li>Only administrators can add or edit calendar data</li>
          <li>Changes are saved directly to the database and reflected immediately</li>
        </ul>
      </div>
    </div>
  );
};

export default NepaliCalendarManagement;
