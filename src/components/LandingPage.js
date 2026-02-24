import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
import LandingPageEventsSection from './LandingPageEventsSection';
import './LandingPage.css';
import heroAnimation from './hero-image.png';
import NepaliCalendar from './NepaliCalendar';
import Block1 from './Block1';
import Footer from './Footer';

const LandingPage = ({ user, isAdmin, trees = [], treeMembers = [], events, familyMembers, onDoubleClickEvent, onEventClick }) => {
    const { t } = useLanguage();
    const [block1Visible, setBlock1Visible] = useState(true); // Optimistically show Block1, hide if needed
    const [searchQuery, setSearchQuery] = useState('');
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

    // Filter trees to show only those owned by the current user
    const myTrees = user ? trees.filter(tree => tree.ownerUid === user.uid) : [];

    // IDs of trees explicitly shared with this user (not owned)
    const sharedTreeIds = user ? trees.filter(t => t.ownerUid !== user.uid).map(t => t.id) : [];

        // Note: BlockTithi has its own visibility loader; we render it alongside Block1
    
        return (
            <div className="landing-container">
                {/* HERO: full-width container - visible to all users */}
                <div className="hero-full edgefull">
                    <section 
                        className="hero-section" 
                        aria-label="Hero section"
                        style={{ 
                            backgroundImage: `url(${heroAnimation})`, 
                            backgroundSize: 'cover', 
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                        }}
                    >
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex items-center">
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

            {/* Your Trees Section */}
            {user && myTrees.length > 0 && (
                <div className="edgefull">
                    <div className="section-content-centered">
                        <div className="section-card branches-section">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                    <h2 className="section-title whitespace-nowrap">{t('home.yourTrees')}</h2>
                                    <input
                                        type="text"
                                        placeholder="Search trees..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="border rounded-xl px-3 py-2 text-sm w-2/5 self-end sm:w-64"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {myTrees.filter(tree => {
                                        if (!searchQuery) return true;
                                        const search = searchQuery.toLowerCase();
                                        return (
                                            (tree.title || '').toLowerCase().includes(search) ||
                                            (tree.id || '').toLowerCase().includes(search) ||
                                            (tree.primaryMemberName || '').toLowerCase().includes(search) ||
                                            (tree.contactInfo || '').toLowerCase().includes(search) ||
                                            (tree.location || '').toLowerCase().includes(search)
                                        );
                                    }).map((tree) => (
                                        <div 
                                            key={tree.id} 
                                            className="relative bg-white p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                                            onClick={() => {
                                                sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
                                                navigate(`/tree/${tree.id}`);
                                            }}
                                        >
                                            <h3 className="text-xl font-semibold text-gray-800">{tree.title || 'Untitled Tree'}</h3>
                                            {tree.primaryMemberName && (
                                                <p className="text-sm text-gray-600 mt-1">👤 {tree.primaryMemberName}</p>
                                            )}
                                            {tree.contactInfo && (
                                                <a 
                                                    href={`tel:${tree.contactInfo.replace(/\D/g, '')}`}
                                                    className="inline-flex items-center gap-1 text-sm text-gray-500 mt-1 hover:text-blue-600 transition-colors max-w-fit"
                                                    title={tree.contactInfo}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    📞 <span className="truncate">{tree.contactInfo}</span>
                                                </a>
                                            )}
                                            {tree.location && (
                                                <p className="text-sm text-gray-500 mt-1">📍 {tree.location}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
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
