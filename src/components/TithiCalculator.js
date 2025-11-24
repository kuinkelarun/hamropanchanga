import React, { useState, useEffect } from 'react';
import './TithiCalculator.css';
import { computeTithiFromLongitudes, getEphemerisData } from '../utils/ephemeris';

export default function TithiCalculator() {
  const [mode, setMode] = useState('auto'); // 'auto' or 'manual'
  const [moonLon, setMoonLon] = useState('');
  const [sunLon, setSunLon] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Initialize date/time to now
  useEffect(() => {
    const now = new Date();
    setDateStr(now.toISOString().split('T')[0]);
    // Format time as HH:MM
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
  }, []);

  async function onCompute(e) {
    e && e.preventDefault();
    setError('');
    setResult(null);

    let m, s;

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
        const eph = await getEphemerisData(dt);
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
      <h3 className="tc-title">Tithi Calculator</h3>
      
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
          <div><strong>Progress through tithi:</strong> {(result.progress * 100).toFixed(2)}%</div>
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
