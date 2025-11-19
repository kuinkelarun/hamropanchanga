Why I added the Python script first

    Skyfield with JPL ephemerides (DE421/DE430) gives high precision and is straightforward to package as a small script. It’s ideal for a robust server-side or local calculation.
    Adding a server endpoint (or embedding a Python service) is a next step if you want in-app automatic queries.

Client-side JS option (in-app, immediate UI integration)

    If you want the calculator to fetch Sun/Moon longitudes directly inside the React app (no external script), I recommend a client-side library:
        Recommended: astronomy-engine (modern, accurate, npm: astronomy-engine) — good accuracy and pure JS API.
        Alternatives: astronomia (Meeus algorithms) — also mature but lower-level.
    Pros/cons:
        JS client-side:
            Pros: immediate in-app compute, no server dependency.
            Cons: slightly larger bundle (one npm lib), and accuracy slightly depends on library choice (still good for tithi).
        Python Skyfield:
            Pros: very high precision; ideal for batch processing and server-side endpoints.
            Cons: requires running a Python script or adding a server component (not automatic in the browser).

What I propose next (pick one)

A — I implement in-app client-side ephemeris using astronomy-engine, wire it into TithiCalculator to add a “Compute from date/time (auto)” mode. I will:
    Add astronomy-engine to package.json,
    Add src/utils/ephemeris.js to compute geocentric ecliptic longitudes for a given UTC datetime (optionally topocentric with lat/lon),
    Update TithiCalculator to let users pick manual input or auto compute from date/time.
    Run a quick build and fix any issues.
B — I keep the Python script only (you run it locally or on a server) and I add a small UI in TithiCalculator to import/paste its JSON output (or upload a small JSON file).
C — Implement both: Python script remains for batch/server usage and I also add client-side JS for in-app convenience.