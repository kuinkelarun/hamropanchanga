import React from 'react';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    
    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h3 className="footer-title">My Family Tree</h3>
                    <p className="footer-description">
                        Connect your past. Branch out your future.
                    </p>
                </div>
                
                <div className="footer-section">
                    <h4 className="footer-heading">Quick Links</h4>
                    <ul className="footer-links">
                        <li><a href="#home">Home</a></li>
                        <li><a href="#branches">Branches</a></li>
                        <li><a href="#events">Events</a></li>
                    </ul>
                </div>
                
                <div className="footer-section">
                    <h4 className="footer-heading">Contact</h4>
                    <p className="footer-text">
                        For support and inquiries
                    </p>
                    <p className="footer-text">
                        familytree@example.com
                    </p>
                </div>
            </div>
            
            <div className="footer-bottom">
                <p className="footer-copyright">
                    © {currentYear} My Family Tree. All rights reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;
