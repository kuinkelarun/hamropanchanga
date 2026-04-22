import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import useInView from '../../hooks/useInView';

const features = [
    {
        titleKey: 'landing.featureTreeTitle',
        descKey: 'landing.featureTreeDesc',
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2.5" />
                <circle cx="6" cy="17" r="2.5" />
                <circle cx="18" cy="17" r="2.5" />
                <path d="M12 7.5v4m0 0l-6 5.5m6-5.5l6 5.5" />
            </svg>
        ),
        action: 'navigate',
        to: '/trees',
    },
    {
        titleKey: 'landing.featureCalendarTitle',
        descKey: 'landing.featureCalendarDesc',
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
        ),
        action: 'scroll',
        to: '#nepali-calendar-section',
    },
    {
        titleKey: 'landing.featureEventsTitle',
        descKey: 'landing.featureEventsDesc',
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
        ),
        action: 'navigate',
        to: '/events',
    },
    {
        titleKey: 'landing.featureTithiTitle',
        descKey: 'landing.featureTithiDesc',
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3a9 9 0 010 18" fill="currentColor" fillOpacity="0.15" />
                <path d="M12 7v5l3 3" />
            </svg>
        ),
        action: 'navigate',
        to: '/tithi-calculator',
    },
];

const FeatureShowcase = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [ref, isInView] = useInView();

    const handleClick = (feature) => {
        if (feature.action === 'scroll') {
            const el = document.querySelector(feature.to);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else {
            navigate(feature.to);
        }
    };

    return (
        <section
            ref={ref}
            className="py-16 px-4"
            style={{ background: '#ffffff' }}
        >
            <div className="max-w-5xl mx-auto">
                <h2 className="section-heading">{t('landing.featuresHeading')}</h2>
                <p className="section-subheading">{t('landing.featuresSubheading')}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className={`glass-card interactive-card p-6 text-center animate-on-scroll ${isInView ? 'visible' : ''}`}
                            style={{ transitionDelay: `${i * 0.1}s`, cursor: 'pointer' }}
                            onClick={() => handleClick(feature)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleClick(feature); }}
                        >
                            <div
                                className="mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}
                            >
                                {feature.icon}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t(feature.titleKey)}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">{t(feature.descKey)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeatureShowcase;
