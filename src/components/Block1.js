import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import './Block1.css';

const Block1 = () => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <section className="block1-container">
                <div className="block1-loading">Loading features...</div>
            </section>
        );
    }

    if (cards.length === 0) {
        return null; // Don't show section if no published cards
    }

    return (
        <section className="block1-container">
            <div className="block1-header">
                <h2 className="block1-title">Discover Features</h2>
                <p className="block1-subtitle">Explore everything you can do with My Family Tree</p>
            </div>
            
            <div className="block1-scroll-wrapper">
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
            
            <div className="block1-scroll-hint">
                <span className="block1-hint-text">← Swipe to explore →</span>
            </div>
        </section>
    );
};

export default Block1;
