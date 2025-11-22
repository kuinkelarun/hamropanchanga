import * as Astronomy from 'astronomy-engine';

export function normalizeDeg(d) {
  return ((d % 360) + 360) % 360;
}

export function computeTithiFromLongitudes(moonLon, sunLon) {
  const D = moonLon - sunLon;
  const Dnorm = normalizeDeg(D);
  const t_frac = Dnorm / 12.0;
  
  // Standard tithi formula: floor(t_frac) + 1
  // t_frac is 0-based index (0..29.999), tithi is 1-based (1..30)
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

export function getEphemerisData(date, lat = null, lon = null) {
  // Try multiple call patterns to handle different astronomy-engine versions.
  const diagnostics = [];
  const jsDate = (date instanceof Date) ? date : new Date(date);
  let at = null;
  if (typeof Astronomy.MakeTime === 'function') {
    try { at = Astronomy.MakeTime(jsDate); } catch (e) { diagnostics.push(`MakeTime failed: ${e && e.message}`); }
  }

  const tryFns = {
    sunFromAstroTime: () => {
      if (!at) throw new Error('no AstroTime');
      if (typeof Astronomy.SunPosition !== 'function' || typeof Astronomy.Ecliptic !== 'function') throw new Error('SunPosition/Ecliptic missing');
      const v = Astronomy.SunPosition(at);
      if (!v) throw new Error('SunPosition returned empty');
      return Astronomy.Ecliptic(v);
    },
    sunFromJSDate: () => {
      if (typeof Astronomy.SunPosition !== 'function' || typeof Astronomy.Ecliptic !== 'function') throw new Error('SunPosition/Ecliptic missing');
      const v = Astronomy.SunPosition(jsDate);
      if (!v) throw new Error('SunPosition returned empty');
      return Astronomy.Ecliptic(v);
    },
    moonEclipticGeoFromAstroTime: () => {
      if (!at) throw new Error('no AstroTime');
      if (typeof Astronomy.EclipticGeoMoon !== 'function') throw new Error('EclipticGeoMoon missing');
      return Astronomy.EclipticGeoMoon(at);
    },
    moonEclipticGeoFromJSDate: () => {
      if (typeof Astronomy.EclipticGeoMoon !== 'function') throw new Error('EclipticGeoMoon missing');
      return Astronomy.EclipticGeoMoon(jsDate);
    },
    moonFromGeoMoonAstroTime: () => {
      if (!at) throw new Error('no AstroTime');
      if (typeof Astronomy.GeoMoon !== 'function' || typeof Astronomy.Ecliptic !== 'function') throw new Error('GeoMoon/Ecliptic missing');
      const v = Astronomy.GeoMoon(at);
      if (!v) throw new Error('GeoMoon returned empty');
      return Astronomy.Ecliptic(v);
    },
    moonFromGeoMoonJSDate: () => {
      if (typeof Astronomy.GeoMoon !== 'function' || typeof Astronomy.Ecliptic !== 'function') throw new Error('GeoMoon/Ecliptic missing');
      const v = Astronomy.GeoMoon(jsDate);
      if (!v) throw new Error('GeoMoon returned empty');
      return Astronomy.Ecliptic(v);
    }
  };

  const sunCandidates = [];
  const moonCandidates = [];

  // First try: EclipticLongitude with Body constants (preferred if available)
  try {
    if (typeof Astronomy.EclipticLongitude === 'function' && Astronomy.Body) {
      const SunBody = Astronomy.Body.Sun || 'Sun';
      const MoonBody = Astronomy.Body.Moon || 'Moon';
      try {
        const s = Astronomy.EclipticLongitude(SunBody, jsDate);
        const m = Astronomy.EclipticLongitude(MoonBody, jsDate);
        if (typeof s === 'number' && typeof m === 'number') {
          return { sunLon: s, sunLat: 0, moonLon: m, moonLat: 0 };
        }
      } catch (e) {
        diagnostics.push(`EclipticLongitude failed: ${e && e.message}`);
      }
    }
  } catch (e) {
    diagnostics.push(`EclipticLongitude check failed: ${e && e.message}`);
  }

  // Next try: EclipticGeoMoon (for moon) and SunPosition+Ecliptic (for sun)
  try { moonCandidates.push(tryFns.moonEclipticGeoFromJSDate()); } catch (e) { diagnostics.push(`moonEclipticGeoFromJSDate: ${e && e.message}`); }
  try { sunCandidates.push(tryFns.sunFromJSDate()); } catch (e) { diagnostics.push(`sunFromJSDate: ${e && e.message}`); }

  const pick = (arr) => arr.find(x => x && typeof x.lon === 'number');
  const sunEcl = pick(sunCandidates);
  const moonEcl = pick(moonCandidates);

  if (!sunEcl || !moonEcl) {
    const keys = Object.keys(Astronomy).slice(0,300);
    const msg = `Unable to compute Sun/Moon ecliptic longitudes. Diagnostics: ${diagnostics.join('; ')}. Available API keys: ${keys.join(', ')}`;
    throw new Error(msg);
  }

  return { sunLon: sunEcl.lon, sunLat: sunEcl.lat || 0, moonLon: moonEcl.lon, moonLat: moonEcl.lat || 0 };
}
