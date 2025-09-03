import React from 'react';
import CustomerList from './CustomerList';
import EventsSection from './EventsSection';
import './LandingPage.css';

const LandingPage = ({ user, customers, onSelectCustomer, onAddCustomer, events }) => {
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
                    {/* Placeholder for your illustration/animation */}
                    {/* You can replace this with an SVG or Lottie animation */}
                    <svg className="h-full w-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#ffffff" d="M110.8,-11.3C116.8,19.3,95.5,58.8,61.9,80.1C28.4,101.5,-19.4,104.7,-52.1,88.7C-84.8,72.7,-103.4,37.6,-105.1,-0.5C-106.8,-38.6,-91.6,-77.3,-62.4,-94.3C-33.1,-111.3,-1.9,-106.6,22.7,-93.6C47.4,-80.6,71.7,-59.4,85.1,-30.9C98.5,-2.5,101.1,-6.6,110.8,-11.3Z" transform="translate(100 100)" />
                    </svg>
                </div>
            </div>

            {/* Branches Cards Section (replaces your CustomerList) */}
            <div className="branches-section">
                <h2 className="section-title">Your Branches</h2>
                <CustomerList
                    customers={customers}
                    onSelectCustomer={onSelectCustomer}
                    onAddCustomer={onAddCustomer}
                />
            </div>

            Events/Updates Section
            <div className="events-section">
                <h2 className="section-title">Upcoming Events</h2>
                <EventsSection events={events} />
            </div>
        </div>
    );
};

export default LandingPage;