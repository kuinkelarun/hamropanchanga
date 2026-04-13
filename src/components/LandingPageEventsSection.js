import React, { useState, useCallback } from 'react';
import './LandingPageEventsSection.css';
import { useLanguage } from '../contexts/LanguageContext';
import { formatNepaliDate, formatEnglishDate, formatNepaliMonthYear, convertAdToBs, convertBsToAd } from '../utils/nepaliDateUtils';
import { NEPALI_MONTHS, normalizePakshaToNepali } from '../constants/calendarConstants';
// Use Unicode `event.title` when present

const LandingPageEventsSection = ({ events, familyMembers, onDoubleClickEvent, onEventClick }) => {
    const { t } = useLanguage();
    const [eventFilter, setEventFilter] = useState('next-week');

    // Helper function to get tithi display string with normalized paksha
    const getTithiDisplayString = useCallback((event) => {
        if (!event.tithi) return '';

        const { month, paksha, name } = event.tithi;
        if (!month || !name) return '';

        // Normalize paksha to Nepali
        const pakshaDisplay = normalizePakshaToNepali(paksha);

        return ` (${month} ${pakshaDisplay} ${name})`;
    }, []);

    // Helper function to get repetition display text in Nepali
    const getRepetitionDisplay = useCallback((repetition) => {
        if (!repetition || repetition === 'none') return '';
        if (repetition === 'yearly') return 'वार्षिक';
        if (repetition === 'monthly') return 'मासिक';
        return repetition;
    }, []);

    // Returns true for a legitimate JS Date.
    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

    // Estimate an approximate AD date from a Nepali lunar month name.
    // Used when a tithi-based event has no stored dateKey or the resolver
    // couldn't find the tithi in the DB. Uses the 1st of the BS month for
    // a conservative estimate so events appear early in time-bound filters.
    const getTithiApproxDate = (tithiMonth) => {
        // Use canonical NEPALI_MONTHS array to ensure name matching
        const idx = NEPALI_MONTHS.indexOf(tithiMonth);
        if (idx === -1) return null;
        const bsMonth = idx + 1;
        const todayAd = new Date();
        const bsToday = convertAdToBs(todayAd.getFullYear(), todayAd.getMonth(), todayAd.getDate());
        if (!bsToday) return null;
        let bsYear = bsToday.year;
        // Use day 1 instead of day 15 for a conservative early estimate
        let adDateObj = convertBsToAd(bsYear, bsMonth, 1);
        if (!adDateObj) return null;
        let approxDate = new Date(adDateObj.year, adDateObj.month, adDateObj.day, 12, 0, 0);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        if (approxDate < todayMidnight) {
            const next = convertBsToAd(bsYear + 1, bsMonth, 1);
            if (next) approxDate = new Date(next.year, next.month, next.day, 12, 0, 0);
        }
        return isValidDate(approxDate) ? approxDate : null;
    };

    // Helper function to calculate the next occurrence of a repeating event
    const getNextOccurrence = (originalDate, repetition, event) => {
        // Guard: originalDate must be valid before we can compute recurrence
        if (!isValidDate(originalDate)) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(originalDate);
        nextDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

        if (repetition === 'monthly') {
            while (nextDate < today) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (repetition === 'yearly') {
            // Use BS solar date recurrence: find the next BS year where the
            // same BS month + day falls on or after today.
            const dateStr = event?.dateKey || event?.date;
            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = dateStr.split('-').map(Number);

                try {
                    const bsDate = convertAdToBs(y, m - 1, d);
                    if (bsDate) {
                        let currentBsYear = bsDate.year;

                        while (true) {
                            const adDateObj = convertBsToAd(currentBsYear, bsDate.month, bsDate.day);
                            if (adDateObj) {
                                nextDate = new Date(adDateObj.year, adDateObj.month, adDateObj.day, 12, 0, 0);
                                if (nextDate >= today) {
                                    return nextDate;
                                }
                            }
                            currentBsYear++;
                            if (currentBsYear > bsDate.year + 5) {
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error calculating next occurrence for yearly event:', err);
                }
            }

            // Fallback for tithi events without a valid dateKey: estimate from
            // the lunar month name.
            if (event?.tithi?.month) {
                const approx = getTithiApproxDate(event.tithi.month);
                if (approx && isValidDate(approx)) {
                    return approx;
                }
            }

            // Last resort: simple year increment
            while (nextDate < today) {
                nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
        }
        return nextDate;
    };

    // Helper dates for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    const next90Days = new Date(today);
    next90Days.setDate(today.getDate() + 90);

    // Filter and sort events based on the selected filter
    const sortedAndFilteredEvents = events
        .map(event => {
            // For tithi-based events (yearly/none), use the pre-resolved date from
            // the tithi DB if available. This gives the EXACT date the tithi falls on
            // this year, instead of the approximate solar-date recurrence.
            if (event.resolvedTithiDate) {
                const [y, m, d] = event.resolvedTithiDate.split('-').map(Number);
                const resolvedDate = new Date(y, m - 1, d, 12, 0, 0);
                if (isValidDate(resolvedDate)) {
                    let displayDate = resolvedDate;

                    // For yearly tithi events: if this year's occurrence already
                    // passed, use getNextOccurrence to estimate next year's date.
                    // (Next year's tithis may not be generated yet.)
                    if (event.repetition === 'yearly' && resolvedDate < today) {
                        const next = getNextOccurrence(resolvedDate, 'yearly', event);
                        displayDate = isValidDate(next) ? next : resolvedDate;
                    }

                    const person = familyMembers.find(member => member.id === event.personId);
                    return {
                        ...event,
                        name: (event.title || event.name),
                        originalDate: resolvedDate,
                        displayDate,
                        personName: person?.name,
                        personRelation: person?.relation,
                    };
                }
            }

            // Fallback: use dateKey for non-tithi events or when resolved date unavailable
            const dateStr = event.dateKey || event.date;
            let originalDate;

            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = dateStr.split('-').map(Number);
                originalDate = new Date(y, m - 1, d, 12, 0, 0);
            } else {
                originalDate = new Date(event.date || event.dateKey);
            }

            // If the stored dateKey is missing or invalid, estimate from tithi month.
            if (!isValidDate(originalDate) && event.tithi?.month) {
                originalDate = getTithiApproxDate(event.tithi.month);
            }

            let displayDate;
            if (event.repetition && event.repetition !== 'none') {
                const next = getNextOccurrence(originalDate, event.repetition, event);
                displayDate = isValidDate(next) ? next : originalDate;
            } else {
                displayDate = originalDate;
            }

            // Find the associated person to display their name and relation
            const person = familyMembers.find(member => member.id === event.personId);

            return {
                ...event,
                name: (event.title || event.name),
                originalDate,
                displayDate,
                personName: person?.name,
                personRelation: person?.relation
            };
        })
        .filter(event => {
            switch (eventFilter) {
                case 'all':
                    return true;
                case 'past':
                    return event.originalDate < today;
                case 'next-week':
                    return event.displayDate >= today && event.displayDate <= nextWeek;
                case 'next-month':
                    return event.displayDate >= today && event.displayDate <= nextMonth;
                case 'next-90-days':
                    return event.displayDate >= today && event.displayDate <= next90Days;
                case 'upcoming':
                default:
                    return event.displayDate >= today;
            }
        })
        .sort((a, b) => {
            const ta = isValidDate(a.displayDate) ? a.displayDate.getTime() : Infinity;
            const tb = isValidDate(b.displayDate) ? b.displayDate.getTime() : Infinity;
            return ta - tb;
        });

    const shouldGroup = ['upcoming', 'all', 'next-90-days'].includes(eventFilter);
    const groupedEvents = {};

    if (shouldGroup) {
        sortedAndFilteredEvents.forEach(event => {
            const monthYear = isValidDate(event.displayDate)
                ? formatNepaliMonthYear(event.displayDate).nepali
                : 'मिति अनिश्चित';
            if (!groupedEvents[monthYear]) {
                groupedEvents[monthYear] = [];
            }
            groupedEvents[monthYear].push(event);
        });
    }

    return (
        <div className="events-section">
            <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="section-title whitespace-nowrap">{t('home.eventsAndReminders')}</h2>
                <select
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className="w-2/5 self-end border rounded-xl p-1 text-sm sm:w-auto"
                >
                    <option value="upcoming">{t('home.filterUpcoming')}</option>
                    <option value="all">{t('home.filterAllEvents')}</option>
                    <option value="past">{t('home.filterPastEvents')}</option>
                    <option value="next-week">{t('home.filterNext7Days')}</option>
                    <option value="next-month">{t('home.filterNext30Days')}</option>
                    <option value="next-90-days">{t('home.filterNext90Days')}</option>
                </select>
            </div>

            {sortedAndFilteredEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No events found for this filter.
                </div>
            ) : (
                shouldGroup ? (
                    Object.keys(groupedEvents).map(monthYear => (
                        <div key={monthYear}>
                            <h5 className="text-lg font-bold text-gray-700 mb-2 mt-4">{monthYear}</h5>
                            <div className="event-cards-grid">
                                {groupedEvents[monthYear].map((event, index) => (
                                    <div
                                        key={index}
                                        className="event-card cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => onEventClick && onEventClick(event)}
                                        onDoubleClick={() => onDoubleClickEvent(event)}
                                    >
                                        <div className="event-name">
                                            {event.name}
                                            {event.repetition && event.repetition !== 'none' && (
                                                <span className="text-xs text-gray-400 ml-2">({getRepetitionDisplay(event.repetition)})</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {isValidDate(event.displayDate) ? (
                                                <>
                                                    <div className="font-medium text-gray-700">
                                                        {formatNepaliDate(event.displayDate).withDayShortNepali}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {formatEnglishDate(event.displayDate).short}
                                                        {event.tithi && getTithiDisplayString(event)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xs text-gray-500 mt-0.5 italic">
                                                    {event.tithi ? getTithiDisplayString(event) : 'मिति अनिश्चित'}
                                                </div>
                                            )}
                                        </div>
                                        {event.personName && (
                                            <div className="font-medium text-gray-700 text-xs mt-1">For: {event.personName} ({event.personRelation})</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="event-cards-grid">
                        {sortedAndFilteredEvents.map((event, index) => (
                            <div
                                key={index}
                                className="event-card cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => onEventClick && onEventClick(event)}
                                onDoubleClick={() => onDoubleClickEvent(event)}
                            >
                                <div className="event-name">
                                    {event.name}
                                    {event.repetition && event.repetition !== 'none' && (
                                        <span className="text-xs text-gray-400 ml-2">({getRepetitionDisplay(event.repetition)})</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {isValidDate(event.displayDate) ? (
                                        <>
                                            <div className="font-medium text-gray-700">
                                                {formatNepaliDate(event.displayDate).withDayShortNepali}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {formatEnglishDate(event.displayDate).short}
                                                {event.tithi && getTithiDisplayString(event)}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xs text-gray-500 mt-0.5 italic">
                                            {event.tithi ? getTithiDisplayString(event) : 'मिति अनिश्चित'}
                                        </div>
                                    )}
                                </div>
                                {event.personName && (
                                    <div className="font-medium text-gray-700 text-xs mt-1">For: {event.personName} ({event.personRelation})</div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};


export default LandingPageEventsSection;
