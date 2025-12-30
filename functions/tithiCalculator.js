const Astronomy = require('astronomy-engine');

/**
 * Normalizes an angle in degrees to the range [0, 360).
 * @param {number} deg 
 * @returns {number}
 */
function normalizeDeg(deg) {
    return (deg % 360 + 360) % 360;
}

/**
 * Calculates the Tithi index (1-30) and angle at a specific time.
 * Uses Geocentric Ecliptic Longitude (Standard for Tithi).
 * 
 * @param {Date} date 
 * @returns {Object}
 */
function calculateTithiAtTime(date) {
    // Get Geocentric vectors (J2000)
    // true = correct for light time (aberration)
    // Note: GeoVector returns a Vector object {x, y, z, t}
    const moonVec = Astronomy.GeoVector('Moon', date, true);
    const sunVec = Astronomy.GeoVector('Sun', date, true);

    // Convert to Ecliptic coordinates
    const moonEcl = Astronomy.Ecliptic(moonVec);
    const sunEcl = Astronomy.Ecliptic(sunVec);

    // Calculate longitudinal difference (Moon - Sun)
    let diff = moonEcl.elon - sunEcl.elon;
    
    // Normalize to 0-360
    if (diff < 0) diff += 360;

    // Tithi = diff / 12 degrees
    const tithiDecimal = diff / 12.0;
    const tithiIndex = Math.floor(tithiDecimal) + 1; // 1 to 30

    return {
        index: tithiIndex,
        angle: diff,
        moonLong: moonEcl.elon,
        sunLong: sunEcl.elon,
        moonLat: moonEcl.elat,
        sunLat: sunEcl.elat,
        t_frac: tithiDecimal,
        progress: tithiDecimal - Math.floor(tithiDecimal)
    };
}

/**
 * Binary search to find the exact time a Tithi starts or ends.
 * 
 * @param {Date} originDate - Where to start searching.
 * @param {number} targetTithiIndex - The tithi we are in.
 * @param {number} direction - -1 for Start (backward), 1 for End (forward).
 * @returns {Date}
 */
function findTithiBoundary(originDate, targetTithiIndex, direction) {
    // Tithi length varies between ~19 to ~26 hours. 
    // We step 30 hours to be safe, then binary search.
    let t1 = originDate.getTime();
    let t2 = t1 + (direction * 30 * 60 * 60 * 1000); 
    
    let low = Math.min(t1, t2);
    let high = Math.max(t1, t2);
    
    // Binary search for 50 iterations (~1 microsecond precision)
    for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        const midDate = new Date(mid);
        const tithi = calculateTithiAtTime(midDate);
        
        if (direction === 1) {
            // Looking for END. 
            // If mid is still same tithi, move low up. Else move high down.
            if (tithi.index === targetTithiIndex) {
                low = mid;
            } else {
                // Handle wrap-around case (30 -> 1)
                // If we are 30 and mid is 1, we passed the boundary.
                high = mid;
            }
        } else {
            // Looking for START.
            // If mid is same tithi, move high down. Else move low up.
            if (tithi.index === targetTithiIndex) {
                high = mid;
            } else {
                low = mid;
            }
        }
    }
    
    return new Date(low);
}

/**
 * Main function to compute Tithi data for a request.
 * 
 * @param {string} dateStr - ISO date string.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Object} Result object matching the Python script output structure.
 */
function computeTithi(dateStr, lat, lon) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new Error("Invalid date format");
    }
    
    // 1. Calculate Tithi for the requested moment
    const tithiNow = calculateTithiAtTime(date);

    // 2. Find Start and End times of this Tithi
    const tithiStart = findTithiBoundary(date, tithiNow.index, -1);
    const tithiEnd = findTithiBoundary(date, tithiNow.index, 1);

    const paksha = tithiNow.index <= 15 ? 'Shukla' : 'Krishna';
    const pakshaIndex = tithiNow.index <= 15 ? tithiNow.index : tithiNow.index - 15;

    return {
        datetime_utc: dateStr,
        observer_lat: lat,
        observer_lon: lon,
        moon_lon_deg: tithiNow.moonLong,
        moon_lat_deg: tithiNow.moonLat,
        sun_lon_deg: tithiNow.sunLong,
        sun_lat_deg: tithiNow.sunLat,
        Dnorm_deg: tithiNow.angle,
        t_frac: tithiNow.t_frac,
        tithi: tithiNow.index,
        progress: tithiNow.progress,
        progress_percent: tithiNow.progress * 100,
        paksha: paksha,
        paksha_index: pakshaIndex,
        tithi_start_utc: tithiStart.toISOString(),
        tithi_end_utc: tithiEnd.toISOString()
    };
}

module.exports = {
    computeTithi
};
