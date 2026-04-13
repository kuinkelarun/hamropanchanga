import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import NepaliDatePicker from './NepaliDatePicker';
import { useLanguage } from '../contexts/LanguageContext';
import { nepaliMonths, getTithisForMonth, convertAdToBs, getTithiIndexByName, getTithiLunarMonthName, getTithiYearFromAdDate } from '../utils/nepaliDateUtils';
import { normalizePakshaToEnglish, normalizePakshaToNepali } from '../constants/calendarConstants';
import './NepaliCalendar.css';

const AddEventForm = ({ onAdd, familyMembers, onCancel, editingEvent }) => {
    const { t, isNepali } = useLanguage();
    const getTodayDate = () => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(getTodayDate());
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [repetition, setRepetition] = useState('none');
    const [entryMode, setEntryMode] = useState('date');
    const [tithiMonth, setTithiMonth] = useState('');
    const [tithiId, setTithiId] = useState('');
    const [resolvingTithi, setResolvingTithi] = useState(false);

    useEffect(() => {
        if (editingEvent) {
            console.log('[AddEventForm] Editing event:', editingEvent);
            setName(editingEvent.title || '');
            setDescription(editingEvent.description || '');
            setDate(editingEvent.dateKey || getTodayDate());
            setSelectedPersonId(editingEvent.memberId || '');
            setRepetition(editingEvent.repetition || 'none');
            if (editingEvent.tithi) {
                console.log('[AddEventForm] Event has tithi:', editingEvent.tithi);
                setEntryMode('tithi');
                let monthVal = editingEvent.tithi.month;
                if (typeof monthVal === 'string') {
                    const idx = nepaliMonths.indexOf(monthVal);
                    if (idx !== -1) monthVal = idx + 1;
                }
                const monthString = String(monthVal);
                console.log('[AddEventForm] Setting tithiMonth:', monthString, 'tithiId:', editingEvent.tithi.id);
                setTithiMonth(monthString);
                sessionStorage.setItem('pendingTithiId', editingEvent.tithi.id || '');
            } else {
                setEntryMode('date');
                setTithiMonth('');
                setTithiId('');
                sessionStorage.removeItem('pendingTithiId');
            }
        }
    }, [editingEvent, nepaliMonths]);

    useEffect(() => {
        const pendingId = sessionStorage.getItem('pendingTithiId');
        if (pendingId && tithiMonth) {
            setTithiId(pendingId);
            sessionStorage.removeItem('pendingTithiId');
        }
    }, [tithiMonth]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !selectedPersonId) return;

        let finalDate = date;
        let tithiInfo = null;

        if (entryMode === 'tithi') {
            if (!tithiMonth || !tithiId) return;

            setResolvingTithi(true);
            try {
                const [pakshaKey, tithiName] = tithiId.split('-');
                const paksha = normalizePakshaToEnglish(pakshaKey);
                const pakshaNepali = normalizePakshaToNepali(pakshaKey);

                const today = new Date();
                const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
                const currentBsYear = bsToday.year;
                const selectedMonthName = nepaliMonths[parseInt(tithiMonth) - 1];

                const qNew = query(collection(db, COLLECTIONS.TITHIS), where('pakshya', '==', pakshaNepali), where('tithiName', '==', tithiName));
                const old2PartName = `${pakshaNepali} ${tithiName}`;
                const qOld = query(collection(db, COLLECTIONS.TITHIS), where('name', '>=', old2PartName), where('name', '<=', old2PartName + '\uf8ff'));
                const [snapNew, snapOld] = await Promise.all([getDocs(qNew), getDocs(qOld)]);

                const allDocs = new Map();
                snapNew.docs.forEach(d => allDocs.set(d.id, d));
                snapOld.docs.forEach(d => { if (!allDocs.has(d.id)) allDocs.set(d.id, d); });

                let matchingTithi = null;
                let actualTithiLunarMonth = null;
                allDocs.forEach((docSnap) => {
                    const t = docSnap.data();
                    if (!t.name.includes(tithiName) || !t.name.includes(pakshaNepali)) return;
                    const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
                    if (!tithiIndex) return;
                    const lunarMonthName = getTithiLunarMonthName(paksha, tithiIndex, t.startDate);
                    const tithiYearInfo = getTithiYearFromAdDate(t.startDate, null, paksha, tithiIndex);
                    if (lunarMonthName === selectedMonthName && tithiYearInfo.tithiYear === currentBsYear) {
                        matchingTithi = t;
                        actualTithiLunarMonth = lunarMonthName;
                    }
                });

                if (matchingTithi && actualTithiLunarMonth) {
                    finalDate = matchingTithi.startDate;
                    tithiInfo = {
                        month: actualTithiLunarMonth,
                        id: tithiId,
                        name: tithiName,
                        paksha: paksha,
                    };
                } else {
                    alert(`Could not find date for ${selectedMonthName} ${pakshaNepali} ${tithiName} in year ${currentBsYear}. Please ensure Tithis are generated.`);
                    setResolvingTithi(false);
                    return;
                }
            } catch (err) {
                console.error('Error resolving tithi:', err);
                alert('Error resolving tithi date');
                setResolvingTithi(false);
                return;
            }
            setResolvingTithi(false);
        } else {
            if (!date) return;
        }

        onAdd({
            name,
            description: description.trim(),
            date: finalDate,
            personId: selectedPersonId,
            repetition,
            tithi: tithiInfo,
        });

        setName('');
        setDescription('');
        setDate(getTodayDate());
        setSelectedPersonId('');
        setRepetition('none');
        setEntryMode('date');
        setTithiMonth('');
        setTithiId('');
    };

    const submitDisabled = resolvingTithi
        || !name.trim()
        || !selectedPersonId
        || (entryMode === 'date' && !date)
        || (entryMode === 'tithi' && (!tithiMonth || !tithiId));

    return (
        <div className="ddm-form-container">
            {/* Header */}
            <div className="ddm-form-header">
                <div className="ddm-form-header-content">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                        <path d="M12 14v4M10 16h4" />
                    </svg>
                    <h4 className="ddm-form-header-title">
                        {editingEvent ? t('addEventForm.editEvent') : t('addEventForm.addNewEvent')}
                    </h4>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="ddm-form-body">
                    {/* Associated Person */}
                    <div className="ddm-form-group">
                        <label className="ddm-label">{t('addEventForm.associatedPerson')}</label>
                        <select
                            value={selectedPersonId}
                            onChange={(e) => setSelectedPersonId(e.target.value)}
                            className="ddm-select"
                            required
                        >
                            <option value="" disabled>{t('addEventForm.selectPerson')}</option>
                            {familyMembers.map(member => {
                                const suffix = member.nickname ? ` (${member.nickname})` : '';
                                return (
                                    <option key={member.id} value={member.id}>
                                        {member.name}{suffix}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Event Name */}
                    <div className="ddm-form-group">
                        <label className="ddm-label">{t('addEventForm.eventName')}</label>
                        <input
                            type="text"
                            placeholder={t('addEventForm.eventNamePlaceholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="ddm-input"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="ddm-form-group">
                        <label className="ddm-label">{t('addEventForm.description')}</label>
                        <textarea
                            placeholder={t('addEventForm.descriptionPlaceholder')}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="ddm-input"
                            rows={2}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Entry Mode */}
                    <div className="ddm-form-group">
                        <label className="ddm-label">{t('addEventForm.entryMode')}</label>
                        <div className="ddm-tabs ddm-tabs-sm" role="tablist">
                            <button
                                type="button"
                                className={`ddm-tab ${entryMode === 'date' ? 'ddm-tab-active' : ''}`}
                                onClick={() => setEntryMode('date')}
                                role="tab"
                            >
                                {t('addEventForm.byDate')}
                            </button>
                            <button
                                type="button"
                                className={`ddm-tab ${entryMode === 'tithi' ? 'ddm-tab-active' : ''}`}
                                onClick={() => setEntryMode('tithi')}
                                role="tab"
                            >
                                {t('addEventForm.byTithi')}
                            </button>
                        </div>
                    </div>

                    {entryMode === 'date' ? (
                        <div className="ddm-form-group">
                            <NepaliDatePicker
                                value={date}
                                onChange={(adDate) => setDate(adDate)}
                                label={t('addEventForm.dateNepaliCalendar')}
                                required
                            />
                        </div>
                    ) : (
                        <div className="ddm-form-row-2col">
                            <div className="ddm-form-group">
                                <label className="ddm-label">{t('addEventForm.tithiMonthLunar')}</label>
                                <select
                                    value={tithiMonth}
                                    onChange={(e) => setTithiMonth(e.target.value)}
                                    className="ddm-select"
                                    required
                                >
                                    <option value="">{t('addEventForm.selectTithiMonth')}</option>
                                    {nepaliMonths.map((month, idx) => (
                                        <option key={idx} value={String(idx + 1)}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ddm-form-group">
                                <label className="ddm-label">{t('addEventForm.tithi')}</label>
                                <select
                                    value={tithiId}
                                    onChange={(e) => setTithiId(e.target.value)}
                                    className="ddm-select"
                                    disabled={!tithiMonth}
                                    required
                                >
                                    <option value="">{t('addEventForm.selectTithi')}</option>
                                    {tithiMonth && getTithisForMonth(parseInt(tithiMonth)).map(tithi => (
                                        <option key={tithi.tithiId} value={tithi.tithiId}>
                                            {tithi.name} ({tithi.pakshya})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Repetition */}
                    <div className="ddm-form-group">
                        <label className="ddm-label">{t('addEventForm.repeats')}</label>
                        <select
                            value={repetition}
                            onChange={(e) => setRepetition(e.target.value)}
                            className="ddm-select"
                        >
                            <option value="none">{t('addEventForm.doesNotRepeat')}</option>
                            <option value="monthly">{t('addEventForm.monthly')}</option>
                            <option value="yearly">{t('addEventForm.yearly')}</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="ddm-form-footer">
                    <button type="button" className="ddm-btn ddm-btn-ghost" onClick={onCancel}>
                        {t('addEventForm.cancel')}
                    </button>
                    <button type="submit" className="ddm-btn ddm-btn-primary" disabled={submitDisabled}>
                        {resolvingTithi
                            ? t('addEventForm.resolving')
                            : (editingEvent ? t('addEventForm.updateEvent') : t('addEventForm.addEvent'))}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddEventForm;
