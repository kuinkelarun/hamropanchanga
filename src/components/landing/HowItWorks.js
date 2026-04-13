import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import useInView from '../../hooks/useInView';

const steps = [
    { num: 1, titleKey: 'landing.step1Title', descKey: 'landing.step1Desc' },
    { num: 2, titleKey: 'landing.step2Title', descKey: 'landing.step2Desc' },
    { num: 3, titleKey: 'landing.step3Title', descKey: 'landing.step3Desc' },
];

const HowItWorks = () => {
    const { t } = useLanguage();
    const [ref, isInView] = useInView();

    return (
        <section
            ref={ref}
            className="py-16 px-4"
            style={{ background: '#ffffff' }}
        >
            <div className="max-w-4xl mx-auto">
                <h2 className="section-heading">{t('landing.howItWorksHeading')}</h2>
                <p className="section-subheading">{t('landing.howItWorksSubheading')}</p>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-4">
                    {steps.map((step, i) => (
                        <React.Fragment key={step.num}>
                            <div
                                className={`flex-1 flex flex-col items-center text-center animate-on-scroll ${isInView ? 'visible' : ''}`}
                                style={{ transitionDelay: `${i * 0.15}s` }}
                            >
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4"
                                    style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                                >
                                    {step.num}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{t(step.titleKey)}</h3>
                                <p className="text-sm text-gray-600 leading-relaxed max-w-xs">{t(step.descKey)}</p>
                            </div>

                            {/* Connector */}
                            {i < steps.length - 1 && (
                                <div className="hidden md:flex items-center justify-center flex-shrink-0 w-12">
                                    <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                                        <path d="M0 6h32m0 0l-6-5m6 5l-6 5" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
