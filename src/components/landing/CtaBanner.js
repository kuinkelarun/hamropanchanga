import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const CtaBanner = ({ user, onStartTree, onSignIn }) => {
    const { t } = useLanguage();

    const heading = user ? t('landing.ctaLoggedInHeading') : t('landing.ctaLoggedOutHeading');
    const desc = user ? t('landing.ctaLoggedInDesc') : t('landing.ctaLoggedOutDesc');
    const buttonText = user ? t('landing.ctaLoggedInButton') : t('landing.ctaLoggedOutButton');
    const handleClick = user ? onStartTree : onSignIn;

    return (
        <section
            className="py-16 px-4 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
            <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">{heading}</h2>
                <p className="text-lg opacity-90 mb-8">{desc}</p>
                <button
                    onClick={handleClick}
                    className="bg-white font-bold py-3 px-8 rounded-full text-base transition-all hover:-translate-y-0.5 border-none cursor-pointer"
                    style={{
                        color: '#4c1d95',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }}
                >
                    {buttonText}
                </button>
            </div>
        </section>
    );
};

export default CtaBanner;
