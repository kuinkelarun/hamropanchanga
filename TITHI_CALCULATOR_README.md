# Tithi Calculator Feature

The Tithi Calculator is a component in the Family Tree App that computes the lunar day (Tithi) based on astronomical data. It supports both automatic calculation using real-time ephemeris data and manual input of celestial longitudes.

## Features

### Automatic Mode (Date/Time)
- Select a date and time to automatically calculate Sun and Moon ecliptic longitudes.
- Uses high-precision astronomical calculations via a Python script (Skyfield library) running on Firebase Cloud Functions.
- Automatically detects the user's location for topocentric calculations (more accurate).
- Falls back to default location (Kathmandu, Nepal) if geolocation is unavailable or denied.
- **Displays exact Tithi start and end times** that are fixed for each Tithi period, calculated using binary search for precision.
- **Shows Nepali date and time format** alongside English format for cultural relevance.
- **Process Explanation**: Since the React app runs in the browser (client-side JavaScript), it cannot execute Python scripts directly. The automatic mode calls a Firebase Cloud Function (server-side), which spawns the local Python script with Skyfield to compute accurate ecliptic longitudes. The results are returned to the browser, where JavaScript calculates the final Tithi using the standard formula. This architecture ensures high precision while keeping the UI responsive.

### Manual Mode (Longitudes)
- Enter Moon and Sun ecliptic longitudes manually (in degrees).
- Applies the standard Tithi formula: Tithi = (Moon Longitude - Sun Longitude) / 12°.

### Location Detection
- When the component loads, it requests permission to access the user's current location.
- Displays status: "Detecting...", "Detected (lat, lon)", or fallback messages.
- Coordinates are in decimal degrees (latitude, longitude).
- Example: "Detected (40.7086, -74.0617)" means latitude 40.7086° N, longitude -74.0617° W (New York City area).

### Nepali Date and Time Display
- In automatic mode, displays the Tithi start and end times in both English and Nepali formats.
- Nepali date format: "मंसिर १०, २०८२, 6:00:01 AM" (Month Day, Year, Time with seconds)
- Time conversion accounts for user's local timezone and Nepal Standard Time (NPT = UTC+5:45).
- Automatically adjusts for daylight saving time differences between user location and Nepal.
- Shows both Gregorian and Nepali calendar dates for cultural relevance.
- Example: 
  - English: "11/24/2025, 9:36:01 AM" (user's local time)
  - Nepali: "मंसिर ८, २०८२, 8:21:01 PM" (corresponding Nepal time)

### Tithi Duration and Timing
- In automatic mode, displays the exact start and end date/time of the current Tithi.
- Times are calculated using precise astronomical ephemeris with binary search algorithm to find exact Tithi boundaries.
- Start and end times are absolute for each Tithi period and remain consistent regardless of the input query time.
- Shows local date/time format for readability.
- Manual mode shows "N/A" since times depend on real astronomical data.

## Setup and Usage

### Prerequisites
- Node.js and npm installed.
- Firebase CLI installed (`npm install -g firebase-tools`).
- Python 3 with Skyfield library (`pip install skyfield`).
- Java JDK installed (for Firebase emulators).

### Running Locally with Emulators

1. **Install Dependencies**:
   ```
   npm install
   ```

2. **Start Firebase Emulators**:
   ```
   firebase emulators:start
   ```
   This starts Firestore, Functions, Hosting, and Extensions emulators.

3. **Start React App**:
   ```
   npm start
   ```
   Open http://localhost:3000 in your browser.

4. **Test Tithi Calculator**:
   - Navigate to the Tithi Calculator component.
   - Switch to "Automatic (Date/Time)" mode.
   - Grant location permission when prompted.
   - Select a date/time and click "Compute".
   - The app will call the local Firebase function, which spawns the Python script to calculate longitudes.

### Emulator Details
- **Functions Emulator**: Runs at http://localhost:5001. Handles the `computeEphemeris` function.
- **Firestore Emulator**: Runs at http://localhost:8080. Not directly used by Tithi Calculator but required for the app.
- **Hosting Emulator**: Serves the React app locally.
- The emulators simulate production Firebase services, allowing local development without cloud costs.

### Production Deployment
- Deploy functions: `firebase deploy --only functions`
- Deploy hosting: `firebase deploy --only hosting`
- **Note**: The Python script won't work in production Firebase Functions (Node.js runtime lacks Python). For production, consider:
  - Converting to a JavaScript astronomy library (e.g., fix astronomy-engine issues).
  - Using a custom container with Python.
  - Calling an external API for ephemeris data.

## Technical Details

### Calculation Formula
- **Tithi Index**: `floor((MoonLon - SunLon) / 12°) + 1`
- **Paksha**: Shukla (waxing) if difference < 180°, Krishna (waning) otherwise.
- **Progress**: Fractional progress through the current Tithi (0-1).
- **Tithi Boundaries**: Uses binary search algorithm to find exact start/end times when Tithi transitions occur, ensuring precise timing independent of query time.
- **Timezone Handling**: Nepali date/time display accounts for user's local timezone offset and converts to Nepal Standard Time (UTC+5:45) for accurate cultural time representation.
- **Time Precision**: Displays time with seconds precision (HH:MM:SS format) for both English and Nepali time displays.

### Location Impact
- **Geocentric**: Uses Earth's center as reference (default if no location).
- **Topocentric**: Adjusts for observer's position on Earth (more accurate, used when location detected).
- Location improves precision for ecliptic longitude calculations.

### Error Handling
- Geolocation denied: Falls back to defaults.
- Function errors: Displays "Failed to calculate ephemeris data."
- Invalid inputs: Shows validation messages.

## Files Involved
- `src/components/TithiCalculator.js`: Main UI component with Nepali date/time formatting and timezone conversion.
- `src/utils/ephemeris.js`: Handles API calls to Firebase function.
- `functions/index.js`: Firebase function that spawns Python script.
- `tools/compute_tithi.py`: Python script using Skyfield for calculations.
- `src/utils/nepaliDateUtils.js`: Nepali calendar conversion utilities.
- `src/components/TithiCalculator.css`: Styling.

## Troubleshooting
- **Emulator Port Conflicts**: Kill processes on ports 8080/5001 if needed.
- **Geolocation Not Working**: Check browser permissions; ensure HTTPS in production.
- **Function Errors**: Check emulator logs for Python script issues.
- **Production Issues**: Python not available; switch to JS library or custom deployment.

For more details, see the main app README or contact the development team.