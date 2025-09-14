import React, { useState } from 'react';
import './LandingPageEventsSection.css';

const LandingPageEventsSection = ({ events, familyMembers, onDoubleClickEvent }) => {
    const [eventFilter, setEventFilter] = useState('upcoming');

    // Helper function to calculate the next occurrence of a repeating event
    const getNextOccurrence = (originalDate, repetition) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(originalDate);

        if (repetition === 'monthly') {
            while (nextDate < today) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (repetition === 'yearly') {
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
            const originalDate = new Date(event.date);
            const displayDate = (event.repetition && event.repetition !== 'none') ?
                getNextOccurrence(originalDate, event.repetition) :
                originalDate;

            // Find the associated person to display their name and relation
            const person = familyMembers.find(member => member.id === event.personId);

            return { ...event, originalDate, displayDate, personName: person?.name, personRelation: person?.relation };
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
            const monthYear = event.displayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groupedEvents[monthYear]) {
                groupedEvents[monthYear] = [];
            }
            groupedEvents[monthYear].push(event);
        });
    }

    return (
        <div className="events-section">
            <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Events & Reminders</h2>
                <select
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className="border rounded-xl p-1 text-sm"
                >
                    <option value="upcoming">Upcoming</option>
                    <option value="all">All Events</option>
                    <option value="past">Past Events</option>
                    <option value="next-week">Next 7 Days</option>
                    <option value="next-month">Next 30 Days</option>
                    <option value="next-90-days">Next 90 Days</option>
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
                                        className="event-card"
                                        onDoubleClick={() => onDoubleClickEvent(event)}
                                    >
                                        <div className="event-name">{event.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {event.displayDate.toDateString()}
                                            {event.repetition && event.repetition !== 'none' && (
                                                <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                            )}
                                        </div>
                                        {event.personName && (
                                            <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
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
                                className="event-card"
                                onDoubleClick={() => onDoubleClickEvent(event)}
                            >
                                <div className="event-name">{event.name}</div>
                                <div className="text-sm text-gray-500">
                                    {event.displayDate.toDateString()}
                                    {event.repetition && event.repetition !== 'none' && (
                                        <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                    )}
                                </div>
                                {event.personName && (
                                    <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
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