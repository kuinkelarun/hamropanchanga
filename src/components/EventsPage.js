import React, { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithGoogle } from '../firebase';
import { formatNepaliDate, formatEnglishDate, convertAdToBs, convertBsToAd, getNepalDate } from '../utils/nepaliDateUtils';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS, normalizePakshaToNepali } from '../constants/calendarConstants';
import { useEventDisplay, isValidDate } from '../hooks/useEventDisplay';
import './EventsPage.css';

function getNptMidnight() {
    const npt = getNepalDate();
    return new Date(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
}

const todayMidnight = getNptMidnight();

const twoDaysAgo = new Date(todayMidnight);
twoDaysAgo.setDate(todayMidnight.getDate() - 2);

const tomorrow = new Date(todayMidnight);
tomorrow.setDate(todayMidnight.getDate() + 1);

function toDateKey(d) {
    if (!isValidDate(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRepLabel(rep) {
    if (!rep || rep === 'none') return '';
    return rep === 'yearly' ? 'वार्षिक' : 'मासिक';
}

function getTithiDisplay(event) {
    if (!event.tithi) return '';
    const { month, paksha, name } = event.tithi;
    if (!month || !name) return '';
    return `${month} ${normalizePakshaToNepali(paksha)} ${name}`;
}

function getCurrentBsYear() {
    const bs = convertAdToBs(todayMidnight.getFullYear(), todayMidnight.getMonth(), todayMidnight.getDate());
    return bs ? bs.year : 2083;
}

// For a yearly event, compute the AD display date within a specific BS year.
// Returns a Date or null.
function getYearlyDateInBsYear(ev, bsYear) {
    // Try via BS date of the original dateKey
    const dateStr = ev.dateKey || ev.date;
    if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const bsOrig = convertAdToBs(y, m - 1, d);
        if (bsOrig) {
            const adObj = convertBsToAd(bsYear, bsOrig.month, bsOrig.day);
            if (adObj) return new Date(adObj.year, adObj.month, adObj.day, 12, 0, 0);
        }
    }
    // Fallback: shift the originalDate by year difference
    if (isValidDate(ev.originalDate)) {
        const bsOrig = convertAdToBs(ev.originalDate.getFullYear(), ev.originalDate.getMonth(), ev.originalDate.getDate());
        if (bsOrig) {
            const adObj = convertBsToAd(bsYear, bsOrig.month, bsOrig.day);
            if (adObj) return new Date(adObj.year, adObj.month, adObj.day, 12, 0, 0);
        }
    }
    return null;
}

export default function EventsPage({ user, events, familyMembers }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = searchParams.get('filter') || 'upcoming';
    const currentBsYear = getCurrentBsYear();
    const yearParam = searchParams.get('year');
    const selectedYear = yearParam ? parseInt(yearParam) : currentBsYear;

    const setFilter = (val) => setSearchParams(prev => { prev.set('filter', val); return prev; }, { replace: true });
    const setYear = (val) => setSearchParams(prev => { prev.set('year', String(val)); return prev; }, { replace: true });

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const mapEvent = useEventDisplay(events || [], familyMembers || []);

    const mapped = useMemo(() => {
        if (!events) return [];
        return events.map(mapEvent);
    }, [events, mapEvent]);

    const filtered = useMemo(() => {
        const result = [];
        mapped.forEach(ev => {
            if (filter === 'past') {
                if (isValidDate(ev.originalDate) && ev.originalDate < todayMidnight) result.push(ev);
                return;
            }
            if (filter === 'upcoming') {
                if (isValidDate(ev.displayDate) && ev.displayDate >= twoDaysAgo) result.push(ev);
                return;
            }
            if (filter === 'all') {
                // For yearly events, compute the actual date within the selected BS year
                if (ev.repetition === 'yearly') {
                    const dateInYear = getYearlyDateInBsYear(ev, selectedYear);
                    if (dateInYear && isValidDate(dateInYear)) {
                        result.push({ ...ev, displayDate: dateInYear });
                    }
                    return;
                }
                // For non-repeating / monthly: check if the event falls in the selected BS year
                const d = isValidDate(ev.displayDate) ? ev.displayDate : (isValidDate(ev.originalDate) ? ev.originalDate : null);
                if (!d) return;
                const bs = convertAdToBs(d.getFullYear(), d.getMonth(), d.getDate());
                if (bs && bs.year === selectedYear) result.push(ev);
                return;
            }
        });

        return result.sort((a, b) => {
            const ta = isValidDate(a.displayDate) ? a.displayDate.getTime() : Infinity;
            const tb = isValidDate(b.displayDate) ? b.displayDate.getTime() : Infinity;
            if (filter === 'past') return tb - ta;
            return ta - tb;
        });
    }, [mapped, filter, selectedYear]);

    // Group by BS month → by AD day
    const grouped = useMemo(() => {
        const monthMap = new Map();
        filtered.forEach(ev => {
            const d = isValidDate(ev.displayDate) ? ev.displayDate : null;
            let monthKey = 'unknown';
            let monthLabel = { nepali: 'मिति अनिश्चित', english: 'Unknown' };
            if (d) {
                const bs = convertAdToBs(d.getFullYear(), d.getMonth(), d.getDate());
                if (bs) {
                    monthKey = `${bs.year}-${String(bs.month).padStart(2, '0')}`;
                    monthLabel = {
                        nepali: `${NEPALI_MONTHS[bs.month - 1]} ${bs.year}`,
                        english: `${ENGLISH_NEPALI_MONTHS[bs.month - 1]} ${bs.year}`,
                    };
                }
            }
            if (!monthMap.has(monthKey)) monthMap.set(monthKey, { label: monthLabel, days: new Map() });
            const dayKey = d ? toDateKey(d) : 'unknown';
            const monthEntry = monthMap.get(monthKey);
            if (!monthEntry.days.has(dayKey)) monthEntry.days.set(dayKey, { date: d, events: [] });
            monthEntry.days.get(dayKey).events.push(ev);
        });
        return Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => ({
                ...v,
                days: Array.from(v.days.values()).sort((a, b) => {
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return a.date - b.date;
                }),
            }));
    }, [filtered]);

    // Year options: currentBsYear ± 3
    const yearOptions = [];
    for (let y = currentBsYear - 3; y <= currentBsYear + 3; y++) yearOptions.push(y);

    if (!user) {
        return (
            <div className="ep-root">
                <div className="ep-signin-prompt">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem', display: 'block' }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <p>Sign in to view your Events &amp; Reminders.</p>
                    <button className="ep-signin-btn" onClick={async () => { try { await signInWithGoogle(); } catch (_) {} }}>
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ep-root">
            <div className="ep-header">
                <div className="ep-header-inner">
                    <div className="ep-header-text">
                        <h1>Events &amp; Reminders</h1>
                        <p>Your family events, organised by Nepali month</p>
                    </div>
                    <div className="ep-header-controls">
                        <select className="ep-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                            <option value="upcoming">Upcoming</option>
                            <option value="all">All Events</option>
                            <option value="past">Past Events</option>
                        </select>
                        {filter === 'all' && (
                            <select className="ep-filter-select" value={selectedYear} onChange={e => setYear(e.target.value)}>
                                {yearOptions.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            <div className="ep-body">
                {filtered.length === 0 ? (
                    <div className="ep-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem', display: 'block' }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        <p>No events found.</p>
                    </div>
                ) : (
                    grouped.map((month, mi) => (
                        <div key={mi} className="ep-month-section">
                            <div className="ep-month-header">
                                <span className="ep-month-name">{month.label.nepali}</span>
                                <span className="ep-month-name-en">({month.label.english})</span>
                                <span className="ep-month-count">
                                    {month.days.reduce((s, d) => s + d.events.length, 0)} event{month.days.reduce((s, d) => s + d.events.length, 0) !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {month.days.map((dayGroup, di) => {
                                const d = dayGroup.date;
                                const dk = d ? toDateKey(d) : '';
                                const isToday = dk === toDateKey(todayMidnight);
                                const isTomorrow = dk === toDateKey(tomorrow);
                                return (
                                    <div key={di} className="ep-day-group">
                                        {d && (
                                            <div className="ep-day-header">
                                                <span className="ep-day-nepali">{formatNepaliDate(d).withDayShortNepali}</span>
                                                <span className="ep-day-english">· {formatEnglishDate(d).short}</span>
                                                {isToday && <span className="ep-day-badge today">Today</span>}
                                                {isTomorrow && <span className="ep-day-badge tomorrow">Tomorrow</span>}
                                            </div>
                                        )}
                                        {dayGroup.events.map((ev, ei) => (
                                            <div key={ei} className="ep-event-row">
                                                <div className="ep-event-dot" />
                                                <div className="ep-event-main">
                                                    <div className="ep-event-title">
                                                        {ev.name}
                                                        {ev.personName && <span className="ep-event-person-inline">({ev.personName})</span>}
                                                    </div>
                                                    {d && (
                                                        <div className="ep-event-line2">
                                                            {formatNepaliDate(d).withDayShortNepali}
                                                            <span className="ep-event-date-en"> ({formatEnglishDate(d).short})</span>
                                                        </div>
                                                    )}
                                                    {getTithiDisplay(ev) && (
                                                        <div className="ep-event-line2">{getTithiDisplay(ev)}</div>
                                                    )}
                                                    {(ev.host || ev.hostLocation) && (
                                                        <div className="ep-event-line2">
                                                            {[ev.host, ev.hostLocation].filter(Boolean).join(' | ')}
                                                        </div>
                                                    )}
                                                    {getRepLabel(ev.repetition) && (
                                                        <span className="ep-event-rep">{getRepLabel(ev.repetition)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
