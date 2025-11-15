import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CustomerList from './CustomerList';
import LandingPageEventsSection from './LandingPageEventsSection'; // Make sure this import exists
import './LandingPage.css';
import heroAnimation from './hero-image.png';
import NepaliCalendar from './NepaliCalendar';
import Block1 from './Block1';
import Footer from './Footer';
import { signInWithGoogle } from '../firebase';

const LandingPage = ({ user, isAdmin, customers, onSelectCustomer, onAddCustomer, events, familyMembers, onDoubleClickEvent, onEditCustomer, onDeleteCustomer }) => {
    const [block1Visible, setBlock1Visible] = useState(null);

    // Fetch Block 1 visibility setting
    useEffect(() => {
        const fetchBlock1Visibility = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'siteSettings', 'block1'));
                if (settingsDoc.exists()) {
                    setBlock1Visible(settingsDoc.data().visible !== false);
                } else {
                    // Default to visible if setting doesn't exist
                    setBlock1Visible(true);
                }
            } catch (error) {
                console.error('Error fetching Block 1 visibility:', error);
                // Default to visible on error
                setBlock1Visible(true);
            }
        };
        
        fetchBlock1Visibility();
    }, []);

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

            {/* Block 1: Horizontal Scrolling Cards - Conditionally visible */}
            {block1Visible === true && <Block1 />}

            {/* PAGE BODY: constrained width and centered */}
            <main className="page-body">
                {/* Outer layout wrapper without card visuals; each section below is its own card */}
                <div className="single-container">
                    {/* Nepali Calendar - inserted above branches */}
                    <div className="section-card calendar-wrapper">
                        <NepaliCalendar user={user} isAdmin={isAdmin} />
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
