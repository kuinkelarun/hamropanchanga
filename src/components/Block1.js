import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
import announcementIcon from '../assets/announcement-icon.svg';
import './Block1.css';

const Block1 = () => {
    const { t } = useLanguage();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const cardsRowRef = useRef(null);
    const [cardsWidth, setCardsWidth] = useState(0);

    useEffect(() => {
        // Fetch published cards from Firestore
        const q = query(
            collection(db, 'homeCards'),
            where('published', '==', true),
            orderBy('order', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cardsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('Fetched cards:', cardsData); // Debug log
            setCards(cardsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching cards:', error);
            console.error('Error details:', error.message);
            // If index is missing, try without orderBy as fallback
            if (error.code === 'failed-precondition') {
                console.log('Trying query without index...');
                const fallbackQuery = query(
                    collection(db, 'homeCards'),
                    where('published', '==', true)
                );
                onSnapshot(fallbackQuery, (snapshot) => {
                    const cardsData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).sort((a, b) => (a.order || 0) - (b.order || 0)); // Manual sort
                    console.log('Fetched cards (fallback):', cardsData);
                    setCards(cardsData);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Keep header width in sync with the cards row width
    useEffect(() => {
        if (!cardsRowRef.current) return;

        const updateWidth = () => {
            // Guard against unmounted ref or missing element
            if (!cardsRowRef.current) return;
            const rect = cardsRowRef.current.getBoundingClientRect();
            setCardsWidth(rect.width);
        };

        updateWidth();

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => updateWidth());
            resizeObserver.observe(cardsRowRef.current);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateWidth);
        }

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            } else if (typeof window !== 'undefined') {
                window.removeEventListener('resize', updateWidth);
            }
        };
    }, [cards.length]);

    if (loading) {
        return (
            <section className="block1-container">
                <div className="block1-content-wrapper">
                    <div className="block1-header-wrapper">
                        <div className="block1-header">
                            <div className="block1-header-inner" style={{ width: '100%' }}>
                                <h2 className="block1-title">
                                    <img src={announcementIcon} alt="Announcement" className="block1-title-icon" />
                                    {t('home.announcements')}
                                </h2>
                            </div>
                        </div>
                    </div>
                    <div className="block1-scroll-wrapper">
                        <div className="block1-scroll-wrapper-inner">
                            <div className="block1-cards">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="block1-card" style={{ opacity: 0.6, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}>
                                        <div style={{ height: '200px' }}></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (cards.length === 0) {
        return null; // Don't show section if no published cards
    }

    return (
        <section className="block1-container">
            <div className="block1-content-wrapper">
                <div className="block1-header-wrapper">
                    <div className="block1-header">
                        <div 
                            className="block1-header-inner"
                            style={cardsWidth ? { width: cardsWidth } : undefined}
                        >
                            <h2 className="block1-title"><img src={announcementIcon} alt="Announcement" className="block1-title-icon" /> {t('home.announcements')}</h2>
                        </div>
                    </div>
                </div>
                
                <div className="block1-scroll-wrapper">
                    <div 
                        className="block1-scroll-wrapper-inner"
                        ref={cardsRowRef}
                    >
                    <div className="block1-cards">
                    {cards.map(card => (
                        <div 
                            key={card.id} 
                            className="block1-card"
                            style={card.imageUrl ? { backgroundImage: `url(${card.imageUrl})` } : {}}
                            onClick={() => card.link && window.open(card.link, '_blank')}
                            role={card.link ? "button" : "article"}
                            tabIndex={card.link ? 0 : undefined}
                            onKeyDown={(e) => {
                                if (card.link && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    window.open(card.link, '_blank');
                                }
                            }}
                        >
                            {!card.imageUrl && <div className="block1-card-icon">{card.icon}</div>}
                            <div className={`block1-card-content block1-text-${card.textPosition || 'center'}`}>
                                {card.title && <h3 className="block1-card-title">{card.title}</h3>}
                                {card.description && <p className="block1-card-description">{card.description}</p>}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </div>
            </div>
            
            <div className="block1-scroll-hint">
                <span className="block1-hint-text">← Swipe to explore →</span>
            </div>
        </section>
    );
};

export default Block1;
