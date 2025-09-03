import React from 'react';
import './EventsSection.css';

const EventsSection = ({ events }) => {
    return (
        <div className="events-container">
            {/* <h2 className="section-title">Upcoming Events</h2> */}
            <div className="event-cards-grid">
                {events.length === 0 ? (
                    <p className="text-gray-500">No upcoming events.</p>
                ) : (
                    events.map(event => (
                        <div key={event.id} className="event-card">
                            <h3 className="event-name">{event.name}</h3>
                            <p className="event-date">{event.date}</p>
                        </div>
                    ))
                )}
            </div>
            {/* Floating Action Button
            <button className="floating-add-button">
                + Add Event
            </button> */}
        </div>
    );
};

export default EventsSection;