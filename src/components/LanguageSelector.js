import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSelector = ({ showLabel = false, compact = false }) => {
  const { language, changeLanguage, t } = useLanguage();

  if (compact) {
    // Compact toggle style (like calendar toggle)
    return (
      <div className="flex items-center space-x-2">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">
            {t('language.selectLanguage')}:
          </span>
        )}
        <div className="flex items-center space-x-2">
          <span className={`text-sm ${language === 'ne' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
            नेपाली
          </span>
          <button
            type="button"
            onClick={() => changeLanguage(language === 'ne' ? 'en' : 'ne')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              language === 'ne' ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            aria-label="Toggle language"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                language === 'ne' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${language === 'en' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
            English
          </span>
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
