import React, { useState, useEffect } from 'react';
import './TithiCalculator.css';
import { computeTithiFromLongitudes, getEphemerisData } from '../utils/ephemeris';
import { toNepaliNumber, formatNepaliDateTime } from '../utils/nepaliDateUtils';

// Nepali Tithi names
const shuklaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"];
const krishnaNames = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"];

export default function TithiCalculator() {
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

  async function onCompute(e) {
    e && e.preventDefault();
    setError('');
    setResult(null);

    let m, s;
    let eph = null;

    // Auto mode
    if (!dateStr || !timeStr) {
      setError('Please select a valid date and time.');
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
  }

  return (
    <div className="tc-root">
      <div className="tc-header">
        <h3 className="tc-title">Tithi Calculator</h3>
        <button className="tc-info-btn" onClick={() => setShowInfo(!showInfo)} title="Click for more information about Tithi Calculator">
          i
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
                The Tithi Calculator computes the lunar day (Tithi) in the Hindu calendar.
                Tithi is determined by the angular distance between the Moon and Sun in the ecliptic plane.
              </p>
              <p>
                <strong>Modern (Drik):</strong> Uses high-precision NASA/JPL ephemeris data (astronomy-engine) to calculate positions. This corresponds to the physical reality of the planets.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <p className="tc-desc">
        Select a date and time to calculate Tithi using modern high-precision astronomy (NASA/JPL).
      </p>

      <div className="tc-location-selector" style={{ marginBottom: '1rem', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <label className="tc-label" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Location:</label>
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
            Kathmandu, Nepal
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
            Current Location 
            {locationStatus === 'detected' ? '' : ' (Not available)'}
          </label>
        </div>
        {locationMode === 'current' && locationStatus === 'detected' && (
          <div className="tc-location-coords" style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
            Using: {userLat?.toFixed(4)}, {userLon?.toFixed(4)}
          </div>
        )}
      </div>

      <form className="tc-form" onSubmit={onCompute}>
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

        <div className="tc-actions">
          <button type="submit" className="tc-btn">Compute</button>
          <button type="button" className="tc-btn tc-btn-muted" onClick={onClear}>Clear</button>
        </div>
      </form>

      {error && <div className="tc-error">{error}</div>}

      {result && (
        <div className="tc-output">
          {/* Main Tithi Display */}
          <div className="tc-main-tithi">
            <div className="tithi-number">{toNepaliNumber(result.tithi)}</div>
            <div className="tithi-name">
              {(result.paksha === 'Shukla' ? shuklaNames : krishnaNames)[result.pakshaIndex - 1]}
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
            <h4>⏰ Tithi Duration</h4>
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
            <h4>🔬 Astronomical Data</h4>
            <div className="tc-info-grid">
              <div className="tc-info-item">
                <strong>Moon Longitude</strong>
                <span>{parseFloat(moonLon).toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>Sun Longitude</strong>
                <span>{parseFloat(sunLon).toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>Angular Difference</strong>
                <span>{result.Dnorm.toFixed(4)}°</span>
              </div>
              <div className="tc-info-item">
                <strong>Fractional Tithi</strong>
                <span>{result.t_frac.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tc-note">
        Note: Calculations use the "astronomy-engine" library for high-precision ephemeris data (Apparent Geocentric Ecliptic of Date). Modern Astronomy: Uses the actual physical positions of the Sun and Moon (taking into account thousands of gravitational perturbations using NASA-based calculations (Drik Ganita).
      </div>
    </div>
  );
}
