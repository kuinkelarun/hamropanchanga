import { useState, useEffect } from 'react';
import NepaliDatePicker from './NepaliDatePicker';
import { useLanguage } from '../contexts/LanguageContext';
import { nepaliMonths, getTithisForMonth } from '../utils/nepaliDateUtils';
import { normalizePakshaToEnglish } from '../constants/calendarConstants';
import { resolveTithiForCurrentYear } from '../utils/resolveTithiForCurrentYear';
import './NepaliCalendar.css';

const AddEventForm = ({ onAdd, familyMembers, onCancel, editingEvent }) => {
    const { t } = useLanguage();
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

                const rawId = editingEvent.tithi.id || '';
                const rawParts = rawId.split('-');
                const knownPakshas = ['shukla', 'krishna'];
                const rawIsComposite = rawParts.length >= 2 && knownPakshas.includes(rawParts[0]?.toLowerCase());
                let dropdownTithiId = rawId;
                if (!rawIsComposite && editingEvent.tithi.paksha && editingEvent.tithi.name) {
                    const pakshaLower = String(editingEvent.tithi.paksha).toLowerCase();
                    const pakshaKey = knownPakshas.includes(pakshaLower) ? pakshaLower : pakshaLower;
                    dropdownTithiId = `${pakshaKey}-${editingEvent.tithi.name}`;
                }

                console.log('[AddEventForm] Setting tithiMonth:', monthString, 'tithiId:', dropdownTithiId);
                setTithiMonth(monthString);
                sessionStorage.setItem('pendingTithiId', dropdownTithiId);
            } else {
                setEntryMode('date');
                setTithiMonth('');
                setTithiId('');
                sessionStorage.removeItem('pendingTithiId');
            }
        }
    }, [editingEvent]);

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
                const idParts = tithiId.split('-');
                const knownPakshas = ['shukla', 'krishna'];
                const looksComposite = idParts.length >= 2 && knownPakshas.includes(idParts[0]?.toLowerCase());

                let pakshaEn;
                let tithiName;
                if (looksComposite) {
                    pakshaEn = normalizePakshaToEnglish(idParts[0]);
                    tithiName = idParts.slice(1).join('-');
                } else {
                    pakshaEn = normalizePakshaToEnglish(editingEvent?.tithi?.paksha || '');
                    tithiName = editingEvent?.tithi?.name || '';
                }

                if (!pakshaEn || !tithiName) {
                    throw new Error('Could not determine tithi paksha or name from selection.');
                }

                const selectedMonthName = nepaliMonths[parseInt(tithiMonth) - 1];

                const result = await resolveTithiForCurrentYear({
                    pakshaEn,
                    tithiName,
                    lunarMonthName: selectedMonthName,
                    tithiId,
                });
                finalDate = result.date;
                tithiInfo = result.tithiPayload;
            } catch (err) {
                console.error('Error resolving tithi:', err);
                alert(err.message || 'Error resolving tithi date');
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
