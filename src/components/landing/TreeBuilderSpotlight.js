import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import useInView from '../../hooks/useInView';
import heroImage from '../hero-image.png';

const bullets = [
    'landing.spotlightBullet1',
    'landing.spotlightBullet2',
    'landing.spotlightBullet3',
    'landing.spotlightBullet4',
];

const TreeBuilderSpotlight = ({ onNavigateToTrees }) => {
    const { t } = useLanguage();
    const [ref, isInView] = useInView();

    return (
        <section
            ref={ref}
            className="py-16 px-4"
            style={{ background: 'linear-gradient(180deg, #f7fafc 0%, #eef2ff 100%)' }}
        >
            <div className={`max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10 animate-on-scroll ${isInView ? 'visible' : ''}`}>
                {/* Browser frame mockup */}
                <div className="flex-1 w-full md:max-w-lg">
                    <div
                        className="rounded-xl overflow-hidden"
                        style={{
                            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        {/* Browser bar */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                            <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
                            <span className="ml-3 text-xs text-gray-400 flex-1 text-center">hamropanchanga.web.app</span>
                        </div>
                        <img
                            src={heroImage}
                            alt="Family tree builder interface"
                            className="w-full block"
                            loading="lazy"
                        />
                    </div>
                </div>

                {/* Copy */}
                <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                        {t('landing.spotlightHeading')}
                    </h2>
                    <ul className="space-y-4 mb-8">
                        {bullets.map((key, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#667eea' }} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="text-gray-700">{t(key)}</span>
                            </li>
                        ))}
                    </ul>
                    <button
                        className="hero-cta-primary"
                        onClick={onNavigateToTrees}
                        style={{ fontSize: '0.95rem' }}
                    >
                        {t('landing.spotlightCta')}
                    </button>
                </div>
            </div>
        </section>
    );
};

export default TreeBuilderSpotlight;
