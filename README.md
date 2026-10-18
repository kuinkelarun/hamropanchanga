# HamroPanchanga

[Live application](https://hamropanchanga.com)

HamroPanchanga is a bilingual (English/Nepali) web application for the Bikram Sambat calendar. It combines calendar and tithi data, public events, and lunar-day calculations with tools for creating and sharing family trees. The application also exposes a public REST API for calendar, tithi, and public-event integrations.

## Technology

- **Languages:** JavaScript (React client and Node.js functions), CSS
- **Client:** React 18, Create React App (`react-scripts`), React Router, Tailwind CSS
- **Firebase:** Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, and Hosting
- **Backend/API:** Node.js 20 Cloud Functions, Express, Firebase Admin SDK
- **Domain libraries:** React Flow for family-tree graphs, `astronomy-engine` for astronomical calculations, `xlsx` for spreadsheet import/export, and `html-to-image` for tree exports
- **Localization:** Context-based English/Nepali language support and Bikram Sambat date utilities

## Architecture

The browser application is a React single-page app. React Router composes the calendar, tithi calculator, events, family-tree builder, and administration views; shared contexts provide authentication, language selection, and chat state. Hooks and services encapsulate data subscriptions and feature operations.

The client uses the Firebase SDK for authentication and direct Firestore/Storage access. Firestore and Storage rules enforce access at the data boundary. Firebase Hosting serves the production bundle and rewrites application routes to `index.html`. Node.js Cloud Functions provide server-side operations and the Express-based public API; the functions use the Firebase Admin SDK to access backend data. Calendar and astronomy utilities provide Bikram Sambat conversions and tithi calculations.

```text
Browser / React SPA
  ├── Firebase Auth
  ├── Firestore + Storage (client SDK; security rules)
  └── HTTPS Cloud Functions
        ├── Express REST API
        └── Admin SDK / astronomy calculations
```

## Public API

Base URL: `https://us-central1-hamropanchanga.cloudfunctions.net/api`

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/v1/health` | Public; no key required |
| `GET` | `/v1/tithi/today` | API key required |
| `GET` | `/v1/calendar/:bsYear/:bsMonth` | API key required |
| `GET` | `/v1/tithis?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | API key required |
| `GET` | `/v1/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | API key required |
| `GET` | `/v1/convert/ad-to-bs?date=YYYY-MM-DD` | API key required |
| `GET` | `/v1/convert/bs-to-ad?year=…&month=…&day=…` | API key required |
| `POST` | `/v1/convert/batch` | API key required |
| `GET` | `/v1/today` | API key required |

Authenticated requests pass the issued key in the `X-API-Key` header. Request access from the app's **Developer API** page. See the [API developer guide](docs/API_DEVELOPER_GUIDE.md) for request/response formats, parameters, and examples.

The conversion and `/v1/today` routes are implemented in the API but are not yet covered by the developer guide.

## Screenshots

The repository currently contains landing-page artwork, but no application screenshots. Add captured screenshots under `docs/screenshots/` (for example, `home.png`, `calendar.png`, and `family-tree.png`) and link them here using relative paths.

## Development

Requirements: Node.js and npm. The frontend reads Firebase configuration from environment variables; copy `.env.example` to `.env` and provide values from the Firebase project before starting the app.

```bash
npm install
cp .env.example .env
# Set the REACT_APP_FIREBASE_* values and REACT_APP_FIRESTORE_DATABASE_ID in .env
npm start
```

The app runs at `http://localhost:3000`. Available project scripts:

```bash
npm test -- --watchAll=false
npm run build
```

Cloud Functions are in `functions/` and require Node.js 20. Install their dependencies with `npm --prefix functions install`. Firebase Hosting serves the generated `build/` directory; deployment configuration is in `firebase.json`.
