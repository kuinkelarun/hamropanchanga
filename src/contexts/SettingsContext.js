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
    // Admin Edit Mode for managing tithis and calendar events
    const [isEditMode, setIsEditMode] = useState(() => {
        // Load from localStorage if available, otherwise default to false
        const saved = localStorage.getItem('adminEditMode');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('adminEditMode', JSON.stringify(isEditMode));
    }, [isEditMode]);

    const toggleEditMode = () => {
        setIsEditMode(prev => !prev);
    };

    const value = {
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