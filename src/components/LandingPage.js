import React from 'react';
import CustomerList from './CustomerList';
import LandingPageEventsSection from './LandingPageEventsSection'; // Make sure this import exists
import './LandingPage.css';
import heroAnimation from './hero-image.png';
import NepaliCalendar from './NepaliCalendar';

const LandingPage = ({ user, customers, onSelectCustomer, onAddCustomer, events, familyMembers, onDoubleClickEvent, onEditCustomer, onDeleteCustomer }) => {
    return (
        <div className="landing-container">
            {/* Hero Section */}
            <div className="hero-section">
                <div className="hero-content">
                    <h1 className="app-name">My Family Tree</h1>
                    <p className="tagline">Connect your past. Branch out your future.</p>
                    <button className="cta-button" onClick={onAddCustomer}>
                        Start Your Tree
                    </button>
                </div>
                <div className="hero-illustration">
                    <img
                        src={heroAnimation}
                        alt="Family tree illustration"
                        // autoPlay
                        // loop
                        // muted
                        // playsInline
                        className="hero-images"
                    />

                </div>
            </div>

            {/* Nepali Calendar - inserted above branches */}
            <div className="calendar-wrapper">
                <NepaliCalendar />
            </div>

            {/* Branches Cards Section */}
            <div className="branches-section">
                {/* <h2 className="section-title">Your Branches</h2> */}
                <CustomerList
                    customers={customers}
                    onSelectCustomer={onSelectCustomer}
                    onAddCustomer={onAddCustomer}
                    onEditCustomer={onEditCustomer}
                    onDeleteCustomer={onDeleteCustomer}
                />
            </div>

            {/* Events/Updates Section */}
            <div className="events-section">
                {/* <h2 className="section-title">Upcoming Events</h2> */}
                <LandingPageEventsSection 
                    events={events} 
                    familyMembers={familyMembers} 
                    onDoubleClickEvent={onDoubleClickEvent} 
                />
            </div>
        </div>
    );
};

export default LandingPage;
