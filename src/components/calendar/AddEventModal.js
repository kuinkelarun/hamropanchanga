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
import { COLLECTIONS } from '../../constants/firestoreCollections';
import { useLanguage } from '../../contexts/LanguageContext';
import NepaliDatePicker from '../NepaliDatePicker';
import {
  NEPALI_MONTHS as nepaliMonths,
  ENGLISH_NEPALI_MONTHS as englishNepaliMonths,
  normalizePakshaToEnglish,
} from '../../constants/calendarConstants';
import {
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
import { resolveTithiForCurrentYear } from '../../utils/resolveTithiForCurrentYear';

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
  const { t, tn, isNepali } = useLanguage();
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
  const [availableTrees, setAvailableTrees] = useState([]);
  const [availableTreeMembers, setAvailableTreeMembers] = useState([]);

  // ── Reset form when modal opens / closes ────────────────────
  useEffect(() => {
    if (isOpen && activeDate) {
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
    if (!user) { setAvailableTrees([]); return; }
    const treesCol = collection(db, COLLECTIONS.TREES);
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
    if (!isOpen || eventType !== 'customer') { setAvailableTreeMembers([]); return; }
    if (!selectedTreeId) { setAvailableTreeMembers([]); return; }
    const membersCol = collection(db, COLLECTIONS.TREES, selectedTreeId, COLLECTIONS.MEMBERS);
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
    if (!eventDate) { setSelectedEventTithiId(''); return; }
    const [y, m, d] = eventDate.split('-').map(Number);
    const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];
    if (tithisForEventDate.length === 0) { setSelectedEventTithiId(''); return; }
    if (!selectedEventTithiId || !tithisForEventDate.some((t) => t.id === selectedEventTithiId)) {
      setSelectedEventTithiId(tithisForEventDate[0].id);
    }
  }, [eventAssociateMode, eventDate, findTithisForAdDate, selectedEventTithiId]);

  // ── Tithi display name (local helper) ───────────────────────
  const getTithiDisplayName = (tithi) => {
    const { tithiMonth: parsedMonth, pakshya, tithi: tithiName } = parseTithiName(tithi.name);
    if (!tithi.startDate) return tithi.name;
    let lunarMonth = tithi.tithiMonth || parsedMonth || '';
    if (!lunarMonth) {
      const pakshaNormalized = normalizePakshaToEnglish(pakshya);
      const tithiIndex = getTithiIndexByName(tithiName);
      if (tithiIndex) {
        lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
      }
    }
    if (lunarMonth) {
      const monthIndex = nepaliMonths.indexOf(lunarMonth);
      const monthDisplay =
        monthIndex !== -1 ? (isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex]) : lunarMonth;
      const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
      const tithiDisplay = isNepali ? tithiName : getEnglishTithiName(tithiName);
      return `${monthDisplay} ${pakshyaDisplay} ${tithiDisplay}`;
    }
    return tithi.name;
  };

  // ── Submit handler ──────────────────────────────────────────
  async function submitAddEvent() {
    if (!user) { setEventValidation('Please log in to add events.'); return; }
    if (!eventTitle.trim()) { setEventValidation('Please enter an event title.'); return; }
    if (!eventDate) { setEventValidation('Please select a date.'); return; }

    // Sync pre-validate the tithi selection (DB call happens inside the try/finally below)
    let tithiSelection = null;
    if (eventAssociateMode === 'tithi') {
      const [y, m, d] = eventDate.split('-').map(Number);
      const tithisForEventDate = findTithisForAdDate(y, m - 1, d) || [];
      if (tithisForEventDate.length === 0) { setEventValidation('No tithi is available for the selected date.'); return; }
      const selectedTithi = tithisForEventDate.find((t) => t.id === selectedEventTithiId) || tithisForEventDate[0];
      if (!selectedTithi) { setEventValidation('Please select a tithi.'); return; }
      const { pakshya, tithi: tithiName } = parseTithiName(selectedTithi.name);
      const pakshaEn = normalizePakshaToEnglish(pakshya);
      const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
      if (!tithiIndex) { setEventValidation('Could not determine the selected tithi. Please try selecting the tithi again.'); return; }
      const lunarMonthName = getTithiLunarMonthName(pakshaEn, tithiIndex, eventDate);
      tithiSelection = { tithiId: selectedTithi.id, tithiName, pakshaEn, lunarMonthName };
    }

    if (eventType === 'customer') {
      if (!selectedTreeId) { setEventValidation('Please select a tree.'); return; }
      if (!selectedTreeMemberId) { setEventValidation('Please select a family member.'); return; }
    }

    setIsAddingEvent(true);
    setEventValidation('');

    try {
      let finalDate = eventDate;
      let tithiPayload = null;

      if (tithiSelection) {
        // Re-resolve to the current BS year so non-repeating tithi events are
        // stored against this year, not whatever past year the clicked tile sat in.
        const result = await resolveTithiForCurrentYear(tithiSelection);
        finalDate = result.date;
        tithiPayload = result.tithiPayload;
      }

      const isPublic = eventType === 'public';
      const createdByAdmin = isAdmin || isSuperUser;
      await createEvent({
        name: eventTitle,
        description: eventDescription,
        date: finalDate,
        personId: eventType === 'customer' ? selectedTreeMemberId : null,
        repetition: eventRepetition,
        tithi: tithiPayload,
        userId: user.uid,
        treeId: eventType === 'customer' ? selectedTreeId : null,
        isPublic,
        isAdmin: createdByAdmin,
      });
      if (isDev) console.log(`${isPublic ? 'Public' : eventType === 'customer' ? 'Family member' : 'Private'} event added`);
      onClose();
    } catch (error) {
      console.error('Error adding event:', error);
      setEventValidation(error.message || 'Error adding event');
    } finally {
      setIsAddingEvent(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────
  if (!isOpen) return null;

  // Parse date for header
  const [adYear, adMonth1, adDay] = activeDate ? activeDate.split('-').map(Number) : [0, 0, 0];
  const bs = activeDate ? convertAdToBs(adYear, adMonth1 - 1, adDay) : null;
  const headerDateNepali = bs
    ? (isNepali
        ? `${tn(bs.day)} ${nepaliMonths[bs.month - 1]} ${tn(bs.year)}`
        : `${bs.day} ${englishNepaliMonths[bs.month - 1]} ${bs.year}`)
    : '';

  // Event type tab config
  const eventTypeTabs = [
    { key: 'private', label: t('calendar.forSelf'), icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )},
    { key: 'customer', label: t('calendar.forFamilyMember'), icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
    )},
  ];
  if (isAdmin || isSuperUser) {
    eventTypeTabs.push({ key: 'public', label: t('calendar.public'), icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
    )});
  }

  return (
    <div className="nc-modal-backdrop" onClick={onClose}>
      <div className="nc-modal ddm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="ddm-header">
          <div className="ddm-header-date">
            <span className="ddm-header-nepali" style={{ fontSize: '1.1rem' }}>
              {isNepali ? 'कार्यक्रम थप्नुहोस्' : 'Add Event'}
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
          {/* Event Type Tabs */}
          <div className="ddm-form-group">
            <label className="ddm-label">{t('calendar.addEvent')}</label>
            <div className="ddm-tabs" role="tablist">
              {eventTypeTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`ddm-tab ${eventType === tab.key ? 'ddm-tab-active' : ''}`}
                  onClick={() => {
                    setEventType(tab.key);
                    if (tab.key !== 'customer') { setSelectedTreeId(''); setSelectedTreeMemberId(''); }
                  }}
                  role="tab"
                  aria-selected={eventType === tab.key}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tree + Member Selection */}
          {eventType === 'customer' && (
            <div className="ddm-form-row-2col">
              <div className="ddm-form-group">
                <label className="ddm-label">{t('calendar.selectTree')}</label>
                <select
                  value={selectedTreeId}
                  onChange={(e) => { setSelectedTreeId(e.target.value); setSelectedTreeMemberId(''); }}
                  className="ddm-select"
                >
                  <option value="">{t('calendar.selectTreePlaceholder')}</option>
                  {availableTrees.map((tree) => (
                    <option key={tree.id} value={tree.id}>{tree.title || 'Untitled Tree'}</option>
                  ))}
                </select>
              </div>
              <div className="ddm-form-group">
                <label className="ddm-label">{t('calendar.selectMember')}</label>
                <select
                  value={selectedTreeMemberId}
                  onChange={(e) => setSelectedTreeMemberId(e.target.value)}
                  className="ddm-select"
                  disabled={!selectedTreeId}
                >
                  <option value="">{t('calendar.selectMemberPlaceholder')}</option>
                  {availableTreeMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || 'Unknown'}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Event Title */}
          <div className="ddm-form-group">
            <label className="ddm-label">{t('calendar.eventTitle')}</label>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder={t('calendar.eventTitlePlaceholder')}
              className="ddm-input"
            />
          </div>

          {/* Description */}
          <div className="ddm-form-group">
            <label className="ddm-label">{t('calendar.description')}</label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder={t('calendar.descriptionPlaceholder')}
              className="ddm-input"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Associate Mode: Date or Tithi */}
          <div className="ddm-form-group">
            <label className="ddm-label">{t('calendar.associateWith')}</label>
            <div className="ddm-tabs ddm-tabs-sm" role="tablist">
              <button
                type="button"
                className={`ddm-tab ${eventAssociateMode === 'date' ? 'ddm-tab-active' : ''}`}
                onClick={() => setEventAssociateMode('date')}
                role="tab"
              >
                {t('calendar.date')}
              </button>
              <button
                type="button"
                className={`ddm-tab ${eventAssociateMode === 'tithi' ? 'ddm-tab-active' : ''}`}
                onClick={() => setEventAssociateMode('tithi')}
                role="tab"
              >
                {t('calendar.tithi')}
              </button>
            </div>
          </div>

          {/* Tithi picker */}
          {eventAssociateMode === 'tithi' && (
            <div className="ddm-form-group">
              <label className="ddm-label">{t('calendar.selectTithi')}</label>
              {(() => {
                if (!eventDate) return <div className="ddm-empty" style={{ padding: '8px 0' }}>No day selected.</div>;
                const [y, m, d] = eventDate.split('-').map(Number);
                const tithisForEventDate = (findTithisForAdDate(y, m - 1, d) || []).slice().sort(compareTithisByStart);
                if (tithisForEventDate.length === 0) return <div className="ddm-empty" style={{ padding: '8px 0' }}>No tithi found for the selected date.</div>;
                return (
                  <select
                    value={selectedEventTithiId}
                    onChange={(e) => setSelectedEventTithiId(e.target.value)}
                    className="ddm-select"
                  >
                    {tithisForEventDate.map((ti) => (
                      <option key={ti.id} value={ti.id}>{getTithiDisplayName(ti)}</option>
                    ))}
                  </select>
                );
              })()}
            </div>
          )}

          {/* Date picker */}
          {eventAssociateMode === 'date' && (
            <div className="ddm-form-group">
              <NepaliDatePicker value={eventDate} onChange={setEventDate} label={t('calendar.eventDate')} required />
            </div>
          )}

          {/* Repetition */}
          <div className="ddm-form-group">
            <label className="ddm-label">{t('calendar.repeats')}</label>
            <select value={eventRepetition} onChange={(e) => setEventRepetition(e.target.value)} className="ddm-select">
              <option value="none">{t('calendar.doesNotRepeat')}</option>
              <option value="monthly">{t('calendar.monthly')}</option>
              <option value="yearly">{t('calendar.yearly')}</option>
            </select>
          </div>

          {/* Validation */}
          {eventValidation && <div className="ddm-validation">{eventValidation}</div>}
          {!user && !authLoading && <div className="ddm-validation">{isNepali ? 'कार्यक्रम थप्न साइन इन गर्नुहोस्' : 'Please log in to add events'}</div>}
        </div>

        {/* Footer */}
        <div className="ddm-footer">
          <button type="button" className="ddm-btn ddm-btn-ghost" onClick={() => { onClose(); setEventValidation(''); }}>
            {t('calendar.cancel')}
          </button>
          <button
            onClick={submitAddEvent}
            className="ddm-btn ddm-btn-primary"
            disabled={
              isAddingEvent || !user || authLoading || !eventTitle ||
              (eventAssociateMode === 'date' && !eventDate) ||
              (eventAssociateMode === 'tithi' && !selectedEventTithiId) ||
              (eventType === 'customer' && !selectedTreeMemberId)
            }
          >
            {isAddingEvent
              ? (isNepali ? 'थप्दै...' : 'Adding...')
              : !user
                ? (isNepali ? 'साइन इन गर्नुहोस्' : 'Log in to Add')
                : t('calendar.addEventButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
