import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useTithiDateResolver } from '../hooks/useTithiDateResolver';

import HeroSection from './landing/HeroSection';
import FeatureShowcase from './landing/FeatureShowcase';
import TreeBuilderSpotlight from './landing/TreeBuilderSpotlight';
import HowItWorks from './landing/HowItWorks';
import CtaBanner from './landing/CtaBanner';
import LandingPageEventsSection from './LandingPageEventsSection';
import NepaliCalendar from './NepaliCalendar';
import Block1 from './Block1';
import Footer from './Footer';

import './LandingPage.css';

const LandingPage = ({ user, isAdmin, trees = [], treeMembers = [], events, familyMembers, onDoubleClickEvent, onEventClick, onSignIn }) => {
    const { t } = useLanguage();
    const [block1Visible, setBlock1Visible] = useState(() => {
        const cached = localStorage.getItem('block1Visible');
        return cached === null ? null : cached === 'true';
    });
    const [heroVideoId, setHeroVideoId] = useState('');
    const navigate = useNavigate();

    // Fetch Block 1 visibility setting
    useEffect(() => {
        const fetchBlock1Visibility = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'siteSettings', 'block1'));
                const visible = settingsDoc.exists() ? settingsDoc.data().visible !== false : true;
                setBlock1Visible(visible);
                localStorage.setItem('block1Visible', String(visible));
            } catch (error) {
                console.error('Error fetching Block 1 visibility:', error);
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
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScrollPosition, 10));
                sessionStorage.removeItem('landingPageScrollPosition');
            }, 0);
        }
    }, []);

    const handleStartTree = () => {
        sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
        navigate('/trees');
    };

    const sharedTreeIds = useMemo(
        () => user ? trees.filter(t => t.ownerUid !== user.uid).map(t => t.id) : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user?.uid, trees]
    );

    // Resolve tithi-based event dates from the live tithi DB so the Events
    // section shows events on their actual tithi dates, not the stored dateKey.
    const resolveEventDate = useTithiDateResolver();
    const enrichedEvents = useMemo(() => {
        if (!events) return [];
        return events.map(event => {
            if (event.tithi && event.repetition !== 'monthly') {
                const resolvedDate = resolveEventDate(event);
                if (resolvedDate) {
                    return { ...event, resolvedTithiDate: resolvedDate };
                }
            }
            return event;
        });
    }, [events, resolveEventDate]);

    return (
        <div className="landing-container">
            {/* 1. Hero */}
            <div className="edgefull">
                <HeroSection onStartTree={handleStartTree} heroVideoId={heroVideoId} />
            </div>

            {/* 2. Announcements (conditional) */}
            {block1Visible === true && (
                <div className="edgefull block1-wrapper">
                    <Block1 />
                </div>
            )}

            {/* 3. Feature Showcase */}
            <div className="edgefull">
                <FeatureShowcase />
            </div>

            {/* 4. Tree Builder Spotlight */}
            <div className="edgefull">
                <TreeBuilderSpotlight onNavigateToTrees={handleStartTree} />
            </div>

            {/* 5. Nepali Calendar */}
            <div id="nepali-calendar-section" className="edgefull">
                <div className="section-content-centered">
                    <h2 className="section-heading" style={{ marginTop: 'var(--space-3xl)' }}>
                        {t('landing.calendarHeading')}
                    </h2>
                    <p className="section-subheading">{t('landing.calendarSubheading')}</p>
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

            {/* 6. How It Works */}
            <div className="edgefull">
                <HowItWorks />
            </div>

            {/* 7. Events Feed (auth-gated) */}
            <div id="events-reminders-section" className="edgefull">
                <div className="section-content-centered">
                    <h2 className="section-heading" style={{ marginTop: 'var(--space-3xl)' }}>
                        {t('landing.eventsHeading')}
                    </h2>
                    {user ? (
                        <div className="section-card events-section">
                            <LandingPageEventsSection
                                events={enrichedEvents}
                                familyMembers={familyMembers}
                                onDoubleClickEvent={onDoubleClickEvent}
                                onEventClick={onEventClick}
                            />
                        </div>
                    ) : (
                        <div className="section-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem' }}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            <p className="text-gray-500 mb-4">{t('landing.eventsSignInPrompt')}</p>
                            <button
                                onClick={onSignIn}
                                className="btn btn-primary"
                            >
                                {t('auth.signIn')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 8. CTA Banner */}
            <div className="edgefull" style={{ marginTop: 'var(--space-3xl)' }}>
                <CtaBanner user={user} onStartTree={handleStartTree} onSignIn={onSignIn} />
            </div>

            {/* 9. Footer */}
            <div className="footer-full edgefull">
                <Footer />
            </div>
        </div>
    );
};

export default LandingPage;
