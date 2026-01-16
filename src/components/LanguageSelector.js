import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSelector = ({ showLabel = false, compact = false }) => {
  const { language, changeLanguage, t } = useLanguage();

  if (compact) {
    // Compact clickable labels style
    return (
      <div className="flex items-center space-x-2">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">
            {t('language.selectLanguage')}:
          </span>
        )}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => changeLanguage('ne')}
            className={`text-sm transition-all cursor-pointer ${
              language === 'ne' 
                ? 'text-blue-600 font-bold' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            aria-label="Switch to Nepali"
          >
            नेपाली
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => changeLanguage('en')}
            className={`text-sm transition-all cursor-pointer ${
              language === 'en' 
                ? 'text-blue-600 font-bold' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            aria-label="Switch to English"
          >
            English
          </button>
        </div>
      </div>
    );
  }

  // Button style
  return (
    <div className="language-selector">
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 mb-2 block">
          {t('language.selectLanguage')}
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeLanguage('ne')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            language === 'ne'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-pressed={language === 'ne'}
        >
          नेपाली
        </button>
        <button
          onClick={() => changeLanguage('en')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            language === 'en'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-pressed={language === 'en'}
        >
          English
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;
