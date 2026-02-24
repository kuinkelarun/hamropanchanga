import React, { useState } from 'react';
import EventMenu from './EventMenu';
import { formatNepaliDate, formatEnglishDate, formatNepaliMonthYear } from '../utils/nepaliDateUtils';
// Titles are expected as Unicode in `event.title`

// Component to list all events
const EventList = ({ events, eventFilter, onEdit, onDelete }) => {
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
    
    // New date variable for the filter
    const next90Days = new Date(today);
    next90Days.setDate(today.getDate() + 90);

    // Filter and sort events based on the selected filter
    const sortedAndFilteredEvents = events
        .filter(event => {
            // Filter out events without a name or title
            const eventName = event.title || event.name;
            return eventName && eventName.trim() !== '';
        })
            .map(event => {
            const originalDate = new Date(event.date);
            const displayDate = (event.repetition && event.repetition !== 'none') ?
                getNextOccurrence(originalDate, event.repetition) :
                originalDate;
            return { ...event, originalDate, displayDate };
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
                case 'next-90-days': // New filter case
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
            const monthYear = formatNepaliMonthYear(event.displayDate).nepali;
            if (!groupedEvents[monthYear]) {
                groupedEvents[monthYear] = [];
            }
            groupedEvents[monthYear].push(event);
        });
    }

    const [openMenuId, setOpenMenuId] = useState(null);

    const handleToggle = (id) => {
        setOpenMenuId(prev => (prev === id ? null : id));
    };

    const handleClose = (id) => {
        setOpenMenuId(prev => (prev === id ? null : prev));
    };

    return (
        <div className="space-y-3">
            {sortedAndFilteredEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No events found for this filter.
                </div>
            ) : (
                shouldGroup ? (
                    Object.keys(groupedEvents).map(monthYear => (
                        <div key={monthYear}>
                            <h5 className="text-lg font-bold text-gray-700 mb-2 mt-4">{monthYear}</h5>
                            <ul className="space-y-2">
                                {groupedEvents[monthYear].map((event, index) => {
                                    const id = event.id ?? index;
                                    return (
                                        <li key={id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="text-gray-800 font-medium">
                                                { (event.title || event.name) || 'Untitled Event'}
                                                {event.repetition && event.repetition !== 'none' && (
                                                    <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                <div className="font-medium text-gray-700">
                                                    {formatNepaliDate(event.displayDate).withDayShortNepali}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {formatEnglishDate(event.displayDate).short}
                                                </div>
                                            </div>
                                            {event.personName && (
                                                <div className="font-medium text-gray-700 text-xs mt-1">For: {event.personName} ({event.personRelation})</div>
                                            )}
                                        </div>
                                        <EventMenu
                                            event={event}
                                            isOpen={openMenuId === id}
                                            onToggle={handleToggle}
                                            onClose={handleClose}
                                            onEdit={onEdit}
                                            onDeleteRequest={(ev) => onDelete && onDelete(ev)}
                                        />
                                    </li>
                                );
                                })}
                            </ul>
                        </div>
                    ))
                ) : (
                    <ul className="space-y-2">
                        {sortedAndFilteredEvents.map((event, index) => {
                            const id = event.id ?? index;
                            return (
                                <li key={id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                                    <div className="flex-1">
                                    <div className="text-gray-800 font-medium">
                                        { (event.title || event.name) || 'Untitled Event'}
                                        {event.repetition && event.repetition !== 'none' && (
                                            <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <div className="font-medium text-gray-700">
                                            {formatNepaliDate(event.displayDate).withDayShortNepali}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {formatEnglishDate(event.displayDate).short}
                                        </div>
                                    </div>
                                    {event.personName && (
                                        <div className="font-medium text-gray-700 text-xs mt-1">For: {event.personName} ({event.personRelation})</div>
                                    )}
                                    </div>
                                    <EventMenu
                                        event={event}
                                        isOpen={openMenuId === id}
                                        onToggle={handleToggle}
                                        onClose={handleClose}
                                        onEdit={onEdit}
                                        onDeleteRequest={(ev) => onDelete && onDelete(ev)}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )
            )}
        </div>
    );
};


// // Component to list upcoming events
// const EventList = ({ events }) => {
//     const upcomingEvents = events
//         .map(event => ({
//             ...event,
//             date: new Date(event.date)
//         }))
//         .filter(event => event.date >= new Date())
//         .sort((a, b) => a.date - b.date);
//     return (
//         <div className="space-y-3">
//             {upcomingEvents.length === 0 ? (
//                 <div className="text-center py-4 text-gray-400 text-sm">
//                     No upcoming events.
//                 </div>
//             ) : (
//                 <ul className="space-y-2">
//                     {upcomingEvents.map((event, index) => (
//                         <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
//                             <div className="flex-1">
//                                 <div className="text-gray-800 font-medium">{event.name}</div>
//                                 <div className="text-sm text-gray-500">{event.date.toDateString()}</div>
//                                 {event.personName && (
//                                     <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
//                                 )}
//                             </div>
//                         </li>
//                     ))}
//                 </ul>
//             )}
//         </div>
//     );
// };

export default EventList;