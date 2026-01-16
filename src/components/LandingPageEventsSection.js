import React, { useState, useCallback } from 'react';
import './LandingPageEventsSection.css';
import { useSettings } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatNepaliDate, formatEnglishDate, formatNepaliMonthYear, formatGregorianMonthYear, convertAdToBs, convertBsToAd } from '../utils/nepaliDateUtils';

const LandingPageEventsSection = ({ events, familyMembers, onDoubleClickEvent, onEventClick }) => {
    const { t } = useLanguage();
    const [eventFilter, setEventFilter] = useState('next-week');
    const { isNepaliCalendar } = useSettings(); // Use global settings

    // Helper function to get tithi display string with normalized paksha
    const getTithiDisplayString = useCallback((event) => {
        if (!event.tithi) return '';
        
        const { month, paksha, name } = event.tithi;
        if (!month || !name) return '';
        
        // Normalize paksha to Nepali
        let pakshaDisplay = paksha;
        if (paksha === 'Shukla' || paksha === 'शुक्ल') {
            pakshaDisplay = 'शुक्लपक्ष';
        } else if (paksha === 'Krishna' || paksha === 'कृष्ण') {
            pakshaDisplay = 'कृष्णपक्ष';
        }
        
        return ` (${month} ${pakshaDisplay} ${name})`;
    }, []);

    // Helper function to get repetition display text in Nepali
    const getRepetitionDisplay = useCallback((repetition) => {
        if (!repetition || repetition === 'none') return '';
        if (repetition === 'yearly') return 'वार्षिक';
        if (repetition === 'monthly') return 'मासिक';
        return repetition;
    }, []);

    // Helper function to calculate the next occurrence of a repeating event
    const getNextOccurrence = (originalDate, repetition, event) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(originalDate);
        nextDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

        if (repetition === 'monthly') {
            while (nextDate < today) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (repetition === 'yearly') {
            // For Nepali date-based yearly events, use BS conversion to find next occurrence
            const dateStr = event?.dateKey || event?.date;
            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = dateStr.split('-').map(Number);
                
                try {
                    // Convert AD date to BS
                    const bsDate = convertAdToBs(y, m - 1, d);
                    if (bsDate) {
                        // Find next occurrence in the same BS month/day but future BS year
                        let currentBsYear = bsDate.year;
                        
                        while (true) {
                            // Try to convert BS date to AD
                            const adDateObj = convertBsToAd(currentBsYear, bsDate.month, bsDate.day);
                            if (adDateObj) {
                                nextDate = new Date(adDateObj.year, adDateObj.month, adDateObj.day, 12, 0, 0);
                                if (nextDate >= today) {
                                    return nextDate;
                                }
                            }
                            currentBsYear++;
                            // Safety check
                            if (currentBsYear > bsDate.year + 5) {
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error calculating next occurrence for yearly event:', err);
                }
            }
            
            // Fallback: simple year increment
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
            // Use dateKey if available (standard), fallback to date (legacy)
            const dateStr = event.dateKey || event.date;
            let originalDate;
            
            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Parse YYYY-MM-DD as local date, set to NOON (12:00) to avoid timezone edge cases
                // where local midnight might fall into the previous day in NPT or UTC
                const [y, m, d] = dateStr.split('-').map(Number);
                originalDate = new Date(y, m - 1, d, 12, 0, 0);
            } else {
                originalDate = new Date(event.date || event.dateKey);
            }

            const displayDate = (event.repetition && event.repetition !== 'none') ?
                getNextOccurrence(originalDate, event.repetition, event) :
                originalDate;

            // Find the associated person to display their name and relation
            const person = familyMembers.find(member => member.id === event.personId);

            return { 
                ...event, 
                name: event.title || event.name, // Ensure title is used if name is missing
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
        .sort((a, b) => a.displayDate - b.displayDate);

    const shouldGroup = ['upcoming', 'all', 'next-90-days'].includes(eventFilter);
    const groupedEvents = {};

    if (shouldGroup) {
        sortedAndFilteredEvents.forEach(event => {
            const monthYear = isNepaliCalendar 
                ? formatNepaliMonthYear(event.displayDate).nepali
                : formatGregorianMonthYear(event.displayDate).full;
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
                                            <div className="font-medium text-gray-700">
                                                {isNepaliCalendar 
                                                    ? formatNepaliDate(event.displayDate).withDayShortNepali
                                                    : formatEnglishDate(event.displayDate).withDayShort
                                                }
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {isNepaliCalendar 
                                                    ? formatEnglishDate(event.displayDate).short
                                                    : formatNepaliDate(event.displayDate).shortNepali
                                                }
                                                {event.tithi && getTithiDisplayString(event)}
                                            </div>
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
                                    <div className="font-medium text-gray-700">
                                        {isNepaliCalendar 
                                            ? formatNepaliDate(event.displayDate).withDayShortNepali
                                            : formatEnglishDate(event.displayDate).withDayShort
                                        }
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {isNepaliCalendar 
                                            ? formatEnglishDate(event.displayDate).short
                                            : formatNepaliDate(event.displayDate).shortNepali
                                        }
                                        {event.tithi && getTithiDisplayString(event)}
                                    </div>
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