/**
 * AddEventModal.js
 *
 * Extracted from NepaliCalendar.js — handles the "Add Event" form
 * (private / for-family-member / public events) shown from either
 * the calendar day tile or the day-details modal.
 */
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import NepaliDatePicker from '../NepaliDatePicker';
import {
  NEPALI_MONTHS as nepaliMonths,
  ENGLISH_NEPALI_MONTHS as englishNepaliMonths,
} from '../../constants/calendarConstants';
import {
  toNepaliNumber,
  parseTithiName,
  compareTithisByStart,
} from '../../utils/calendarHelpers';
import {
  getTithiLunarMonthName,
  getTithiIndexByName,
  convertAdToBs,
} from '../../utils/nepaliDateUtils';
import { createEvent } from '../../services/CalendarEventService';
import { getEnglishPakshyaName, getEnglishTithiName } from '../../utils/calendarHelpers';

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen              - Whether the modal is visible
 * @param {Function} props.onClose             - Called to close the modal
 * @param {string}   props.activeDate          - "YYYY-MM-DD" of the calendar tile
 * @param {Object}   props.user                - Firebase user object
 * @param {boolean}  props.authLoading         - True while auth is initialising
 * @param {boolean}  props.isAdmin             - Current user is admin
 * @param {boolean}  props.isSuperUser         - Current user is super-user
 * @param {Function} props.findTithisForAdDate - (year, monthZero, day) => tithi[]
 */
