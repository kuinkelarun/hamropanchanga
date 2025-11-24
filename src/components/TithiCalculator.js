import React, { useState, useEffect } from 'react';
import './TithiCalculator.css';
import { computeTithiFromLongitudes, getEphemerisData } from '../utils/ephemeris';
import { convertAdToBs, nepaliMonths, toNepaliNumber } from '../utils/nepaliDateUtils';

// Nepali Tithi names
const shuklaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"];
const krishnaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"];

// Convert number to Devanagari numerals
function toDevanagari(num) {
  return num.toString().replace(/\d/g, d => '०१२३४५६७८९'[d]);
}

// Convert 24-hour time (HH:MM:SS) to 12-hour format with AM/PM
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes, seconds] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds || 0).padStart(2, '0')} ${period}`;
}

// Format UTC datetime string to Nepali date and time relative to user's local timezone
function formatNepaliDateTime(utcDateTimeStr) {
  if (!utcDateTimeStr) return 'N/A';
  
  const utcDate = new Date(utcDateTimeStr);
  
  // Get user's local timezone offset in hours (positive means ahead of UTC)
  const localOffsetMinutes = utcDate.getTimezoneOffset();
  const localOffsetHours = -localOffsetMinutes / 60;
  
  // Nepal offset is +5.75 hours from UTC
  const nepalOffsetHours = 5.75;
  
  // Calculate time difference between user's local time and Nepal time
  const timeDiffHours = nepalOffsetHours - localOffsetHours;
  
  // Convert UTC to Nepal time
  const nepalTimestamp = utcDate.getTime() + (timeDiffHours * 60 * 60 * 1000);
  const nepalDate = new Date(nepalTimestamp);
  
  // Use Nepal local date/time components
  const year = nepalDate.getFullYear();
  const month = nepalDate.getMonth(); // 0-based
  const day = nepalDate.getDate();
  const hours = nepalDate.getHours();
  const minutes = nepalDate.getMinutes();
  const seconds = nepalDate.getSeconds();
  
  // Convert AD date to BS date
  const bsDate = convertAdToBs(year, month, day);
  if (!bsDate) return 'N/A';
  
  // Format Nepali date
  const nepaliDateStr = `${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.day)}, ${toNepaliNumber(bsDate.year)}`;
  
  // Format Nepal local time in 12-hour format with seconds
  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const time12 = formatTime12Hour(time24);
  
  return `${nepaliDateStr}, ${time12}`;
}

export default function TithiCalculator() {
  const [mode, setMode] = useState('auto'); // 'auto' or 'manual'
  const [moonLon, setMoonLon] = useState('');
  const [sunLon, setSunLon] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [userLat, setUserLat] = useState(null);
  const [userLon, setUserLon] = useState(null);
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [showInfo, setShowInfo] = useState(false);

  // Initialize date/time to now and detect location
  useEffect(() => {
    const now = new Date();
    setDateStr(now.toISOString().split('T')[0]);
    // Format time as HH:MM
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);

    // Detect user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
          setLocationStatus('detected');
        },
        (err) => {
          console.error('Geolocation error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('denied');
          } else {
            setLocationStatus('error');
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('not supported');
    }
  }, []);

  async function onCompute(e) {
    e && e.preventDefault();
    setError('');
    setResult(null);

    let m, s;
    let eph = null;

    if (mode === 'manual') {
      m = parseFloat(String(moonLon).trim());
      s = parseFloat(String(sunLon).trim());
      if (Number.isNaN(m) || Number.isNaN(s)) {
        setError('Please enter numeric Moon and Sun longitudes in degrees (0-360).');
        return;
      }
    } else {
      // Auto mode
      if (!dateStr || !timeStr) {
        setError('Please select a valid date and time.');
        return;
      }
      try {
        const dt = new Date(`${dateStr}T${timeStr}:00`);
        eph = await getEphemerisData(dt, userLat, userLon);
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
    }

    const res = computeTithiFromLongitudes(m, s);
    if (mode === 'auto' && eph) {
      res.startTime = eph.tithiStart;
      res.endTime = eph.tithiEnd;
    }
    setResult(res);
  }

  function onClear() {
    setMoonLon(''); 
    setSunLon(''); 
    setResult(null); 
    setError('');
    if (mode === 'auto') {
      const now = new Date();
      setDateStr(now.toISOString().split('T')[0]);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}`);
    }
  }

  return (
    <div className="tc-root">
      <div className="tc-header">
        <h3 className="tc-title">Tithi Calculator</h3>
        <button className="tc-info-btn" onClick={() => setShowInfo(!showInfo)} title="Click for more information about Tithi Calculator">
          ℹ️
        </button>
      </div>
      
      {showInfo && (
        <div className="tc-modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="tc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h4>About Tithi Calculator</h4>
              <button className="tc-modal-close" onClick={() => setShowInfo(false)}>×</button>
            </div>
            <div className="tc-modal-body">
              <p>
                The Tithi Calculator computes the lunar day (Tithi) in the Hindu calendar, which is essential for religious and cultural events. 
                Tithi is determined by the angular distance between the Moon and Sun in the ecliptic plane.
              </p>
              <p>
                <strong>Automatic Mode:</strong> Enter a date and time to automatically calculate Sun and Moon ecliptic longitudes using 
                high-precision astronomical data. This mode uses your device's location for topocentric calculations, providing more accurate 
                results by accounting for your position on Earth. If location access is denied, it defaults to Kathmandu, Nepal coordinates.
              </p>
              <p>
                <strong>Manual Mode:</strong> Directly input Moon and Sun longitudes to compute Tithi using the formula: 
                Tithi = floor((Moon Longitude - Sun Longitude) / 12°) + 1.
              </p>
              <p>
                <strong>Location Data Usage:</strong> Your location (latitude and longitude) is used only for astronomical calculations 
                and is not stored or shared. It helps generate precise Tithi values for your specific geographic position.
              </p>
              <p>
                This tool helps users determine auspicious times for festivals, ceremonies, and daily activities based on lunar cycles.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="tc-mode-switch">
        <button 
          className={`tc-mode-btn ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => { setMode('auto'); setError(''); setResult(null); }}
        >
          Automatic (Date/Time)
        </button>
        <button 
          className={`tc-mode-btn ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => { setMode('manual'); setError(''); setResult(null); }}
        >
          Manual (Longitudes)
        </button>
      </div>

      <p className="tc-desc">
        {mode === 'auto' 
          ? 'Select a date and time to automatically calculate Tithi.' 
          : 'Enter geocentric ecliptic longitudes (degrees) for Moon and Sun.'}
      </p>

      {mode === 'auto' && (
        <div className="tc-location-status">
          <strong>Location:</strong> 
          {locationStatus === 'detecting' && ' Detecting...'}
          {locationStatus === 'detected' && ` Detected (${userLat?.toFixed(4)}, ${userLon?.toFixed(4)})`}
          {locationStatus === 'denied' && ' Permission denied. Using default location (Kathmandu).'}
          {locationStatus === 'error' && ' Error detecting location. Using default location (Kathmandu).'}
          {locationStatus === 'not supported' && ' Geolocation not supported. Using default location (Kathmandu).'}
        </div>
      )}

      <form className="tc-form" onSubmit={onCompute}>
        {mode === 'auto' && (
          <div className="tc-datetime-group">
            <div className="tc-field">
              <label className="tc-label">Date</label>
              <input 
                type="date" 
                className="tc-input" 
                value={dateStr} 
                onChange={e => setDateStr(e.target.value)} 
              />
            </div>
            <div className="tc-field">
              <label className="tc-label">Time</label>
              <input 
                type="time" 
                className="tc-input" 
                value={timeStr} 
                onChange={e => setTimeStr(e.target.value)} 
              />
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <>
            <label className="tc-label">Moon Longitude (°)</label>
            <input className="tc-input" value={moonLon} onChange={e=>setMoonLon(e.target.value)} placeholder="e.g. 130.1234" />

            <label className="tc-label">Sun Longitude (°)</label>
            <input className="tc-input" value={sunLon} onChange={e=>setSunLon(e.target.value)} placeholder="e.g. 100.5678" />
          </>
        )}

        <div className="tc-actions">
          <button type="submit" className="tc-btn">Compute</button>
          <button type="button" className="tc-btn tc-btn-muted" onClick={onClear}>Clear</button>
        </div>
      </form>

      {error && <div className="tc-error">{error}</div>}

      {result && (
        <div className="tc-output">
          {mode === 'auto' && (
            <div className="tc-calc-details">
              <div><strong>Calculated Moon Lon:</strong> {parseFloat(moonLon).toFixed(4)}°</div>
              <div><strong>Calculated Sun Lon:</strong> {parseFloat(sunLon).toFixed(4)}°</div>
              <hr className="tc-divider"/>
            </div>
          )}
          <div><strong>Normalized difference (°):</strong> {result.Dnorm.toFixed(6)}</div>
          <div><strong>Fractional tithi (0..30):</strong> {result.t_frac.toFixed(6)}</div>
          <div><strong>Tithi (1..30):</strong> {result.tithi} ({result.paksha} {result.pakshaIndex})</div>
          <div><strong>Tithi (१..३०):</strong> {toDevanagari(result.tithi)} ({result.paksha === 'Shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष'} {(result.paksha === 'Shukla' ? shuklaNames : krishnaNames)[result.pakshaIndex - 1]})</div>
          <div><strong>Progress through tithi:</strong> {(result.progress * 100).toFixed(2)}%</div>
          <div><strong>Tithi start:</strong> {result.startTime ? new Date(result.startTime).toLocaleString() : 'N/A'}</div>
          <div><strong>Tithi end:</strong> {result.endTime ? new Date(result.endTime).toLocaleString() : 'N/A'}</div>
          {result.startTime && result.endTime && (
            <>
              <div><strong>आरम्भ मिति/काल (Start Date/Time):</strong> {formatNepaliDateTime(result.startTime)}</div>
              <div><strong>समाप्ति मिति/काल (End Date/Time):</strong> {formatNepaliDateTime(result.endTime)}</div>
            </>
          )}
        </div>
      )}

      <div className="tc-note">
        Note: {mode === 'auto' 
          ? 'Calculations use the "astronomy-engine" library for high-precision ephemeris data (Apparent Geocentric Ecliptic of Date).' 
          : 'This tool accepts longitudes directly and applies the canonical tithi formula: (MoonLon − SunLon)/12°.'}
      </div>
    </div>
  );
}
