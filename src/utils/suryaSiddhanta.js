
// Surya Siddhanta Constants and Calculations
// Refined based on analysis

const YUGA_CIVIL_DAYS = 1577917828;
const YUGA_SUN_REVS = 4320000;
const YUGA_MOON_REVS = 57753336;
const YUGA_MOON_APOGEE_REVS = 488203;
const YUGA_NODE_REVS = -232238; // Retrograde

// Epoch: Kali Yuga Start
// JD 588465.5 is Midnight at Ujjain (75.7667° E)
const EPOCH_JD_UJJAIN = 588465.5;
const UJJAIN_LON = 75.7667; // Degrees East
const UJJAIN_OFFSET_DAYS = UJJAIN_LON / 360.0; 
// Epoch in UTC: Ujjain Midnight happens earlier in UTC
// Local Time = UTC + Offset
// Midnight Local = UTC + Offset
// UTC = Midnight Local - Offset
const EPOCH_JD_UTC = EPOCH_JD_UJJAIN - UJJAIN_OFFSET_DAYS;

// Helper: Normalize degrees to 0-360
function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

// Helper: Sine in degrees
function sinDeg(deg) {
  return Math.sin(deg * Math.PI / 180);
}

// Helper: Arcsin returning degrees
function asinDeg(val) {
  return Math.asin(val) * 180 / Math.PI;
}

// Convert Date to Julian Date (UTC)
function toJulianDate(date) {
  return (date.getTime() / 86400000) + 2440587.5;
}

// Convert Julian Date to Date
function fromJulianDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

export function calculateSuryaSiddhanta(date) {
  const jd = toJulianDate(date);
  const ahargana = jd - EPOCH_JD_UTC;

  // Mean Longitudes
  // Formula: (Ahargana * Revs / CivilDays) * 360
  const meanSun = normalizeDeg((ahargana * YUGA_SUN_REVS / YUGA_CIVIL_DAYS) * 360);
  const meanMoon = normalizeDeg((ahargana * YUGA_MOON_REVS / YUGA_CIVIL_DAYS) * 360);
  const meanMoonApogee = normalizeDeg((ahargana * YUGA_MOON_APOGEE_REVS / YUGA_CIVIL_DAYS) * 360);
  const meanNode = normalizeDeg((ahargana * YUGA_NODE_REVS / YUGA_CIVIL_DAYS) * 360); // Rahu
  
  // Sun Apogee (Mandocca) - Assumed fixed/slow moving for simplified SS
  // Standard value often used is approx 77.28°
  const sunApogee = 77.2833; 

  // Anomalies (Mean Longitude - Apogee)
  // Note: Some texts use Apogee - Mean. 
  // If Correction = arcsin(C * sin(M-A)), and we subtract it, 
  // then if M > A (0-180), sin is +, correction is +, True = Mean - Corr (Lagging).
  // This matches the physics (slowest at apogee).
  const sunAnomaly = normalizeDeg(meanSun - sunApogee);
  const moonAnomaly = normalizeDeg(meanMoon - meanMoonApogee);

  // Mandaphala (Equation of Center)
  // Simplified Epicycle Circumferences
  const sunCircumference = 14.0;
  
  // Variable Moon Circumference based on Node
  // C = 32 - 20' * |sin(M - N)|
  // 20' = 1/3 degree
  const nodeElongation = normalizeDeg(meanMoon - meanNode);
  const moonCircumference = 32.0 - (1.0/3.0) * Math.abs(sinDeg(nodeElongation));

  const sunCorrection = asinDeg((sunCircumference * sinDeg(sunAnomaly)) / 360.0);
  const moonCorrection = asinDeg((moonCircumference * sinDeg(moonAnomaly)) / 360.0);

  // True Longitudes
  // True = Mean - Correction
  const trueSun = normalizeDeg(meanSun - sunCorrection);
  const trueMoon = normalizeDeg(meanMoon - moonCorrection);

  // Tithi Calculation
  const D = trueMoon - trueSun;
  const Dnorm = normalizeDeg(D);
  const t_frac = Dnorm / 12.0;
  const tithi = Math.floor(t_frac) + 1;
  const progress = t_frac - Math.floor(t_frac);
  
  const paksha = Dnorm < 180 ? 'Shukla' : 'Krishna';
  const pakshaIndex = Dnorm < 180 ? tithi : tithi - 15;

  return {
    meanSun,
    meanMoon,
    trueSun,
    trueMoon,
    Dnorm,
    tithi,
    t_frac,
    progress,
    paksha,
    pakshaIndex,
    ahargana
  };
}

// Helper to find time when Dnorm crosses target angle
function findCrossing(targetAngle, startJD, endJD) {
  let low = startJD;
  let high = endJD;
  
  for (let i = 0; i < 40; i++) { // 40 iterations for high precision
    const mid = (low + high) / 2;
    const res = calculateSuryaSiddhanta(fromJulianDate(mid));
    const d = res.Dnorm;
    
    // Calculate difference handling 360 wrap
    let diff = d - targetAngle;
    // Normalize diff to -180 to +180
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    
    if (diff < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return high;
}

// Find Tithi Start/End times using binary search on angles
export function findSSTithiBoundaries(date) {
  const current = calculateSuryaSiddhanta(date);
  const currentTithi = current.tithi;
  const jd = toJulianDate(date);

  // Target angles
  // Start: (tithi - 1) * 12
  // End: tithi * 12
  const startAngle = ((currentTithi - 1) * 12) % 360;
  const endAngle = (currentTithi * 12) % 360;
  
  // Search range: +/- 1.2 days
  // Tithi length is approx 0.9 to 1.0 days.
  
  // Find Start (Backward)
  const startJD = findCrossing(startAngle, jd - 1.2, jd);

  // Find End (Forward)
  const endJD = findCrossing(endAngle, jd, jd + 1.2);

  return {
    startTime: fromJulianDate(startJD),
    endTime: fromJulianDate(endJD)
  };
}