export default function AddEventModal({
  isOpen,
  onClose,
  activeDate,
  user,
  authLoading,
  isAdmin,
  isSuperUser,
  findTithisForAdDate,
}) {
  const { t, isNepali } = useLanguage();
  const isDev = process.env.NODE_ENV !== 'production';

  // ── Form state ──────────────────────────────────────────────
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventRepetition, setEventRepetition] = useState('none');
  const [eventType, setEventType] = useState('private');
  const [eventAssociateMode, setEventAssociateMode] = useState('date');
  const [selectedEventTithiId, setSelectedEventTithiId] = useState('');
  const [selectedTreeId, setSelectedTreeId] = useState('');
  const [selectedTreeMemberId, setSelectedTreeMemberId] = useState('');
  const [eventValidation, setEventValidation] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Tree / member lists loaded for the "For Family Member" tab
  const [availableTrees, setAvailableTrees] = useState([]);
  const [availableTreeMembers, setAvailableTreeMembers] = useState([]);

  // ── Reset form when modal opens / closes ────────────────────
  useEffect(() => {
    if (isOpen && activeDate) {
      // Pre-fill the date field from the calendar tile
      setEventDate(activeDate);
      setEventTitle('');
      setEventDescription('');
      setEventRepetition('none');
      setEventType('private');
      setEventAssociateMode('date');
      setSelectedEventTithiId('');
      setSelectedTreeId('');
      setSelectedTreeMemberId('');
      setEventValidation('');
      setIsAddingEvent(false);
    }
    if (!isOpen) {
      // Clean up when closing
      setEventTitle('');
      setEventDescription('');
      setEventDate('');
      setEventRepetition('none');
      setEventType('private');
      setEventAssociateMode('date');
      setSelectedEventTithiId('');
      setSelectedTreeId('');
      setSelectedTreeMemberId('');
      setEventValidation('');
      setIsAddingEvent(false);
    }
  }, [isOpen, activeDate]);

  // ── Load available trees (real-time) ────────────────────────
  useEffect(() => {
    if (!user) {
      setAvailableTrees([]);
      return;
    }
    const treesCol = collection(db, 'trees');
    const q = isAdmin
      ? query(treesCol)
      : query(treesCol, where('ownerUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const treesList = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((tree) => !tree.deleted);
      treesList.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
      setAvailableTrees(treesList);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  // ── Load tree members when "For Family Member" is active ────
  useEffect(() => {
    if (!isOpen || eventType !== 'customer') {
      setAvailableTreeMembers([]);
      return;
    }
    if (!selectedTreeId) {
      setAvailableTreeMembers([]);
      return;
    }
    const membersCol = collection(db, 'trees', selectedTreeId, 'members');
    const unsubscribe = onSnapshot(membersCol, (snapshot) => {
      const membersList = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((m) => !m.archived);
      membersList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setAvailableTreeMembers(membersList);
    });
    return () => unsubscribe();
  }, [isOpen, eventType, selectedTreeId]);

  // ── Keep selected tithi in sync with event date ─────────────
  useEffect(() => {
    if (eventAssociateMode !== 'tithi') return;
    if (!eventDate) {
      setSelectedEventTithiId('');
      return;
    }
    const [y, m, d] = eventDate.split('-').map(Number);
    const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];
    if (tithisForEventDate.length === 0) {
      setSelectedEventTithiId('');
      return;
    }
    if (!selectedEventTithiId || !tithisForEventDate.some((t) => t.id === selectedEventTithiId)) {
      setSelectedEventTithiId(tithisForEventDate[0].id);
    }
  }, [eventAssociateMode, eventDate, findTithisForAdDate, selectedEventTithiId]);

  // ── Tithi display name (local helper) ───────────────────────
  const getTithiDisplayName = (tithi) => {
    const { pakshya, tithi: tithiName } = parseTithiName(tithi.name);
    if (!tithi.startDate) return tithi.name;

    const pakshaNormalized = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
    const tithiIndex = getTithiIndexByName(tithiName);

    if (tithiIndex) {
      const lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
      if (lunarMonth) {
        const monthIndex = nepaliMonths.indexOf(lunarMonth);
        const monthDisplay =
          monthIndex !== -1 ? (isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex]) : lunarMonth;
        const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
        const tithiDisplay = isNepali ? tithiName : getEnglishTithiName(tithiName);
        return `${monthDisplay} ${pakshyaDisplay} ${tithiDisplay}`;
      }
    }
    return tithi.name;
  };

  // ── Submit handler ──────────────────────────────────────────
  async function submitAddEvent() {
    if (!user) {
      setEventValidation('Please log in to add events.');
      return;
    }
    if (!eventTitle.trim()) {
      setEventValidation('Please enter an event title.');
      return;
    }
    if (!eventDate) {
      setEventValidation('Please select a date.');
      return;
    }

    // Optional tithi association
    let tithiPayload = null;
    if (eventAssociateMode === 'tithi') {
      const [y, m, d] = eventDate.split('-').map(Number);
      const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];
      if (tithisForEventDate.length === 0) {
        setEventValidation('No tithi is available for the selected date.');
        return;
      }
      const selectedTithi = tithisForEventDate.find((t) => t.id === selectedEventTithiId) || tithisForEventDate[0];
      if (!selectedTithi) {
        setEventValidation('Please select a tithi.');
        return;
      }
      const { pakshya, tithi: tithiName } = parseTithiName(selectedTithi.name);
      const pakshaNormalized = pakshya === 'शुक्लपक्ष' ? 'Shukla' : 'Krishna';
      const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
      if (!tithiIndex) {
        setEventValidation('Could not determine the selected tithi. Please try selecting the tithi again.');
        return;
      }
      const lunarMonthName =
        tithiIndex != null ? getTithiLunarMonthName(pakshaNormalized, tithiIndex, eventDate) : null;
      tithiPayload = {
        id: selectedTithi.id,
        name: tithiName,
        paksha: pakshaNormalized,
        month: lunarMonthName || null,
      };
    }

    // Validate for family-member events
    if (eventType === 'customer') {
      if (!selectedTreeId) {
        setEventValidation('Please select a tree.');
        return;
      }
      if (!selectedTreeMemberId) {
        setEventValidation('Please select a family member.');
        return;
      }
    }

    setIsAddingEvent(true);
    setEventValidation('');

    try {
      const isPublic = eventType === 'public';
      const createdByAdmin = isAdmin || isSuperUser;

      await createEvent({
        name: eventTitle,
        description: eventDescription,
        date: eventDate,
        personId: eventType === 'customer' ? selectedTreeMemberId : null,
        repetition: eventRepetition,
        tithi: tithiPayload,
        userId: user.uid,
        treeId: eventType === 'customer' ? selectedTreeId : null,
        isPublic,
        isAdmin: createdByAdmin,
      });

      if (isDev) {
        if (eventType === 'customer') console.log('Family member (tree) event added successfully');
        else console.log(`${isPublic ? 'Public' : 'Private'} event added successfully`);
      }

      onClose();
    } catch (error) {
      console.error('Error adding event:', error);
      setEventValidation(`Error adding event: ${error.message}`);
    } finally {
      setIsAddingEvent(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────
  if (!isOpen) return null;

  // Compute BS date header from activeDate
  const headerLabel = (() => {
    if (!activeDate) return '';
    const parts = activeDate.split('-').map((p) => +p);
    const adYear = parts[0];
    const adMonthZeroBased = parts[1] - 1;
    const adDay = parts[2];
    const bs = convertAdToBs(adYear, adMonthZeroBased, adDay);
    const monthIndex = bs.month - 1;
    const monthName = isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex];
    return isNepali
      ? `${toNepaliNumber(bs.day)} ${monthName}, ${toNepaliNumber(bs.year)}`
      : `${bs.day} ${monthName}, ${bs.year}`;
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
            {/* Event Type Selection */}
            <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
              <label className="nc-label">{t('calendar.addEvent')}</label>
              <div className="nc-event-type-tabs" role="tablist" aria-label="Event type">
                <button
                  type="button"
                  className={`nc-event-type-tab ${eventType === 'private' ? 'active' : ''}`}
                  onClick={() => {
                    setEventType('private');
                    setSelectedTreeId('');
                    setSelectedTreeMemberId('');
                  }}
                  aria-selected={eventType === 'private'}
                  role="tab"
                >
                  {t('calendar.forSelf')}
                </button>
                <button
                  type="button"
                  className={`nc-event-type-tab ${eventType === 'customer' ? 'active' : ''}`}
                  onClick={() => setEventType('customer')}
                  aria-selected={eventType === 'customer'}
                  role="tab"
                >
                  {t('calendar.forFamilyMember')}
                </button>
                {(isAdmin || isSuperUser) && (
                  <button
                    type="button"
                    className={`nc-event-type-tab ${eventType === 'public' ? 'active' : ''}`}
                    onClick={() => {
                      setEventType('public');
                      setSelectedTreeId('');
                      setSelectedTreeMemberId('');
                    }}
                    aria-selected={eventType === 'public'}
                    role="tab"
                  >
                    {t('calendar.public')}
                  </button>
                )}
              </div>
            </div>

            {/* Tree + Family Member Selection */}
            {eventType === 'customer' && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="nc-label">{t('calendar.selectTree')}</label>
                  <select
                    value={selectedTreeId}
                    onChange={(e) => {
                      setSelectedTreeId(e.target.value);
                      setSelectedTreeMemberId('');
                    }}
                    className="nc-select"
                  >
                    <option value="">{t('calendar.selectTreePlaceholder')}</option>
                    {availableTrees.map((tree) => (
                      <option key={tree.id} value={tree.id}>
                        {tree.title || 'Untitled Tree'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="nc-label">{t('calendar.selectMember')}</label>
                  <select
                    value={selectedTreeMemberId}
                    onChange={(e) => setSelectedTreeMemberId(e.target.value)}
                    className="nc-select"
                    disabled={!selectedTreeId}
                  >
                    <option value="">{t('calendar.selectMemberPlaceholder')}</option>
                    {availableTreeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Event Title */}
            <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
              <label className="nc-label">{t('calendar.eventTitle')}</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder={t('calendar.eventTitlePlaceholder')}
                className="nc-input"
              />
            </div>

            {/* Event Description */}
            <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
              <label className="nc-label">{t('calendar.description')}</label>
              <textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder={t('calendar.descriptionPlaceholder')}
                className="nc-input"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Associate with date or tithi */}
            <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
              <label className="nc-label">{t('calendar.associateWith')}</label>
              <div className="nc-event-type-tabs" role="tablist" aria-label="Associate event with">
                <button
                  type="button"
                  className={`nc-event-type-tab ${eventAssociateMode === 'date' ? 'active' : ''}`}
                  onClick={() => setEventAssociateMode('date')}
                  aria-selected={eventAssociateMode === 'date'}
                  role="tab"
                >
                  {t('calendar.date')}
                </button>
                <button
                  type="button"
                  className={`nc-event-type-tab ${eventAssociateMode === 'tithi' ? 'active' : ''}`}
                  onClick={() => setEventAssociateMode('tithi')}
                  aria-selected={eventAssociateMode === 'tithi'}
                  role="tab"
                >
                  {t('calendar.tithi')}
                </button>
              </div>
            </div>

            {eventAssociateMode === 'tithi' && (
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <label className="nc-label">{t('calendar.selectTithi')}</label>
                {(() => {
                  if (!eventDate) {
                    return <div className="muted">No day selected. Close and reopen from a calendar day.</div>;
                  }
                  const [y, m, d] = eventDate.split('-').map(Number);
                  const tithisForEventDate = (findTithisForAdDate(y, m - 1, d) || []).slice().sort(compareTithisByStart);
                  if (tithisForEventDate.length === 0) {
                    return <div className="muted">No tithi found for the selected date.</div>;
                  }
                  return (
                    <select
                      value={selectedEventTithiId}
                      onChange={(e) => setSelectedEventTithiId(e.target.value)}
                      className="nc-select"
                    >
                      {tithisForEventDate.map((ti) => (
                        <option key={ti.id} value={ti.id}>
                          {getTithiDisplayName(ti)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}

            {eventAssociateMode === 'date' && (
              <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
                <NepaliDatePicker
                  value={eventDate}
                  onChange={setEventDate}
                  label={t('calendar.eventDate')}
                  required
                />
              </div>
            )}

            {/* Event Repetition */}
            <div className="nc-form-row" style={{ marginBottom: '1rem' }}>
              <label className="nc-label">{t('calendar.repeats')}</label>
              <select
                value={eventRepetition}
                onChange={(e) => setEventRepetition(e.target.value)}
                className="nc-select"
              >
                <option value="none">{t('calendar.doesNotRepeat')}</option>
                <option value="monthly">{t('calendar.monthly')}</option>
                <option value="yearly">{t('calendar.yearly')}</option>
              </select>
            </div>

            {eventValidation && <div className="nc-validation">{eventValidation}</div>}
            {!user && !authLoading && <div className="nc-validation">Please log in to add events</div>}

            <div className="nc-modal-actions">
              <button
                type="button"
                className="app-cancel-btn"
                onClick={() => {
                  onClose();
                  setEventValidation('');
                }}
                style={{ flex: '1 1 auto' }}
              >
                {t('calendar.cancel')}
              </button>
              <button
                onClick={submitAddEvent}
                className="app-save-btn"
                disabled={
                  isAddingEvent ||
                  !user ||
                  authLoading ||
                  !eventTitle ||
                  (eventAssociateMode === 'date' && !eventDate) ||
                  (eventAssociateMode === 'tithi' && !selectedEventTithiId) ||
                  (eventType === 'customer' && !selectedTreeMemberId)
                }
                style={{ flex: '1 1 auto' }}
              >
                {isAddingEvent ? 'Adding...' : !user ? 'Log in to Add' : t('calendar.addEventButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
