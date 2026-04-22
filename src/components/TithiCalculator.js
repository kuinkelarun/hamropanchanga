import React, { useState, useEffect, useMemo } from 'react';
import './TithiCalculator.css';
import { computeTithiFromLongitudes, getEphemerisData } from '../utils/ephemeris';
import {
  toNepaliNumber, nepaliMonths, convertAdToBs,
  getTithiYearFromAdDate, getTithiLunarMonthName, getNepalDate
} from '../utils/nepaliDateUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { SHUKLA_TITHI_NAMES, KRISHNA_TITHI_NAMES, normalizePakshaToNepali, NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../constants/calendarConstants';
import NepaliMiniCalendar from './NepaliMiniCalendar';

// Returns { date: 'YYYY-MM-DD', time: 'HH:MM' } in the correct timezone for the given mode
function getNowForMode(mode) {
  if (mode === 'kathmandu') {
    const npt = getNepalDate(); // UTC fields = NPT values
    return {
      date: `${npt.getUTCFullYear()}-${String(npt.getUTCMonth() + 1).padStart(2, '0')}-${String(npt.getUTCDate()).padStart(2, '0')}`,
      time: `${String(npt.getUTCHours()).padStart(2, '0')}:${String(npt.getUTCMinutes()).padStart(2, '0')}`
    };
  }
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  };
}

