import React from 'react';

const EventList = ({ events }) => {
    if (!events || events.length === 0) {
        return <div className="text-center py-8 text-gray-400">No events added yet.</div>;
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                <div key={index} className="bg-white p-4 rounded-xl shadow-md border-l-4 border-purple-500">
                    <h4 className="font-bold text-gray-800">{event.name}</h4>
                    <p className="text-sm text-gray-600">
                        Date: {event.date}
                        {event.personId && (
                            <span className="ml-2 text-gray-500">
                                (For: {event.personId}) {/* You may want to look up the person's name here */}
                            </span>
                        )}
                    </p>
                </div>
            ))}
        </div>
    );
};

export default EventList;