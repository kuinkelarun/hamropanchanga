import React from 'react';
import CustomerList from './CustomerList';
import LandingPageEventsSection from './LandingPageEventsSection'; // Make sure this import exists
import './LandingPage.css';
import heroAnimation from './hero-image.png';
import NepaliCalendar from './NepaliCalendar';
import { signInWithGoogle } from '../firebase';

const LandingPage = ({ user, customers, onSelectCustomer, onAddCustomer, events, familyMembers, onDoubleClickEvent, onEditCustomer, onDeleteCustomer }) => {
    return (
        <div className="landing-container">
            {/* HERO: full-width container */}
            <div className="hero-full">
                <div className="hero-section">
                    <div className="hero-content">
                        <h1 className="app-name">My Family Tree</h1>
                        <p className="tagline">Connect your past. Branch out your future.</p>
                        <button className="cta-button" onClick={onAddCustomer}>
                            Start Your Tree
                        </button>

                        {!user && (
                            <div style={{ marginTop: '0.75rem' }}>
                                <button
                                    onClick={async () => {
                                        try {
                                            await signInWithGoogle();
                                        } catch (err) {
                                            // sign-in helper logs errors
                                        }
                                    }}
                                    className="login-small"
                                >
                                    Login
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="hero-illustration">
                        <img
                            src={heroAnimation}
                            alt="Family tree illustration"
                            className="hero-images"
                        />
                    </div>
                </div>
            </div>

            {/* PAGE BODY: constrained width and centered */}
            <main className="page-body">
                {/* Outer layout wrapper without card visuals; each section below is its own card */}
                <div className="single-container">
                    {/* Nepali Calendar - inserted above branches */}
                    <div className="section-card calendar-wrapper">
                        <NepaliCalendar />
                    </div>

                    {/* Branches Cards Section */}
                    <div className="section-card branches-section">
                        <CustomerList
                            customers={customers}
                            onSelectCustomer={onSelectCustomer}
                            onAddCustomer={onAddCustomer}
                            onEditCustomer={onEditCustomer}
                            onDeleteCustomer={onDeleteCustomer}
                        />
                    </div>

                    {/* Events/Updates Section */}
                    <div className="section-card events-section">
                        <LandingPageEventsSection 
                            events={events} 
                            familyMembers={familyMembers} 
                            onDoubleClickEvent={onDoubleClickEvent} 
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LandingPage;
