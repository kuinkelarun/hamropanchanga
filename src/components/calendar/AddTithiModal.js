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
  ENGLISH_NEPALI_MONTHS as englishNepaliMonths,
  SHUKLA_TITHI_NAMES as shuklaPackshyaTithis,
  KRISHNA_TITHI_NAMES as krishnaPackshyaTithis,
} from '../../constants/calendarConstants';
import {
  toNepaliNumber,
  formatTime12Hour,
} from '../../utils/calendarHelpers';
import { convertAdToBs } from '../../utils/nepaliDateUtils';

export default function AddTithiModal({
  isOpen,
  onClose,
  activeDate,
  focusHint,
  user,
  authLoading,
  onAddTithi,
}) {
  const { t, tn, isNepali } = useLanguage();
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
      setTimeout(() => { tithiInputRef.current?.focus(); }, 40);
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
    if (!startDate || !endDate) { setValidation(!startDate ? 'Please select a start date' : 'Please select an end date'); return; }
    if (!startTime || !endTime) { setValidation(!startTime ? 'Please select a start time' : 'Please select an end time'); return; }

    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) { setValidation('Please enter valid time format (HH:MM)'); return; }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) { setValidation('End date cannot be before start date'); return; }
    if (startDate === endDate && endTime <= startTime) { setValidation('End time must be after start time'); return; }

    if (isDev) console.log('Validation passed, attempting to add tithi...');
    setIsLoading(true);

    try {
      const fullTithiName = `${newPakshya} ${newTithi}`;
      await onAddTithi(activeDate, fullTithiName, startDate, startTime, endDate, endTime);
      if (isDev) console.log('Tithi added successfully');
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

  const [adYear, adMonth1, adDay] = activeDate ? activeDate.split('-').map(Number) : [0, 0, 0];
  const bs = activeDate ? convertAdToBs(adYear, adMonth1 - 1, adDay) : null;
  const headerDateNepali = bs
    ? (isNepali
        ? `${tn(bs.day)} ${nepaliMonths[bs.month - 1]} ${tn(bs.year)}`
        : `${bs.day} ${englishNepaliMonths[bs.month - 1]} ${bs.year}`)
    : '';

  const tithiOptions = newPakshya === 'शुक्लपक्ष' ? shuklaPackshyaTithis : krishnaPackshyaTithis;

  return (
    <div className="nc-modal-backdrop" onClick={onClose}>
      <div className="nc-modal ddm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="ddm-header">
          <div className="ddm-header-date">
            <span className="ddm-header-nepali" style={{ fontSize: '1.1rem' }}>
              {isNepali ? 'तिथि थप्नुहोस्' : 'Add Tithi'}
            </span>
            <span className="ddm-header-english">{headerDateNepali}</span>
          </div>
          <button className="ddm-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="nc-modal-body" style={{ padding: '16px 20px 0' }}>
          {/* Pakshya */}
          <div className="ddm-form-group">
            <label className="ddm-label">पक्ष (Pakshya)</label>
            <div className="ddm-tabs ddm-tabs-sm" role="tablist">
              <button
                type="button"
                className={`ddm-tab ${newPakshya === 'शुक्लपक्ष' ? 'ddm-tab-active' : ''}`}
                onClick={() => { setNewPakshya('शुक्लपक्ष'); setNewTithi(''); }}
                role="tab"
              >
                शुक्लपक्ष
              </button>
              <button
                type="button"
                className={`ddm-tab ${newPakshya === 'कृष्णपक्ष' ? 'ddm-tab-active' : ''}`}
                onClick={() => { setNewPakshya('कृष्णपक्ष'); setNewTithi(''); }}
                role="tab"
              >
                कृष्णपक्ष
              </button>
            </div>
          </div>

          {/* Tithi Selection — custom dropdown */}
          <div className="ddm-form-group">
            <label className="ddm-label">तिथि (Tithi)</label>
            <div className="nc-custom-dropdown" style={{ position: 'relative' }}>
              <div
                className="ddm-input"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setTithiDropdownOpen(!tithiDropdownOpen)}
                ref={tithiInputRef}
              >
                <span style={{ color: newTithi ? '#0f172a' : '#94a3b8' }}>
                  {newTithi || (isNepali ? 'तिथि छान्नुहोस्' : 'Select Tithi')}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {tithiDropdownOpen && (
                <div className="ddm-dropdown-menu">
                  {tithiOptions.map((tithi) => (
                    <div
                      key={tithi}
                      className={`ddm-dropdown-option ${newTithi === tithi ? 'ddm-dropdown-option-active' : ''}`}
                      onClick={() => { setNewTithi(tithi); setTithiDropdownOpen(false); }}
                    >
                      {tithi}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date + Time: Start */}
          <div className="ddm-form-row-2col">
            <div className="ddm-form-group">
              <NepaliDatePicker
                value={startDate}
                onChange={setStartDate}
                label={isNepali ? 'आरम्भ मिति' : 'Start Date'}
                required
              />
            </div>
            <div className="ddm-form-group">
              <label className="ddm-label">{isNepali ? 'आरम्भकाल' : 'Start Time'} *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onBlur={(e) => setStartTime(e.target.value)}
                className="ddm-input"
                step="300"
                required
              />
              {startTime && (
                <span className="ddm-time-hint">{formatTime12Hour(startTime)}</span>
              )}
            </div>
          </div>

          {/* Date + Time: End */}
          <div className="ddm-form-row-2col">
            <div className="ddm-form-group">
              <NepaliDatePicker
                value={endDate}
                onChange={setEndDate}
                label={isNepali ? 'समाप्ति मिति' : 'End Date'}
                required
              />
            </div>
            <div className="ddm-form-group">
              <label className="ddm-label">{isNepali ? 'समाप्तिकाल' : 'End Time'} *</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onBlur={(e) => setEndTime(e.target.value)}
                className="ddm-input"
                step="300"
                required
              />
              {endTime && (
                <span className="ddm-time-hint">{formatTime12Hour(endTime)}</span>
              )}
            </div>
          </div>

          {/* Multi-day indicator */}
          {startDate && endDate && startDate !== endDate && (
            <div className="ddm-info-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              {isNepali
                ? `यो तिथि ${startDate} देखि ${endDate} सम्म बहु-दिन हो`
                : `This Tithi spans multiple days (${startDate} to ${endDate})`}
            </div>
          )}

          {/* Validation */}
          {validation && <div className="ddm-validation">{validation}</div>}
          {!user && !authLoading && <div className="ddm-validation">{isNepali ? 'तिथि थप्न साइन इन गर्नुहोस्' : 'Please log in to add tithis'}</div>}
        </div>

        {/* Footer */}
        <div className="ddm-footer">
          <button type="button" className="ddm-btn ddm-btn-ghost" onClick={() => { onClose(); setValidation(''); }}>
            {t('calendar.cancel') || 'Cancel'}
          </button>
          <button
            onClick={submitAdd}
            className="ddm-btn ddm-btn-primary"
            disabled={isLoading || !user || authLoading || !newTithi || !startDate || !endDate || !startTime || !endTime}
          >
            {isLoading
              ? (isNepali ? 'थप्दै...' : 'Adding...')
              : !user
                ? (isNepali ? 'साइन इन गर्नुहोस्' : 'Log in to Add')
                : (isNepali ? 'तिथि थप्नुहोस्' : 'Add Tithi')}
          </button>
        </div>
      </div>
    </div>
  );
}
