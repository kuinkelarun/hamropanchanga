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

    // Restore scroll position when returning to landing page
    useEffect(() => {
        const savedScrollPosition = sessionStorage.getItem('landingPageScrollPosition');
        if (savedScrollPosition) {
            // Use setTimeout to ensure DOM is fully rendered before scrolling
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScrollPosition, 10));
                // Clear the saved position after restoring
                sessionStorage.removeItem('landingPageScrollPosition');
            }, 0);
        }
    }, []);

        // Note: BlockTithi has its own visibility loader; we render it alongside Block1
    
        return (
            <div className="landing-container">
                {/* HERO: full-width container - visible to all users */}
                <div className="hero-full edgefull">
                    <section className="hero-section" aria-label="Hero section">
                        <div className="hero-content">
                            <h1 className="app-name">My Family Tree</h1>
                            <p className="tagline">Connect your past. Branch out your future.</p>
                            <button 
                                className="cta-button" 
                                onClick={onAddCustomer}
                                aria-label="Start building your family tree"
                            >
                                Start Your Tree
                            </button>
                        </div>
                        <div className="hero-illustration">
                            <img
                                src={heroAnimation}
                                alt="Family tree illustration"
                                className="hero-images"
                                loading="lazy"
                            />
                        </div>
                            </section>
                        </div>

                {/* Block 1: Horizontal Scrolling Cards - Conditionally visible */}
            {block1Visible === true && (
                <div className="edgefull block1-wrapper">
                    <Block1 />
                </div>
            )}

            {/* Nepali Calendar */}
            <div className="edgefull">
                <div className="section-content-centered">
                    <div className="section-card calendar-wrapper">
                        <NepaliCalendar user={user} isAdmin={isAdmin} onCustomerClick={onSelectCustomer} />
                    </div>
                </div>
            </div>

            {/* Branches Cards Section */}
            {user && (
                <div className="edgefull">
                    <div className="section-content-centered">
                        <div className="section-card branches-section">
                            <CustomerList
                                customers={customers}
                                onSelectCustomer={onSelectCustomer}
                                onAddCustomer={onAddCustomer}
                                onEditCustomer={onEditCustomer}
                                onDeleteCustomer={onDeleteCustomer}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Events/Updates Section */}
            {user && (
                <div className="edgefull">
                    <div className="section-content-centered">
                        <div className="section-card events-section">
                            <LandingPageEventsSection 
                                events={events} 
                                familyMembers={familyMembers} 
                                onDoubleClickEvent={onDoubleClickEvent} 
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Footer: full-width container */}
            <div className="footer-full edgefull">
                <Footer />
            </div>
        </div>
    );
};

export default LandingPage;
