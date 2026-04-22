import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './Footer.css';

const Footer = () => {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h3 className="footer-title">HamroPanchanga</h3>
                    <p className="footer-description">
                        {t('footer.tagline')}
                    </p>
                </div>

                <div className="footer-section">
                    <h4 className="footer-heading">{t('footer.quickLinks')}</h4>
                    <ul className="footer-links">
                        <li><a href="#home">{t('footer.home')}</a></li>
                        <li><a href="#nepali-calendar-section">{t('footer.calendar')}</a></li>
                        <li><a href="/trees">{t('footer.treeBuilder')}</a></li>
                        <li><a href="/tithi-calculator">{t('footer.tithiCalculator')}</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4 className="footer-heading">{t('footer.contact')}</h4>
                    <p className="footer-text">
                        {t('footer.contactText')}
                    </p>
                    <p className="footer-text">
                        <a href="mailto:hamropanchanga@gmail.com">hamropanchanga@gmail.com</a>
                    </p>
                </div>
            </div>

            <div className="footer-bottom">
                <p className="footer-copyright">
                    &copy; {currentYear} {t('footer.copyright')}
                </p>
            </div>
        </footer>
    );
};

export default Footer;
