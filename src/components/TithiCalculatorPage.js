import React from 'react';
import TithiCalculator from './TithiCalculator';
import './TithiCalculatorPage.css';

const TithiCalculatorPage = () => {
    return (
        <div className="tithi-calculator-page">
            <div className="tithi-page-header">
                <h1 className="tithi-page-title">Tithi Calculator</h1>
            </div>
            
            <div className="tithi-page-content">
                <div className="tithi-page-description">
                    <p>
                        Calculate the tithi (lunar day) based on the Sun and Moon's longitudinal positions.
                        The tithi represents the phase of the moon in the Hindu lunar calendar.
                    </p>
                </div>
                
                <div className="tithi-calculator-container">
                    <TithiCalculator />
                </div>
            </div>
        </div>
    );
};

export default TithiCalculatorPage;
