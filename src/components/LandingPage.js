import React from 'react';
import CustomerList from './CustomerList';
import LandingPageEventsSection from './LandingPageEventsSection'; // Make sure this import exists
import './LandingPage.css';
import heroAnimation from './hero-image.png';
import NepaliCalendar from './NepaliCalendar';
import Block1 from './Block1';
import Footer from './Footer';
import { signInWithGoogle } from '../firebase';

const LandingPage = ({ user, customers, onSelectCustomer, onAddCustomer, events, familyMembers, onDoubleClickEvent, onEditCustomer, onDeleteCustomer }) => {
    return (
        <div className="landing-container">
            {/* HERO: full-width container - visible to all users */}
            <div className="hero-full">
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
                            className="hero-images"
                        />
                    </div>
                </div>
            </div>

            {/* Block 1: Horizontal Scrolling Cards - Visible to all users */}
            <Block1 />

            {/* PAGE BODY: constrained width and centered */}
            <main className="page-body">
                {/* Outer layout wrapper without card visuals; each section below is its own card */}
                <div className="single-container">
                    {/* Nepali Calendar - inserted above branches */}
                    <div className="section-card calendar-wrapper">
                        <NepaliCalendar />
                    </div>

                    {/* Branches Cards Section */}
                    {user && (
                        <div className="section-card branches-section">
                        <CustomerList
                            customers={customers}
                            onSelectCustomer={onSelectCustomer}
                            onAddCustomer={onAddCustomer}
                            onEditCustomer={onEditCustomer}
                            onDeleteCustomer={onDeleteCustomer}
                        />
                        </div>
                    )}

                    {/* Events/Updates Section */}
                    {user && (
                        <div className="section-card events-section">
                            <LandingPageEventsSection 
                                events={events} 
                                familyMembers={familyMembers} 
                                onDoubleClickEvent={onDoubleClickEvent} 
                            />
                        </div>
                    )}
                </div>
            </main>
            
            {/* Footer */}
            <Footer />
        </div>
    );
};

export default LandingPage;
