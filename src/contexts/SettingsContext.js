import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    // Default to Nepali calendar as requested
    const [isNepaliCalendar, setIsNepaliCalendar] = useState(() => {
        // Load from localStorage if available, otherwise default to Nepali
        const saved = localStorage.getItem('calendarPreference');
        return saved ? JSON.parse(saved) : true;
    });

    // Admin Edit Mode for managing tithis and calendar events
    const [isEditMode, setIsEditMode] = useState(() => {
        // Load from localStorage if available, otherwise default to false
        const saved = localStorage.getItem('adminEditMode');
        return saved ? JSON.parse(saved) : false;
    });

    // Persist settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('calendarPreference', JSON.stringify(isNepaliCalendar));
    }, [isNepaliCalendar]);

    useEffect(() => {
        localStorage.setItem('adminEditMode', JSON.stringify(isEditMode));
    }, [isEditMode]);

    const toggleCalendarLanguage = () => {
        setIsNepaliCalendar(prev => !prev);
    };

    const toggleEditMode = () => {
        setIsEditMode(prev => !prev);
    };

    const value = {
        isNepaliCalendar,
        setIsNepaliCalendar,
        toggleCalendarLanguage,
        calendarLanguage: isNepaliCalendar ? 'nepali' : 'gregorian',
        isEditMode,
        setIsEditMode,
        toggleEditMode
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;