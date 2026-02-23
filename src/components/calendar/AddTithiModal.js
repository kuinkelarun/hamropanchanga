/**
 * AddTithiModal.js
 *
 * Extracted from NepaliCalendar.js — handles the "Add Tithi" form
 * shown from the day tile or day-details modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import NepaliDatePicker from '../NepaliDatePicker';
import {
  NEPALI_MONTHS as nepaliMonths,
  SHUKLA_TITHI_NAMES as shuklaPackshyaTithis,
  KRISHNA_TITHI_NAMES as krishnaPackshyaTithis,
} from '../../constants/calendarConstants';
import {
  toNepaliNumber,
  formatTime12Hour,
} from '../../utils/calendarHelpers';
import { convertAdToBs } from '../../utils/nepaliDateUtils';

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen       - Whether the modal is visible
 * @param {Function} props.onClose      - Called to close the modal
 * @param {string}   props.activeDate   - "YYYY-MM-DD" of the calendar tile
 * @param {string}   props.focusHint    - "tithi" when the tithi dropdown should auto-focus
 * @param {Object}   props.user         - Firebase user object
 * @param {boolean}  props.authLoading  - True while auth is initialising
 * @param {Function} props.onAddTithi   - (dateKey, name, startDate, startTime, endDate, endTime) => Promise
 */
export default function AddTithiModal({
  isOpen,
  onClose,
  activeDate,
  focusHint,
  user,
  authLoading,
  onAddTithi,
}) {
  const { t } = useLanguage();
  const isDev = process.env.NODE_ENV !== 'production';
  const tithiInputRef = useRef(null);

  // ── Form state ──────────────────────────────────────────────
  const [newPakshya, setNewPakshya] = useState('शुक्लपक्ष');
  const [newTithi, setNewTithi] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [validation, setValidation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tithiDropdownOpen, setTithiDropdownOpen] = useState(false);

  // ── Reset / initialise on open / close ──────────────────────
  useEffect(() => {
    if (isOpen && activeDate) {
      // Pre-fill dates from the calendar tile
      setStartDate(activeDate);
      setEndDate(activeDate);
      setNewPakshya('शुक्लपक्ष');
      setNewTithi('');
      setStartTime('06:00');
      setEndTime('18:00');
      setValidation('');
      setIsLoading(false);
      setTithiDropdownOpen(false);
    }
    if (isOpen && focusHint === 'tithi') {
      setTimeout(() => {
        tithiInputRef.current?.focus();
      }, 40);
    }
    if (!isOpen) {
      setNewPakshya('शुक्लपक्ष');
      setNewTithi('');
      setStartDate('');
      setStartTime('06:00');
      setEndDate('');
      setEndTime('18:00');
      setValidation('');
      setIsLoading(false);
      setTithiDropdownOpen(false);
    }
  }, [isOpen, activeDate, focusHint]);

  // ── Close dropdown on outside click ─────────────────────────
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        tithiInputRef.current &&
        !tithiInputRef.current.closest('.nc-custom-dropdown').contains(event.target)
      ) {
        setTithiDropdownOpen(false);
      }
    }
    if (tithiDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tithiDropdownOpen]);

  // ── Submit handler ──────────────────────────────────────────
  async function submitAdd() {
    if (isLoading) return;

    if (isDev) console.log('submitAdd called with:', { newPakshya, newTithi, startDate, startTime, endDate, endTime, activeDate });

    setValidation('');
    if (!newPakshya) { setValidation('Select a Pakshya'); return; }
    if (!newTithi) { setValidation('Select a Tithi'); return; }

    if (!startDate || !endDate) {
      setValidation(!startDate ? 'Please select a start date' : 'Please select an end date');
      return;
    }
    if (!startTime || !endTime) {
      setValidation(!startTime ? 'Please select a start time' : 'Please select an end time');
      return;
    }

    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      setValidation('Please enter valid time format (HH:MM)');
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) {
      setValidation('End date cannot be before start date');
      return;
    }
    if (startDate === endDate && endTime <= startTime) {
      setValidation('End time must be after start time');
      return;
    }

    if (isDev) console.log('Validation passed, attempting to add tithi...');
    setIsLoading(true);

    try {
      const fullTithiName = `${newPakshya} ${newTithi}`;
      await onAddTithi(activeDate, fullTithiName, startDate, startTime, endDate, endTime);
      if (isDev) console.log('Tithi added successfully, clearing form and closing modal');

      // Clear form and close
      setNewPakshya('शुक्लपक्ष');
      setNewTithi('');
      setStartDate('');
      setStartTime('06:00');
      setEndDate('');
      setEndTime('18:00');
      setValidation('');
      onClose();
    } catch (error) {
      console.error('Error in submitAdd:', error);
      setValidation('Failed to add tithi. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────
  if (!isOpen) return null;

  // Compute BS date header
  const headerLabel = (() => {
    if (!activeDate) return '';
    const parts = activeDate.split('-').map((p) => +p);
    const bs = convertAdToBs(parts[0], parts[1] - 1, parts[2]);
    return `Add Tithi - ${nepaliMonths[bs.month - 1]} ${toNepaliNumber(bs.day)}, ${toNepaliNumber(bs.year)}`;
  })();

  return (
    <div className="nc-modal-backdrop" onClick={onClose}>
      <div className="nc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nc-modal-header">
          <h3 className="nc-modal-title">{headerLabel}</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nc-modal-body">
          <div className="nc-modal-section">
            {/* Pakshya Field */}
            <div className="nc-form-row">
              <label className="nc-label">पक्ष (Pakshya):</label>
              <select
                value={newPakshya}
                onChange={(e) => {
                  setNewPakshya(e.target.value);
                  setNewTithi('');
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
                  <span className={!newTithi ? 'nc-placeholder' : ''}>{newTithi || 'Select Tithi'}</span>
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
                    {(newPakshya === 'शुक्लपक्ष' ? shuklaPackshyaTithis : krishnaPackshyaTithis).map((tithi) => (
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

            {/* Date Range Fields — Start */}
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
                  onChange={(e) => setStartTime(e.target.value)}
                  onBlur={(e) => setStartTime(e.target.value)}
                  className="nc-input-time"
                  step="300"
                  required
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {startTime && formatTime12Hour(startTime)}
                </div>
              </div>
            </div>

            {/* Date Range Fields — End */}
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
                  onChange={(e) => setEndTime(e.target.value)}
                  onBlur={(e) => setEndTime(e.target.value)}
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
              <div
                style={{
                  padding: '0.5rem',
                  background: '#dbeafe',
                  borderLeft: '3px solid #3b82f6',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                ℹ️ This Tithi spans multiple days and will appear on all day cards from {startDate} to {endDate}
              </div>
            )}

            {validation && <div className="nc-validation">{validation}</div>}
            {!user && !authLoading && <div className="nc-validation">Please log in to add tithis</div>}

            <div className="nc-modal-actions">
              <button
                type="button"
                className="app-cancel-btn"
                onClick={() => {
                  onClose();
                  setValidation('');
                }}
                style={{ flex: '1 1 auto' }}
              >
                {t('calendar.cancel') || 'Cancel'}
              </button>
              <button
                onClick={submitAdd}
                className="app-save-btn"
                disabled={isLoading || !user || authLoading || !newTithi || !startDate || !endDate || !startTime || !endTime}
                style={{ flex: '1 1 auto' }}
              >
                {isLoading ? 'Adding...' : !user ? 'Log in to Add' : 'Add Tithi'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
