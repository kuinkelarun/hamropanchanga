import React, { useState, useEffect } from 'react';
import './TithiCalculator.css';
import { computeTithiFromLongitudes, getEphemerisData } from '../utils/ephemeris';
import { toNepaliNumber, formatNepaliDateTime, nepaliMonths, convertAdToBs, getTithiYearFromAdDate, getTithiLunarMonthName } from '../utils/nepaliDateUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { SHUKLA_TITHI_NAMES, KRISHNA_TITHI_NAMES } from '../constants/calendarConstants';

export default function TithiCalculator() {
  const { t } = useLanguage();
  const [moonLon, setMoonLon] = useState('');
  const [sunLon, setSunLon] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [userLat, setUserLat] = useState(null);
  const [userLon, setUserLon] = useState(null);
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [locationMode, setLocationMode] = useState('kathmandu'); // 'current' or 'kathmandu'
  const [showInfo, setShowInfo] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [currentMonthName, setCurrentMonthName] = useState('');

  // Helper function to get BS month from AD date
  function getBsMonthFromAdDate(adYear, adMonth, adDay) {
    const bsDate = convertAdToBs(adYear, adMonth, adDay);
    return bsDate.month;
  }
  
  // Helper function to update month based on a date
  function updateMonthForDate(date) {
    const adYear = date.getFullYear();
    const adMonth = date.getMonth();
    const adDay = date.getDate();
    const bsMonth = getBsMonthFromAdDate(adYear, adMonth, adDay);
    setCurrentMonth(bsMonth);
    setCurrentMonthName(nepaliMonths[bsMonth - 1]);
  }

  // Initialize date/time to now and detect location
  useEffect(() => {
    const now = new Date();
    setDateStr(now.toISOString().split('T')[0]);
    // Format time as HH:MM
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
    
    // Initialize current month based on today's date
    updateMonthForDate(now);

    // Detect user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
          setLocationStatus('detected');
          // Default to current location if detected successfully
          setLocationMode('current');
        },
        (err) => {
          console.error('Geolocation error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('denied');
          } else {
            setLocationStatus('error');
          }
          // Fallback to Kathmandu is automatic via locationMode default or explicit selection
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('not supported');
    }
  }, []);

  // Update month when date changes
  useEffect(() => {
    if (dateStr) {
      const selectedDate = new Date(dateStr);
      updateMonthForDate(selectedDate);
    }
  }, [dateStr]);

  async function onCompute(e) {
    e && e.preventDefault();
    setError('');
    setResult(null);

    let m, s;
    let eph = null;

    // Auto mode
    if (!dateStr || !timeStr) {
      setError(t('tithiCalculator.selectValidDateTime'));
      return;
    }
    try {
      let dt;
      if (locationMode === 'kathmandu') {
        // Treat input as Kathmandu Time (UTC+05:45)
        dt = new Date(`${dateStr}T${timeStr}:00+05:45`);
      } else {
        // Treat input as Local Time
        dt = new Date(`${dateStr}T${timeStr}:00`);
      }
      
      // Determine coordinates based on location mode
      let lat = null;
      let lon = null;
      
      if (locationMode === 'current' && locationStatus === 'detected') {
        lat = userLat;
        lon = userLon;
      } else {
        // Kathmandu coordinates
        lat = 27.7172;
        lon = 85.3240;
      }

      eph = await getEphemerisData(dt, lat, lon);
      m = eph.moonLon;
      s = eph.sunLon;
      // Update the manual fields to show what was calculated
      setMoonLon(m.toFixed(6));
      setSunLon(s.toFixed(6));
    } catch (err) {
      console.error(err);
      setError('Failed to calculate ephemeris data.');
      return;
    }

    const res = computeTithiFromLongitudes(m, s);
    if (eph) {
      res.startTime = eph.tithiStart;
      res.endTime = eph.tithiEnd;
    }
    // Add month information to result
    res.monthNumber = currentMonth;
    res.monthName = currentMonthName;
    
    // Add Tithi Year information
    // Use the start time of the tithi for Tithi Year determination
    try {
      const tithiStartDate = res.startTime ? new Date(res.startTime) : new Date(`${dateStr}T${timeStr}:00Z`);
      const adDateStr = tithiStartDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Pass the calculated paksha to get accurate year
      const tithiYearInfo = getTithiYearFromAdDate(adDateStr, null, res.paksha, res.pakshaIndex);
      res.tithiYear = tithiYearInfo.tithiYear;
      
      // Get Tithi Lunar Month name based on paksha and current solar month
      const lunarMonthName = getTithiLunarMonthName(res.paksha, res.pakshaIndex, adDateStr);
      res.tithiLunarMonthName = lunarMonthName;
    } catch (err) {
      console.error('Error calculating Tithi Year/Month:', err);
      res.tithiYear = null;
      res.tithiLunarMonthName = null;
    }
    
    setResult(res);
  }

  function onClear() {
    setMoonLon(''); 
    setSunLon(''); 
    setResult(null); 
    setError('');
    const now = new Date();
    setDateStr(now.toISOString().split('T')[0]);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
    updateMonthForDate(now);
  }

  return (
    <div className="tc-root">
      <div className="tc-header">
        <h3 className="tc-title">{t('tithiCalculator.title')}</h3>
        <button className="tc-info-btn" onClick={() => setShowInfo(!showInfo)} title={t('tithiCalculator.infoButtonTitle')}>
          i
        </button>
      </div>
      
      {showInfo && (
        <div className="tc-modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="tc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h4>{t('tithiCalculator.aboutTitle')}</h4>
              <button className="tc-modal-close" onClick={() => setShowInfo(false)}>×</button>
            </div>
            <div className="tc-modal-body">
              <p>
                {t('tithiCalculator.aboutDescription1')}
              </p>
              <p>
                <strong>{t('tithiCalculator.aboutDescription2')}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
      
      <p className="tc-desc">
        {t('tithiCalculator.description')}
      </p>

      <div className="tc-location-selector" style={{ marginBottom: '1rem', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <label className="tc-label" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('tithiCalculator.location')}</label>
        <div className="tc-radio-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <label className={`tc-radio-label ${locationMode === 'kathmandu' ? 'selected' : ''}`} style={{ cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="locationMode" 
              value="kathmandu" 
              checked={locationMode === 'kathmandu'} 
              onChange={() => setLocationMode('kathmandu')}
              style={{ marginRight: '5px' }}
            />
            {t('tithiCalculator.kathmanduNepal')}
          </label>
          <label 
            className={`tc-radio-label ${locationMode === 'current' ? 'selected' : ''} ${locationStatus !== 'detected' ? 'disabled' : ''}`}
            style={{ cursor: locationStatus === 'detected' ? 'pointer' : 'not-allowed', opacity: locationStatus === 'detected' ? 1 : 0.6 }}
          >
            <input 
              type="radio" 
              name="locationMode" 
              value="current" 
              checked={locationMode === 'current'} 
              onChange={() => setLocationMode('current')}
              disabled={locationStatus !== 'detected'}
              style={{ marginRight: '5px' }}
            />
            {t('tithiCalculator.currentLocation')}
            {locationStatus === 'detected' ? '' : ` ${t('tithiCalculator.notAvailable')}`}
          </label>
        </div>
        {locationMode === 'current' && locationStatus === 'detected' && (
          <div className="tc-location-coords" style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
            {t('tithiCalculator.using')} {userLat?.toFixed(4)}, {userLon?.toFixed(4)}
          </div>
        )}
      </div>

      <form className="tc-form" onSubmit={onCompute}>
        <div className="tc-datetime-group">
          <div className="tc-field">
            <label className="tc-label">{t('tithiCalculator.date')}</label>
            <input 
              type="date" 
              className="tc-input" 
              value={dateStr} 
              onChange={e => setDateStr(e.target.value)} 
            />
          </div>
          <div className="tc-field">
            <label className="tc-label">{t('tithiCalculator.time')}</label>
            <input 
              type="time" 
              className="tc-input" 
              value={timeStr} 
              onChange={e => setTimeStr(e.target.value)} 
            />
          </div>
        </div>

        <div className="tc-actions">
          <button type="submit" className="tc-btn">{t('tithiCalculator.compute')}</button>
          <button type="button" className="tc-btn tc-btn-muted" onClick={onClear}>{t('tithiCalculator.clear')}</button>
        </div>
      </form>

      {error && <div className="tc-error">{error}</div>}

      {result && (
        <div className="tc-output">
          {/* Tithi Year Display */}
          {result.tithiYear && (
            <div className="tc-month-banner" style={{background: '#e8f4f8', borderColor: '#0891b2'}}>
              <div className="tc-month-name" style={{color: '#0891b2'}}>{t('tithiCalculator.tithiYear')} {result.tithiYear}</div>
              <div className="tc-month-number" style={{color: '#0891b2'}}>({result.tithiLunarMonthName || 'Unknown'})</div>
            </div>
          )}

          {/* Main Tithi Display */}
          <div className="tc-main-tithi">
            <div className="tithi-number">{toNepaliNumber(result.tithi)}</div>
            <div className="tithi-name">
              {(result.paksha === 'Shukla' ? SHUKLA_TITHI_NAMES : KRISHNA_TITHI_NAMES)[result.pakshaIndex - 1]}
            </div>
            <div className="tithi-paksha">
              {result.paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष'} 
              {' '} | Tithi {result.tithi}/30
            </div>
            <div className="tc-progress-bar-container">
              <div className="tc-progress-bar" style={{width: `${result.progress * 100}%`}}></div>
            </div>
            <div className="tc-progress-text">
              {(result.progress * 100).toFixed(1)}% Complete
            </div>
          </div>

          {/* Timing Information */}
          <div className="tc-result-card tc-timing-card">
            <h4>{t('tithiCalculator.tithiDuration')}</h4>
            <div className="tc-info-grid">
              <div className="tc-info-item">
                <strong>Start Time</strong>
                {/* Local Time */}
                <div style={{marginBottom: '4px'}}>
                  <span style={{fontWeight: '500'}}>
                    {result.startTime ? new Date(result.startTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZoneName: 'short'
                    }) : 'N/A'}
                  </span>
                  <span style={{fontSize: '0.75rem', color: '#666', marginLeft: '4px'}}>(Local)</span>
                </div>
                {/* UTC Time */}
                <div style={{fontSize: '0.85rem', color: '#6b7280'}}>
                  <span>
                    {result.startTime ? new Date(result.startTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'UTC', timeZoneName: 'short'
                    }) : ''}
                  </span>
                </div>
              </div>
              
              <div className="tc-info-item">
                <strong>End Time</strong>
                {/* Local Time */}
                <div style={{marginBottom: '4px'}}>
                  <span style={{fontWeight: '500'}}>
                    {result.endTime ? new Date(result.endTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZoneName: 'short'
                    }) : 'N/A'}
                  </span>
                  <span style={{fontSize: '0.75rem', color: '#666', marginLeft: '4px'}}>(Local)</span>
                </div>
                {/* UTC Time */}
                <div style={{fontSize: '0.85rem', color: '#6b7280'}}>
                  <span>
                    {result.endTime ? new Date(result.endTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'UTC', timeZoneName: 'short'
                    }) : ''}
                  </span>
                </div>
              </div>
            </div>
            {result.startTime && result.endTime && (
              <div style={{marginTop: '12px', padding: '8px', background: 'rgba(255,255,255,0.5)', borderRadius: '4px'}}>
                <div style={{fontSize: '0.85rem', color: '#92400e'}}>
                  <strong>आरम्भ (Nepal Time):</strong> {formatNepaliDateTime(result.startTime)?.formatted ?? 'N/A'}
                </div>
                <div style={{fontSize: '0.85rem', color: '#92400e', marginTop: '4px'}}>
                  <strong>समाप्ति (Nepal Time):</strong> {formatNepaliDateTime(result.endTime)?.formatted ?? 'N/A'}
                </div>
              </div>
            )}
          </div>

          {/* Technical Details */}
          <div className="tc-result-card">
            <h4>{t('tithiCalculator.astronomicalData')}</h4>
            <div className="tc-info-grid">
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.moonLongitude')}</strong>
                <span>{parseFloat(moonLon).toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.sunLongitude')}</strong>
                <span>{parseFloat(sunLon).toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.angularDifference')}</strong>
                <span>{result.Dnorm.toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.fractionalTithi')}</strong>
                <span>{result.t_frac.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tc-note">
        <strong>{t('tithiCalculator.notePrefix')}</strong> {t('tithiCalculator.noteText')} <strong>{t('tithiCalculator.modernAstronomy')}</strong> {t('tithiCalculator.modernAstronomyText')}
      </div>
    </div>
  );
}
