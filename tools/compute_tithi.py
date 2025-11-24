#!/usr/bin/env python3
"""
compute_tithi.py

Compute Sun and Moon geocentric/topocentric ecliptic longitudes and the corresponding tithi
using Skyfield (JPL ephemeris).

Usage examples:
  python tools/compute_tithi.py --datetime "2025-11-18T12:00:00Z"
  python tools/compute_tithi.py --datetime "2025-11-18T18:30:00" --lat 27.7172 --lon 85.3240

Install requirements:
  pip install skyfield

This outputs JSON with moon_lon_deg, sun_lon_deg, Dnorm_deg, tithi, paksha, progress
"""

import argparse
import json
from datetime import datetime, timedelta

try:
    from skyfield.api import load, Topos
except Exception as e:
    raise SystemExit("skyfield is required. Install with: pip install skyfield")


def normalize_deg(d):
    return (d % 360 + 360) % 360


def compute_tithi_from_longitudes(moon_lon, sun_lon):
    D = moon_lon - sun_lon
    Dnorm = normalize_deg(D)
    t_frac = Dnorm / 12.0
    t_index0 = int(t_frac)
    tithi = t_index0 + 1
    progress = t_frac - t_index0
    paksha = "Shukla" if Dnorm < 180 else "Krishna"
    paksha_index = tithi if Dnorm < 180 else tithi - 15
    return {
        "Dnorm_deg": Dnorm,
        "t_frac": t_frac,
        "tithi": tithi,
        "progress": progress,
        "progress_percent": progress * 100,
        "paksha": paksha,
        "paksha_index": paksha_index
    }


def get_tithi_at_time(ts, t, eph, earth, observer=None):
    """Compute tithi info at a specific time"""
    if observer:
        moon_apparent = observer.at(t).observe(eph["moon"]).apparent()
        sun_apparent = observer.at(t).observe(eph["sun"]).apparent()
    else:
        moon_apparent = earth.at(t).observe(eph["moon"]).apparent()
        sun_apparent = earth.at(t).observe(eph["sun"]).apparent()
    
    moon_lat, moon_lon, moon_distance = moon_apparent.ecliptic_latlon()
    sun_lat, sun_lon, sun_distance = sun_apparent.ecliptic_latlon()
    
    return compute_tithi_from_longitudes(moon_lon.degrees, sun_lon.degrees)


def find_tithi_boundary(ts, start_time, target_tithi, direction, eph, earth, observer=None, max_iterations=50):
    """
    Find the exact time when tithi changes using binary search.
    direction: -1 for backwards (start), +1 for forwards (end)
    """
    # Initial bounds: search within ~3 days
    if direction == -1:
        low = start_time.tdb - 3  # 3 days back
        high = start_time.tdb
    else:
        low = start_time.tdb
        high = start_time.tdb + 3  # 3 days forward
    
    current_tithi = get_tithi_at_time(ts, start_time, eph, earth, observer)["tithi"]
    
    for _ in range(max_iterations):
        mid_tdb = low + (high - low) / 2
        mid = ts.tdb(jd=mid_tdb)
        mid_tithi = get_tithi_at_time(ts, mid, eph, earth, observer)["tithi"]
        
        if direction == -1:  # searching backwards for start
            if mid_tithi == current_tithi:
                # Found current tithi, transition must be before this
                high = mid_tdb
            else:
                # Found different tithi, transition must be after this
                low = mid_tdb
        else:  # searching forwards for end
            if mid_tithi == current_tithi:
                # Still current tithi, transition must be after this
                low = mid_tdb
            else:
                # Found different tithi, transition must be before this
                high = mid_tdb
    
    # Return the boundary time
    return ts.tdb(jd=high)  # For both directions, high converges to the boundary


def main():
    p = argparse.ArgumentParser(description="Compute tithi from date/time using Skyfield")
    p.add_argument("--datetime", "-d", required=True, help="UTC datetime in ISO format (e.g. 2025-11-18T12:00:00Z or 2025-11-18T12:00:00)")
    p.add_argument("--lat", type=float, help="Observer latitude (decimal degrees) for topocentric correction")
    p.add_argument("--lon", type=float, help="Observer longitude (decimal degrees) for topocentric correction")
    p.add_argument("--ephem", default="de421.bsp", help="JPL ephemeris filename (default: de421.bsp)")
    args = p.parse_args()

    # parse datetime (assume UTC if "Z" present or no timezone info)
    dt_str = args.datetime
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1]
    try:
        dt = datetime.fromisoformat(dt_str)
    except Exception:
        raise SystemExit("Invalid datetime format. Use ISO like 2025-11-18T12:00:00Z")

    ts = load.timescale()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)

    eph = load(args.ephem)
    earth = eph["earth"]

    if args.lat is not None and args.lon is not None:
        observer = earth + Topos(latitude_degrees=args.lat, longitude_degrees=args.lon)
        moon_apparent = observer.at(t).observe(eph["moon"]).apparent()
        sun_apparent = observer.at(t).observe(eph["sun"]).apparent()
    else:
        # geocentric (no topocentric correction)
        moon_apparent = earth.at(t).observe(eph["moon"]).apparent()
        sun_apparent = earth.at(t).observe(eph["sun"]).apparent()

    # ecliptic longitude (true ecliptic of date)
    try:
        moon_lat, moon_lon, moon_distance = moon_apparent.ecliptic_latlon()
        sun_lat, sun_lon, sun_distance = sun_apparent.ecliptic_latlon()
        moon_lon_deg = moon_lon.degrees
        sun_lon_deg = sun_lon.degrees
        moon_lat_deg = moon_lat.degrees
        sun_lat_deg = sun_lat.degrees
    except Exception:
        # Fallback: use equatorial RA/Dec and convert approx to ecliptic
        raise SystemExit("Unable to compute ecliptic longitudes with the installed Skyfield version")

    tithi_info = compute_tithi_from_longitudes(moon_lon_deg, sun_lon_deg)

    # Find exact start and end times for the current Tithi
    observer_for_boundary = observer if (args.lat is not None and args.lon is not None) else None
    tithi_start_time = find_tithi_boundary(ts, t, tithi_info["tithi"], -1, eph, earth, observer_for_boundary)
    tithi_end_time = find_tithi_boundary(ts, t, tithi_info["tithi"], 1, eph, earth, observer_for_boundary)
    
    # Convert to datetime objects for ISO format
    start_dt = tithi_start_time.utc_datetime()
    end_dt = tithi_end_time.utc_datetime()
    start_datetime = start_dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    end_datetime = end_dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    out = {
        "datetime_utc": args.datetime,
        "observer_lat": args.lat,
        "observer_lon": args.lon,
        "moon_lon_deg": moon_lon_deg,
        "moon_lat_deg": moon_lat_deg,
        "sun_lon_deg": sun_lon_deg,
        "sun_lat_deg": sun_lat_deg,
        "tithi_start_utc": start_datetime,
        "tithi_end_utc": end_datetime,
        **tithi_info
    }

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
