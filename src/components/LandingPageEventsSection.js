import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPageEventsSection.css';
import { useLanguage } from '../contexts/LanguageContext';
import { formatNepaliDate, formatEnglishDate, formatNepaliMonthYear, getNepalDate } from '../utils/nepaliDateUtils';
import { normalizePakshaToNepali } from '../constants/calendarConstants';
import { useEventDisplay, isValidDate } from '../hooks/useEventDisplay';

// Filters that navigate to /events (broad views better on a full page)
const NAVIGATE_FILTERS = ['upcoming', 'all', 'past'];

const LandingPageEventsSection = ({ events, familyMembers, onDoubleClickEvent, onEventClick }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [eventFilter, setEventFilter] = useState('next-week');

    const mapEvent = useEventDisplay(events || [], familyMembers || []);

    const handleFilterChange = (e) => {
        const val = e.target.value;
        if (NAVIGATE_FILTERS.includes(val)) {
            navigate(`/events?filter=${val}`);
        } else {
            setEventFilter(val);
        }
    };

    const npt = getNepalDate();
    const today = new Date(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
    const nextWeek  = new Date(today); nextWeek.setDate(today.getDate() + 7);
    const nextMonth = new Date(today); nextMonth.setMonth(today.getMonth() + 1);
    const next90    = new Date(today); next90.setDate(today.getDate() + 90);

    const mapped = useMemo(() => (events || []).map(mapEvent), [events, mapEvent]);

    const sortedAndFiltered = useMemo(() => {
        return mapped.filter(event => {
            switch (eventFilter) {
                case 'next-week':   return isValidDate(event.displayDate) && event.displayDate >= today && event.displayDate <= nextWeek;
                case 'next-month':  return isValidDate(event.displayDate) && event.displayDate >= today && event.displayDate <= nextMonth;
                case 'next-90-days':return isValidDate(event.displayDate) && event.displayDate >= today && event.displayDate <= next90;
                default:            return true;
            }
        }).sort((a, b) => {
            const ta = isValidDate(a.displayDate) ? a.displayDate.getTime() : Infinity;
            const tb = isValidDate(b.displayDate) ? b.displayDate.getTime() : Infinity;
            return ta - tb;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapped, eventFilter]);

    // For next-week and next-month: group by exact AD day
    const dayGrouped = useMemo(() => {
        if (!['next-week', 'next-month'].includes(eventFilter)) return null;
        const map = new Map();
        sortedAndFiltered.forEach(ev => {
            const key = isValidDate(ev.displayDate)
                ? `${ev.displayDate.getFullYear()}-${String(ev.displayDate.getMonth()+1).padStart(2,'0')}-${String(ev.displayDate.getDate()).padStart(2,'0')}`
                : 'unknown';
            if (!map.has(key)) map.set(key, { date: ev.displayDate, events: [] });
            map.get(key).events.push(ev);
        });
        return Array.from(map.values());
    }, [sortedAndFiltered, eventFilter]);

    // For next-90-days: group by Nepali month
    const monthGrouped = useMemo(() => {
        if (eventFilter !== 'next-90-days') return null;
        const map = {};
        sortedAndFiltered.forEach(ev => {
            const key = isValidDate(ev.displayDate)
                ? formatNepaliMonthYear(ev.displayDate).nepali
                : 'मिति अनिश्चित';
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });
        return map;
    }, [sortedAndFiltered, eventFilter]);

    const needsScroll = ['next-month', 'next-90-days'].includes(eventFilter);

    const renderEventCard = (event, index) => (
        <div
            key={index}
            className="event-card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onEventClick && onEventClick(event)}
            onDoubleClick={() => onDoubleClickEvent && onDoubleClickEvent(event)}
        >
            <div className="event-name">
                {event.name}
                {event.personName && (
                    <span style={{ color: '#667eea', marginLeft: '0.2rem' }}>({event.personName})</span>
                )}
            </div>
            {isValidDate(event.displayDate) ? (
                <div className="event-detail-line">
                    {formatNepaliDate(event.displayDate).withDayShortNepali}
                    <span className="event-detail-muted"> ({formatEnglishDate(event.displayDate).short})</span>
                </div>
            ) : null}
            {event.tithi?.month && event.tithi?.name ? (
                <div className="event-detail-line">
                    {event.tithi.month} {normalizePakshaToNepali(event.tithi.paksha)} {event.tithi.name}
                </div>
            ) : null}
            {(event.host || event.hostLocation) && (
                <div className="event-detail-line">
                    Host: {[event.host, event.hostLocation].filter(Boolean).join(', ')}
                </div>
            )}
        </div>
    );

    const renderContent = () => {
        if (sortedAndFiltered.length === 0) {
            return (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No events found for this filter.
                </div>
            );
        }

        if (dayGrouped) {
            return dayGrouped.map((group, gi) => (
                <div key={gi} className="event-day-group">
                    {isValidDate(group.date) && (
                        <div className="event-day-header">
                            <span className="event-day-nepali">{formatNepaliDate(group.date).withDayShortNepali}</span>
                            <span className="event-day-english">· {formatEnglishDate(group.date).short}</span>
                        </div>
                    )}
                    <div className="event-cards-grid">
                        {group.events.map((ev, i) => renderEventCard(ev, i))}
                    </div>
                </div>
            ));
        }

        if (monthGrouped) {
            return Object.keys(monthGrouped).map(monthYear => (
                <div key={monthYear}>
                    <h5 className="text-lg font-bold text-gray-700 mb-2 mt-4">{monthYear}</h5>
                    <div className="event-cards-grid">
                        {monthGrouped[monthYear].map((ev, i) => renderEventCard(ev, i))}
                    </div>
                </div>
            ));
        }

        return null;
    };

    return (
        <div className="events-section">
            <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="section-title whitespace-nowrap">{t('home.eventsAndReminders')}</h2>
                <select
                    value={eventFilter}
                    onChange={handleFilterChange}
                    className="w-2/5 self-end border rounded-xl p-1 text-sm sm:w-auto"
                >
                    <option value="upcoming">{t('home.filterUpcoming')} ↗</option>
                    <option value="all">{t('home.filterAllEvents')} ↗</option>
                    <option value="past">{t('home.filterPastEvents')} ↗</option>
                    <option value="next-week">{t('home.filterNext7Days')}</option>
                    <option value="next-month">{t('home.filterNext30Days')}</option>
                    <option value="next-90-days">{t('home.filterNext90Days')}</option>
                </select>
            </div>

            <div className={needsScroll ? 'events-scroll-container' : ''}>
                {renderContent()}
            </div>
        </div>
    );
};

export default LandingPageEventsSection;
