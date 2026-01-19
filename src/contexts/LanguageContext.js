import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../locales';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Default to English
  const [language, setLanguage] = useState('en');

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage && ['ne', 'en'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Save language preference to localStorage when it changes
  const changeLanguage = (newLanguage) => {
    if (['ne', 'en'].includes(newLanguage)) {
      setLanguage(newLanguage);
      localStorage.setItem('appLanguage', newLanguage);
    }
  };

  // Translation function with nested key support and fallback
  const t = (key, defaultValue = key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default value or key if translation not found
        return defaultValue;
      }
    }
    
    return value || defaultValue;
  };

  // Number translation function (converts to Nepali numerals if language is Nepali)
  const tn = (number) => {
    if (number === null || number === undefined) return '';
    
    if (language === 'ne') {
      return String(number)
        .split('')
        .map(char => {
          const num = translations.ne.numbers[char];
          return num || char;
        })
        .join('');
    }
    
    return String(number);
  };

  // Reverse function: convert Nepali numerals to English numbers
  const parseNepaliNumber = (nepaliNum) => {
    if (!nepaliNum) return '';
    
    const nepaliToEnglish = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };
    
    return String(nepaliNum)
      .split('')
      .map(char => nepaliToEnglish[char] || char)
      .join('');
  };

  const value = {
    language,
    changeLanguage,
    t,
    tn,
    parseNepaliNumber,
    isNepali: language === 'ne',
    isEnglish: language === 'en'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
