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

export async function getEphemerisData(date, lat = null, lon = null) {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../firebase');
  const computeEphemeris = httpsCallable(functions, 'computeEphemeris');
  const dateStr = (date instanceof Date) ? date.toISOString() : date;
  const result = await computeEphemeris({ date: dateStr, lat, lon });
  return result.data;
}
