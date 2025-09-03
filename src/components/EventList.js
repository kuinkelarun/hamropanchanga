import React from 'react';

// const EventList = ({ events }) => {
//     if (!events || events.length === 0) {
//         return <div className="text-center py-8 text-gray-400">No events added yet.</div>;
//     }

//     return (
//         <div className="space-y-4">
//             {events.map((event, index) => (
//                 <div key={index} className="bg-white p-4 rounded-xl shadow-md border-l-4 border-purple-500">
//                     <h4 className="font-bold text-gray-800">{event.name}</h4>
//                     <p className="text-sm text-gray-600">
//                         Date: {event.date}
//                         {event.personId && (
//                             <span className="ml-2 text-gray-500">
//                                 (For: {event.personId}) {/* You may want to look up the person's name here */}
//                             </span>
//                         )}
//                     </p>
//                 </div>
//             ))}
//         </div>
//     );
// };

// Component to list upcoming events
const EventList = ({ events }) => {
    const upcomingEvents = events
        .map(event => ({
            ...event,
            date: new Date(event.date)
        }))
        .filter(event => event.date >= new Date())
        .sort((a, b) => a.date - b.date);
    return (
        <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No upcoming events.
                </div>
            ) : (
                <ul className="space-y-2">
                    {upcomingEvents.map((event, index) => (
                        <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                            <div className="flex-1">
                                <div className="text-gray-800 font-medium">{event.name}</div>
                                <div className="text-sm text-gray-500">{event.date.toDateString()}</div>
                                {event.personName && (
                                    <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default EventList;