import * as Astronomy from 'astronomy-engine';

// ─── Low-level helpers ────────────────────────────────────────────────────────

export function normalizeDeg(d) {
  return ((d % 360) + 360) % 360;
}

export function computeTithiFromLongitudes(moonLon, sunLon) {
  const D = moonLon - sunLon;
  const Dnorm = normalizeDeg(D);
  const t_frac = Dnorm / 12.0;

  // Standard formula: Tithi index is 1-based (1..30)
  const t_index0 = Math.floor(t_frac);
  const tithi = t_index0 + 1;

  const progress = t_frac - t_index0;
  const paksha = Dnorm < 180 ? 'Shukla' : 'Krishna';
  const pakshaIndex = Dnorm < 180 ? tithi : tithi - 15;

  return {
    Dnorm,
    t_frac,
    tithi,
    progress,
    progress_percent: progress * 100,
    paksha,
    pakshaIndex
  };
}

// ─── Client-side astronomy-engine computation ─────────────────────────────────

/**
 * Compute geocentric ecliptic longitudes for Moon and Sun at a given Date.
 * Returns { moonLon, sunLon, moonLat, sunLat }.
 */
function getLongitudesAtTime(date) {
  const moonVec = Astronomy.GeoVector('Moon', date, true);
  const sunVec  = Astronomy.GeoVector('Sun',  date, true);
  const moonEcl = Astronomy.Ecliptic(moonVec);
  const sunEcl  = Astronomy.Ecliptic(sunVec);
  return {
    moonLon: moonEcl.elon,
    sunLon:  sunEcl.elon,
    moonLat: moonEcl.elat,
    sunLat:  sunEcl.elat
  };
}

/**
 * Binary-search the exact moment a tithi boundary crosses.
 * direction:  1 = search forward (tithi END)
 *            -1 = search backward (tithi START)
 */
function findTithiBoundary(originDate, targetTithiIndex, direction) {
  const MS_30H = 30 * 60 * 60 * 1000;
  let low  = originDate.getTime();
  let high = low + direction * MS_30H;
  if (low > high) { const tmp = low; low = high; high = tmp; }

  // 50 iterations → sub-millisecond precision
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const { moonLon, sunLon } = getLongitudesAtTime(new Date(mid));
    const Dnorm = normalizeDeg(moonLon - sunLon);
    const idx   = Math.floor(Dnorm / 12.0) + 1;

    if (direction === 1) {
      // Looking for END: advance low while still in same tithi
      idx === targetTithiIndex ? (low = mid) : (high = mid);
    } else {
      // Looking for START: retreat high while still in same tithi
      idx === targetTithiIndex ? (high = mid) : (low = mid);
    }
  }
  return new Date(direction === 1 ? low : high);
}

/**
 * Full client-side ephemeris calculation — no Firebase Function needed.
 * Drop-in replacement for the old Firebase-backed getEphemerisData().
 *
 * @param {Date|string} date - UTC moment to evaluate
 * @param {number|null}  lat  - Observer latitude  (unused for geocentric, kept for API compat)
 * @param {number|null}  lon  - Observer longitude (unused for geocentric, kept for API compat)
 * @returns {{ sunLon, moonLon, sunLat, moonLat, tithiStart, tithiEnd }}
 */
export function getEphemerisData(date, lat = null, lon = null) {
  const d = (date instanceof Date) ? date : new Date(date);

  const { moonLon, sunLon, moonLat, sunLat } = getLongitudesAtTime(d);
  const Dnorm = normalizeDeg(moonLon - sunLon);
  const tithiIndex = Math.floor(Dnorm / 12.0) + 1;

  const tithiStart = findTithiBoundary(d, tithiIndex, -1);
  const tithiEnd   = findTithiBoundary(d, tithiIndex,  1);

  return {
    sunLon,
    moonLon,
    sunLat,
    moonLat,
    tithiStart: tithiStart.toISOString(),
    tithiEnd:   tithiEnd.toISOString()
  };
}
