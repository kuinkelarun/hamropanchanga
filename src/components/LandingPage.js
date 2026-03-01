import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
import LandingPageEventsSection from './LandingPageEventsSection';
import './LandingPage.css';
import NepaliCalendar from './NepaliCalendar';
import Block1 from './Block1';
import Footer from './Footer';

const LandingPage = ({ user, isAdmin, trees = [], treeMembers = [], events, familyMembers, onDoubleClickEvent, onEventClick }) => {
    const { t } = useLanguage();
    const [block1Visible, setBlock1Visible] = useState(true); // Optimistically show Block1, hide if needed
    const [heroVideoId, setHeroVideoId] = useState('');
    const navigate = useNavigate();

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

    // Fetch hero YouTube video ID
    useEffect(() => {
        const fetchHeroVideo = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'siteSettings', 'heroVideo'));
                if (settingsDoc.exists()) {
                    setHeroVideoId(settingsDoc.data().videoId || '');
                }
            } catch (error) {
                console.error('Error fetching hero video setting:', error);
            }
        };
        fetchHeroVideo();
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

    const handleStartTree = () => {
        // Save scroll position before navigating
        sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
        // Route to the tree selection page; from there the user can
        // pick an existing tree or create a new one before entering
        // the visual builder.
        navigate('/trees');
    };

    // IDs of trees explicitly shared with this user (not owned).
    // Memoized to produce a stable reference — NepaliCalendar's event listener
    // useEffect depends on this array; a new reference on every render (e.g. from
    // typing in the search box) would tear down and rebuild all Firestore listeners
    // on every keystroke, leaving shared-tree events perpetually absent from calendar day cards.
    const sharedTreeIds = useMemo(
        () => user ? trees.filter(t => t.ownerUid !== user.uid).map(t => t.id) : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user?.uid, trees]
    );

        // Note: BlockTithi has its own visibility loader; we render it alongside Block1
    
        return (
            <div className="landing-container">
                {/* HERO: full-width container - visible to all users */}
                <div className="hero-full edgefull">
                    <section 
                        className="hero-section" 
                        aria-label="Hero section"
                    >
                        <div className="hero-inner max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                            <div className="hero-content">
                                <h1 className="app-name">{t('hero.title')}</h1>
                                <p className="tagline">{t('hero.tagline')}</p>
                                <button 
                                    className="cta-button" 
                                    onClick={handleStartTree}
                                    aria-label="Start building your family tree"
                                >
                                    {t('hero.buildYourTree')}
                                </button>
                            </div>
                            {heroVideoId && (
                            <div className="hero-video">
                                <div className="hero-video-wrapper">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${heroVideoId}`}
                                        title="How to build your family tree"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                            )}
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
            <div id="nepali-calendar-section" className="edgefull">
                <div className="section-content-centered">
                    <div className="section-card calendar-wrapper">
                        <NepaliCalendar 
                            user={user} 
                            isAdmin={isAdmin} 
                            treeMembers={treeMembers}
                            sharedTreeIds={sharedTreeIds}
                            onTreeEventClick={onDoubleClickEvent}
                        />
                    </div>
                </div>
            </div>

            {/* Events/Updates Section */}
            {user && (
                <div className="edgefull">
                    <div className="section-content-centered">
                        <div className="section-card events-section">
                            <LandingPageEventsSection 
                                events={events} 
                                familyMembers={familyMembers} 
                                onDoubleClickEvent={onDoubleClickEvent}
                                onEventClick={onEventClick}
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Footer: full-width container */}
            <div className="footer-full edgefull">
                <Footer />
            </div>

            {/* Tree Selection Modal (legacy) no longer used; builder opens directly */}
        </div>
    );
};

export default LandingPage;
