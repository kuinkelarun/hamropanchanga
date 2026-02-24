import React, { createContext, useContext } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    return (
        <SettingsContext.Provider value={{}}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;