export default function TithiCalculator() {
  const { t, isNepali } = useLanguage();
  const [moonLon, setMoonLon] = useState('');
  const [sunLon, setSunLon] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [userLat, setUserLat] = useState(null);
  const [userLon, setUserLon] = useState(null);
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [locationMode, setLocationMode] = useState('kathmandu');
  const [showInfo, setShowInfo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [currentMonthName, setCurrentMonthName] = useState('');

  function updateMonthForDateStr(adDateStr) {
    if (!adDateStr) return;
    const [y, m, d] = adDateStr.split('-').map(Number);
    const bsDate = convertAdToBs(y, m - 1, d);
    setCurrentMonth(bsDate.month);
    setCurrentMonthName(nepaliMonths[bsDate.month - 1]);
  }

  // On mount: initialize to Kathmandu time (default mode)
  useEffect(() => {
    const { date, time } = getNowForMode('kathmandu');
    setDateStr(date);
    setTimeStr(time);
    updateMonthForDateStr(date);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
          setLocationStatus('detected');
          // Switch to current location mode and reset date/time to local now
          setLocationMode('current');
          const { date: d2, time: t2 } = getNowForMode('current');
          setDateStr(d2);
          setTimeStr(t2);
          updateMonthForDateStr(d2);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocationStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('not supported');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user switches location mode, reset date/time to "now" in that timezone
  function handleLocationModeChange(mode) {
    setLocationMode(mode);
    const { date, time } = getNowForMode(mode);
    setDateStr(date);
    setTimeStr(time);
    updateMonthForDateStr(date);
    setResult(null);
  }

  // Update BS month label when dateStr changes
  useEffect(() => {
    updateMonthForDateStr(dateStr);
  }, [dateStr]);

  // BS date derived from dateStr for the picker button label
  const selectedBs = useMemo(() => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return convertAdToBs(y, m - 1, d);
  }, [dateStr]);

  const selectedBsLabel = useMemo(() => {
    if (!selectedBs) return t('tithiCalculator.date');
    const pad = (n) => String(n).padStart(2, '0');
    if (isNepali) {
      return `${toNepaliNumber(pad(selectedBs.day))}/${toNepaliNumber(pad(selectedBs.month))}/${toNepaliNumber(selectedBs.year)}`;
    }
    return `${pad(selectedBs.day)}/${pad(selectedBs.month)}/${selectedBs.year}`;
  }, [selectedBs, isNepali, t]);

  // Format a UTC ISO timestamp for display in the selected timezone
  function formatTime(isoString) {
    if (!isoString) return 'N/A';
    const options = {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZoneName: 'short'
    };
    if (locationMode === 'kathmandu') options.timeZone = 'Asia/Kathmandu';
    return new Date(isoString).toLocaleString('en-US', options);
  }

  async function onCompute(e) {
    e && e.preventDefault();
    setError('');
    setResult(null);

    if (!dateStr || !timeStr) {
      setError(t('tithiCalculator.selectValidDateTime'));
      return;
    }

    let m, s;
    let eph = null;

    try {
      // Always treat input as browser local time — tithis are geocentric so
      // location mode has no effect on the UTC evaluation moment.
      const dt = new Date(`${dateStr}T${timeStr}:00`);

      const lat = (locationMode === 'current' && locationStatus === 'detected') ? userLat : 27.7172;
      const lon = (locationMode === 'current' && locationStatus === 'detected') ? userLon : 85.3240;

      eph = await getEphemerisData(dt, lat, lon);
      m = eph.moonLon;
      s = eph.sunLon;
      setMoonLon(m.toFixed(6));
      setSunLon(s.toFixed(6));
    } catch (err) {
      console.error(err);
      setError(t('tithiCalculator.failedEphemeris'));
      return;
    }

    const res = computeTithiFromLongitudes(m, s);
    if (eph) {
      res.startTime = eph.tithiStart;
      res.endTime = eph.tithiEnd;
    }
    res.monthNumber = currentMonth;
    res.monthName = currentMonthName;

    try {
      const tithiStartDate = res.startTime ? new Date(res.startTime) : new Date(`${dateStr}T${timeStr}:00Z`);
      const adDateStr = tithiStartDate.toISOString().split('T')[0];
      const tithiYearInfo = getTithiYearFromAdDate(adDateStr, null, res.paksha, res.pakshaIndex);
      res.tithiYear = tithiYearInfo.tithiYear;
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
    const { date, time } = getNowForMode(locationMode);
    setDateStr(date);
    setTimeStr(time);
    updateMonthForDateStr(date);
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
              <p>{t('tithiCalculator.aboutDescription1')}</p>
              <p><strong>{t('tithiCalculator.aboutDescription2')}</strong></p>
            </div>
          </div>
        </div>
      )}

      <p className="tc-desc">{t('tithiCalculator.description')}</p>

      <div className="tc-location-selector" style={{ marginBottom: '1rem', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <label className="tc-label" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          {t('tithiCalculator.displayTimeIn')}
        </label>
        <div className="tc-radio-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <label className={`tc-radio-label ${locationMode === 'kathmandu' ? 'selected' : ''}`} style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="locationMode"
              value="kathmandu"
              checked={locationMode === 'kathmandu'}
              onChange={() => handleLocationModeChange('kathmandu')}
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
              onChange={() => handleLocationModeChange('current')}
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
          <div className="tc-field" style={{ position: 'relative' }}>
            <label className="tc-label">{t('tithiCalculator.date')} <span style={{ fontWeight: 'normal', color: '#6b7280', fontSize: '0.8rem' }}>(Nepali - DD/MM/YYYY)</span></label>
            <button
              type="button"
              className="tc-input tc-date-btn"
              onClick={() => setShowDatePicker(p => !p)}
              style={{ textAlign: 'left', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>{selectedBsLabel}</span>
              <span>&#128197;</span>
            </button>
            {showDatePicker && (
              <NepaliMiniCalendar
                value={dateStr}
                onChange={(ad) => { setDateStr(ad); setShowDatePicker(false); }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
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
          {result.tithiYear && (
            <div className="tc-month-banner" style={{ background: '#e8f4f8', borderColor: '#0891b2' }}>
              <div className="tc-month-name" style={{ color: '#0891b2' }}>{t('tithiCalculator.tithiYear')} {result.tithiYear}</div>
              <div className="tc-month-number" style={{ color: '#0891b2' }}>({result.tithiLunarMonthName || ''})</div>
            </div>
          )}

          <div className="tc-main-tithi">
            <div className="tithi-number">{toNepaliNumber(result.tithi)}</div>
            <div className="tithi-name">
              {(result.paksha === 'Shukla' ? SHUKLA_TITHI_NAMES : KRISHNA_TITHI_NAMES)[result.pakshaIndex - 1]}
            </div>
            <div className="tithi-paksha">
              {normalizePakshaToNepali(result.paksha)}
              {' '} | {t('tithiCalculator.tithiOf')} {result.tithi}/30
            </div>
            <div className="tc-progress-bar-container">
              <div className="tc-progress-bar" style={{ width: `${result.progress * 100}%` }}></div>
            </div>
            <div className="tc-progress-text">
              {(result.progress * 100).toFixed(1)}% {t('tithiCalculator.complete')}
            </div>
          </div>

          <div className="tc-result-card tc-timing-card">
            <h4>{t('tithiCalculator.tithiDuration')}</h4>
            <div className="tc-info-grid">
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.startTime')}</strong>
                <span style={{ fontWeight: '500' }}>{formatTime(result.startTime)}</span>
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  ({t(locationMode === 'kathmandu' ? 'tithiCalculator.nepalTime' : 'tithiCalculator.localTime')})
                </span>
              </div>
              <div className="tc-info-item">
                <strong>{t('tithiCalculator.endTime')}</strong>
                <span style={{ fontWeight: '500' }}>{formatTime(result.endTime)}</span>
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  ({t(locationMode === 'kathmandu' ? 'tithiCalculator.nepalTime' : 'tithiCalculator.localTime')})
                </span>
              </div>
            </div>
          </div>

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
