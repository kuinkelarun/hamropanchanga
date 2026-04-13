import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import VideoModal from './VideoModal';
import heroImage from '../hero-image.png';
import './HeroSection.css';

const HeroSection = ({ onStartTree, heroVideoId }) => {
    const { t } = useLanguage();
    const [showVideo, setShowVideo] = useState(false);

    return (
        <>
            <section className="hero-section-new" aria-label="Hero section">
                <div className="hero-inner-new">
                    <div className="hero-text">
                        <h1 className="hero-title">{t('hero.title')}</h1>
                        <p className="hero-subtitle">{t('hero.subtitle')}</p>
                        <div className="hero-actions">
                            <button
                                className="hero-cta-primary"
                                onClick={onStartTree}
                                aria-label="Start building your family tree"
                            >
                                {t('hero.buildYourTree')}
                            </button>
                            {heroVideoId && (
                                <button
                                    className="hero-cta-ghost"
                                    onClick={() => setShowVideo(true)}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    {t('hero.watchDemo')}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="hero-visual">
                        <div className="hero-image-frame">
                            <img
                                src={heroImage}
                                alt="Family tree builder preview"
                                loading="eager"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <VideoModal
                videoId={heroVideoId}
                isOpen={showVideo}
                onClose={() => setShowVideo(false)}
            />
        </>
    );
};

export default HeroSection;
