import React, { useState, useEffect } from 'react';
import { convertAdToBs, convertBsToAd, toNepaliNumber, getNepalDate, minBsYear, maxBsYear } from '../utils/nepaliDateUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../constants/calendarConstants';
import './NepaliDatePicker.css';

const NepaliDatePicker = ({ value, onChange, label, required = false }) => {
  const { t, tn, isNepali } = useLanguage();
  
  // Default to current Nepali date
  const nptNow = getNepalDate();
  const todayBs = convertAdToBs(nptNow.getFullYear(), nptNow.getMonth(), nptNow.getDate());
  const [bsDate, setBsDate] = useState(todayBs);
  const [adValue, setAdValue] = useState(value || '');

  // Initialize from AD value
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      const bs = convertAdToBs(y, m - 1, d); // m-1 because convertAdToBs expects 0-indexed month
      setBsDate(bs);
      setAdValue(value);
    } else {
      // Default to today's date in Nepal (NPT)
      setBsDate(todayBs);
      setAdValue('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (field, val) => {
    const newBs = { ...bsDate, [field]: Number(val) };
    setBsDate(newBs);
    
    // Convert to AD and update
    const ad = convertBsToAd(newBs.year, newBs.month, newBs.day);
    
    if (ad) {
      // ad.month is 0-indexed (0=Jan, 11=Dec), so add 1 for YYYY-MM-DD string format
      const formatted = `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
      setAdValue(formatted);
      onChange?.(formatted);
    }
  };

  return (
    <div className="nepali-date-picker">
      {label && <label>{label}{required && ' *'}</label>}
      <div className="nepali-date-inputs">
        <select value={bsDate.year} onChange={(e) => handleChange('year', e.target.value)}>
          {Array.from({ length: maxBsYear - minBsYear + 1 }, (_, i) => {
            const year = minBsYear + i;
            return <option key={year} value={year}>{isNepali ? toNepaliNumber(year) : year}</option>;
          })}
        </select>
        
        <select value={bsDate.month} onChange={(e) => handleChange('month', e.target.value)}>
          {NEPALI_MONTHS.map((month, i) => {
            const displayMonth = isNepali ? month : ENGLISH_NEPALI_MONTHS[i];
            return <option key={i + 1} value={i + 1}>{displayMonth}</option>;
          })}
        </select>
        
        <select value={bsDate.day} onChange={(e) => handleChange('day', e.target.value)}>
          {[...Array(32)].map((_, i) => {
            const day = i + 1;
            return <option key={day} value={day}>{isNepali ? toNepaliNumber(day) : day}</option>;
          })}
        </select>
      </div>
      <div className="nepali-date-ad-display">
        <small>{t('calendar.adLabel')} {isNepali && adValue ? adValue.split('').map(char => /\d/.test(char) ? tn(Number(char)) : char).join('') : adValue}</small>
      </div>
    </div>
  );
};

export default NepaliDatePicker;
