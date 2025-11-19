import React, { useState } from 'react';
import './TithiCalculator.css';

function normalizeDeg(d) {
  return ((d % 360) + 360) % 360;
}

function computeFromLongitudes(moonLon, sunLon) {
  const D = moonLon - sunLon;
  const Dnorm = normalizeDeg(D);
  const t_frac = Dnorm / 12.0;
  const t_index0 = Math.floor(t_frac); // 0..29
  const tithi = t_index0 + 1; // 1..30
  const progress = t_frac - t_index0;
  const paksha = Dnorm < 180 ? 'Shukla' : 'Krishna';
  const pakshaIndex = Dnorm < 180 ? tithi : tithi - 15;
  return { Dnorm, t_frac, tithi, progress, progress_percent: progress * 100, paksha, pakshaIndex };
}

export default function TithiCalculator() {
  const [moonLon, setMoonLon] = useState('');
  const [sunLon, setSunLon] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function onCompute(e) {
    e && e.preventDefault();
    setError('');
    const m = parseFloat(String(moonLon).trim());
    const s = parseFloat(String(sunLon).trim());
    if (Number.isNaN(m) || Number.isNaN(s)) {
      setError('Please enter numeric Moon and Sun longitudes in degrees (0-360).');
      setResult(null);
      return;
    }
    const res = computeFromLongitudes(m, s);
    setResult(res);
  }

  function onClear() {
    setMoonLon(''); setSunLon(''); setResult(null); setError('');
  }

  return (
    <div className="tc-root">
      <h3 className="tc-title">Tithi Calculator</h3>
      <p className="tc-desc">Enter geocentric ecliptic longitudes (degrees) for Moon and Sun, then click Compute.</p>
      <form className="tc-form" onSubmit={onCompute}>
        <label className="tc-label">Moon Longitude (°)</label>
        <input className="tc-input" value={moonLon} onChange={e=>setMoonLon(e.target.value)} placeholder="e.g. 130.1234" />

        <label className="tc-label">Sun Longitude (°)</label>
        <input className="tc-input" value={sunLon} onChange={e=>setSunLon(e.target.value)} placeholder="e.g. 100.5678" />

        <div className="tc-actions">
          <button type="submit" className="tc-btn">Compute</button>
          <button type="button" className="tc-btn tc-btn-muted" onClick={onClear}>Clear</button>
        </div>
      </form>

      {error && <div className="tc-error">{error}</div>}

      {result && (
        <div className="tc-output">
          <div><strong>Normalized difference (°):</strong> {result.Dnorm.toFixed(6)}</div>
          <div><strong>Fractional tithi (0..30):</strong> {result.t_frac.toFixed(6)}</div>
          <div><strong>Tithi (1..30):</strong> {result.tithi} ({result.paksha} {result.pakshaIndex})</div>
          <div><strong>Progress through tithi:</strong> {(result.progress * 100).toFixed(2)}%</div>
        </div>
      )}

      <div className="tc-note">
        Note: For accurate automatic tithi calculation from a date/time, you need ephemeris-derived
        Sun and Moon ecliptic longitudes (e.g. from Swiss Ephemeris or JPL). This tool accepts
        longitudes directly and applies the canonical tithi formula: (MoonLon − SunLon)/12°.
      </div>
    </div>
  );
}
