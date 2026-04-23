# Family Tree Application — Technical Architecture

> **Project:** Hamro Panchanga / Family Tree  
> **Last Updated:** April 2026  
> **Firebase Project ID:** `hamropanchanga`  
> **Firestore Database:** `hamropanchanga-db`

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [End-to-End Request Trace](#3-end-to-end-request-trace)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Design](#6-database-design)
7. [Authentication & Role-Based Access Control](#7-authentication--role-based-access-control)
8. [Tithi Calculation Pipeline](#8-tithi-calculation-pipeline)
9. [Deployment Topology](#9-deployment-topology)
10. [Data Flow Diagrams](#10-data-flow-diagrams)

---

## 1. Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | UI framework (Create React App) |
| **React Router DOM** | 7.10.1 | Client-side SPA routing |
| **Tailwind CSS** | 3.4.10 | Utility-first CSS framework |
| **PostCSS + Autoprefixer** | 8.5.6 | CSS build processing |
| **ReactFlow** | 11.11.4 | Interactive family tree graph visualization |
| **html-to-image** | 1.11.13 | Export tree as PNG/JPEG |
| **xlsx** | 0.18.5 | Excel import/export for bulk uploads |
| **astronomy-engine** | 2.1.19 | Moon/sun position calculations for Tithi |

### Backend / Infrastructure

| Technology | Version | Purpose |
|---|---|---|
| **Firebase SDK (client)** | 12.9.0 | Firestore, Auth, Storage access from browser |
| **Firebase Admin SDK** | 13.6.0 | Server-side Firestore + Auth in Cloud Functions |
| **Firebase Cloud Functions** | Node.js 20 runtime | Serverless backend, REST API host |
| **Express.js** | 4.18.2 | HTTP routing framework inside Cloud Functions |
| **CORS** | 2.8.5 | Cross-origin request middleware |

### Firebase Services

| Service | Role |
|---|---|
| **Firestore** | Primary NoSQL document database |
| **Firebase Authentication** | Google OAuth sign-in + custom JWT claims |
| **Firebase Hosting** | Static SPA hosting with catch-all SPA rewrite |
| **Firebase Cloud Storage** | Image hosting (home page cards) |
| **Firebase Cloud Functions** | REST API endpoints + callable functions |

### Localization & Domain

| Technology | Purpose |
|---|---|
| **Custom i18n (Context-based)** | Bilingual EN/NE with nested key translation |
| **Nepali Numeral Converter** | English ↔ Nepali digit conversion |
| **Custom BS Calendar Engine** | Bikram Sambat ↔ Gregorian (AD) date conversion |
| **Nepali Calendar Data** | Pre-computed BS year data for years 2000–2200 |

---

## 2. System Architecture Overview

```mermaid
flowchart TD
    subgraph Client["Browser (Client)"]
        SPA["React SPA\n(Create React App)"]
    end

    subgraph Firebase["Firebase Platform"]
        FH["Firebase Hosting\n(Static Files + SPA Rewrite)"]
        FA["Firebase Auth\n(Google OAuth)"]
        FS["Firestore\n(hamropanchanga-db)"]
        FCF["Cloud Functions\n(Node.js 20 + Express.js)"]
        FCST["Cloud Storage\n(Images)"]
    end

    subgraph ExternalAPI["External API Consumers"]
        DEV["3rd-party Developers\n(x-api-key header)"]
    end

    subgraph Astronomy["Astronomy Layer"]
        AE["astronomy-engine\n(Moon/Sun positions)"]
    end

    User["End User"] --> FH
    FH --> SPA

    SPA -- "Google Sign-In Popup" --> FA
    SPA -- "onSnapshot (real-time)" --> FS
    SPA -- "uploadBytes / getDownloadURL" --> FCST
    SPA -- "httpsCallable (setAdminRole)" --> FCF

    FCF -- "Admin SDK Reads/Writes" --> FS
    FCF -- "Admin SDK setCustomUserClaims" --> FA
    FCF -- "Tithi Calculation" --> AE

    DEV -- "REST /v1/*\n(x-api-key auth)" --> FCF
```

---

## 3. End-to-End Request Trace

This section traces every step that happens from the moment a user types `hamropanchanga.web.app` in the browser until the landing page is fully interactive with live data.

### Phase 1 — Network & Static Asset Delivery

```mermaid
sequenceDiagram
    participant Browser
    participant DNS as DNS Resolver
    participant FH as Firebase Hosting (CDN)

    Browser->>DNS: Resolve hamropanchanga.web.app
    DNS-->>Browser: IP of Firebase Hosting CDN edge node

    Browser->>FH: GET / (HTTP 1.1 / HTTP2)
    FH-->>Browser: 200 OK — index.html (shell HTML, ~1KB)

    Browser->>FH: GET /static/js/main.[hash].js  (React bundle)
    Browser->>FH: GET /static/css/main.[hash].css (Tailwind styles)
    FH-->>Browser: JS + CSS bundles (gzip-compressed, cached)

    note over Browser: HTML parsed, React bundle executes
```

### Phase 2 — React Bootstrap & Auth Initialization

```mermaid
sequenceDiagram
    participant Browser
    participant React as React Runtime
    participant AC as AuthContext (onAuthStateChanged)
    participant FA as Firebase Auth (IndexedDB / cookie)
    participant FS as Firestore

    Browser->>React: ReactDOM.createRoot().render(<App />)

    note over React: Render tree mounts in order:
    note over React: AuthProvider → LanguageProvider → Router → AppContent

    React->>AC: AuthProvider mounts\nonAuthStateChanged() registered

    AC->>FA: Check persisted session\n(IndexedDB token store)

    alt User has a valid cached token
        FA-->>AC: currentUser object (no network call needed)
        AC->>FS: getDoc(adminList/{uid})
        FS-->>AC: Exists? → isAdmin = true
        note over AC: If not in adminList:
        AC->>FA: getIdTokenResult() → check custom claim admin
        note over AC: If no claim:
        AC->>FS: getDoc(users/{uid}) → check role == 'admin'
        FS-->>AC: Role doc
        AC-->>React: setUser(currentUser), setIsAdmin(bool), setIsLoading(false)
    else No cached session (first visit or logged out)
        FA-->>AC: currentUser = null
        AC-->>React: setUser(null), setIsAdmin(false), setIsLoading(false)
    end
```

### Phase 3 — AppContent Renders & Firestore Subscriptions Open

```mermaid
sequenceDiagram
    participant React as AppContent
    participant UAD as useAppData hook
    participant UP as usePermissions hook
    participant FS as Firestore
    participant LS as localStorage

    React->>LS: Read language preference\n(LanguageContext init)
    LS-->>React: 'en' | 'ne'

    React->>UAD: useAppData(user, isAdmin)

    alt user is logged in
        UAD->>FS: onSnapshot — trees where ownerUid == uid
        UAD->>FS: onSnapshot — trees where sharedWithEmails contains email
        FS-->>UAD: Stream of owned trees (live)
        FS-->>UAD: Stream of shared trees (live)
        note over UAD: Merge both streams, deduplicate by tree ID

        UAD->>FS: onSnapshot — calendarEvents where createdBy == uid
        UAD->>FS: onSnapshot — calendarEvents where isPublic == true
        FS-->>UAD: Personal events stream (live)
        FS-->>UAD: Public events stream (live)

        React->>UP: usePermissions(user)
        UP->>FS: getDoc(users/{uid}) → permissions map
        FS-->>UP: permissions (manageUsers, bulkUpload, etc.)
    else not logged in
        UAD-->>React: trees=[], events=[]
    end

    React->>FS: getDoc(siteSettings/block2)\n(TithiCalculatorButton visibility)
    FS-->>React: { visible: true | false }
```

### Phase 4 — Landing Page Renders

```mermaid
sequenceDiagram
    participant React as AppContent / Router
    participant LP as LandingPage
    participant FS as Firestore

    React->>React: Router matches path "/"
    React->>LP: Render LandingPage(trees, events, user, isAdmin)

    LP->>FS: onSnapshot — homeCards (published==true, ordered by order)
    FS-->>LP: Home card documents → renders Block1 hero cards

    LP->>FS: onSnapshot — calendarEvents (public, upcoming)
    FS-->>LP: Event list → renders EventList component

    LP->>LP: NepaliCalendar renders\n(BS date from current AD date via local conversion engine)

    note over LP: Page is now fully interactive\nAll data streams are live (real-time updates via onSnapshot)
```

### Full Trace — Single Timeline

The entire sequence above, collapsed into one linear view:

```
User → hamropanchanga.web.app
    │
    ▼ [~50ms] DNS resolution → Firebase CDN edge node
    │
    ▼ [~100–300ms] HTTP GET / → Firebase Hosting returns index.html
    │
    ▼ [~200–600ms] Browser downloads & parses React JS + CSS bundles
    │
    ▼ [~5ms] ReactDOM.createRoot().render(<App />)
    │         AuthProvider mounts → onAuthStateChanged registered
    │         LanguageProvider reads localStorage ('en'|'ne')
    │         Router initializes → matches "/"
    │
    ├─► [~20–80ms] Firebase Auth checks IndexedDB for persisted session
    │         ├── Session EXISTS:
    │         │     → getDoc(adminList/{uid})           [Firestore read]
    │         │     → getIdTokenResult()                [local JWT decode]
    │         │     → getDoc(users/{uid})               [Firestore read, if needed]
    │         │     → setIsLoading(false), render unlocks
    │         └── No Session:
    │               → setUser(null), setIsLoading(false), render unlocks
    │
    ▼ [isLoading = false → AppContent fully renders]
    │
    ├─► useAppData hook opens Firestore onSnapshot listeners (if logged in):
    │       • trees (owned)
    │       • trees (shared)
    │       • calendarEvents (personal)
    │       • calendarEvents (public)
    │
    ├─► usePermissions fetches users/{uid} permissions (if logged in)
    │
    ├─► TithiCalculatorButton fetches siteSettings/block2
    │
    ▼ LandingPage renders:
        ├─► homeCards onSnapshot → hero section
        ├─► calendarEvents feed → event list
        └─► NepaliCalendar (pure local computation, no network)

    ✅ Page fully interactive with live real-time data
```

> **Key timing note:** On a returning user (cached session), the total time from URL to interactive page is typically **800ms – 1.5s**, dominated by the JS bundle download. On a first visit (cold cache + no session), DNS + auth check can add an extra **200–400ms**.

---

## 4. Frontend Architecture

### Route Map

```mermaid
flowchart LR
    ROOT["/"] --> LANDING["LandingPage\n(Hero + Events + Calendar)"]
    ROOT --> TITHI["/tithi-calculator\nTithiCalculatorPage"]
    ROOT --> TREES["/trees\nTreeSelectionPage"]
    ROOT --> TREE["/tree/:treeId\nTreeDetailPage + Editor"]
    ROOT --> BUILDER["/builder\nEmbeddedBuilderPage"]
    ROOT --> DEV["/developer\nDeveloperPage (API Docs)"]

    ROOT --> ADMIN["Admin Routes\n(Role-gated)"]
    ADMIN --> AC["/admin/edit-cards\nAdminEditCards"]
    ADMIN --> AM["/admin/management\nAdminManagement"]
    ADMIN --> AT["/admin/tithis\nTithi CRUD"]
    ADMIN --> AE["/admin/events\nEvent Management"]
    ADMIN --> ACal["/admin/calendar\nCalendar Admin"]
    ADMIN --> ADM["/admin/data-management\nDataManagement"]

    ROOT --> UM["/user-management\nUserManagement (conditional)"]
```

### State Management — Context Providers

```mermaid
flowchart TD
    APP["App.js"] --> AUTH["AuthContext\n─────────────\nuser (Firebase User)\nisAdmin (boolean)\nisLoading\nlogout()"]
    APP --> LANG["LanguageContext\n─────────────\nlanguage: 'en' | 'ne'\nchangeLanguage()\nt(key) → translation\ntn(n) → Nepali numeral\nPersistedto localStorage"]
    AUTH --> ROUTES["Router + Protected Routes"]
    LANG --> ROUTES
```

### Custom Hooks

| Hook | Subscriptions / Responsibility |
|---|---|
| `useAppData(user, isAdmin)` | Real-time: owned trees + shared trees + calendar events |
| `useCalendarEvents(user)` | Real-time: personal events + public events |
| `usePermissions(user)` | Reads `users/{uid}` permissions map |
| `useTithisData(startDate, endDate)` | Firestore range query on `tithis` collection |
| `useTithiDateResolver()` | Resolves BS dates for tithi display |
| `useInView()` | IntersectionObserver for lazy rendering |

### Component Layers

```
src/components/
├── LandingPage.js              ← Home (hero, events, calendar preview)
├── TithiCalculatorPage.js      ← Tithi lookup interface
├── DeveloperPage.js            ← Public REST API documentation
├── NepaliCalendar.js           ← Monthly calendar view
├── NepaliDatePicker.js         ← Date picker (BS dates)
├── NepaliCalendarManagement.js ← Admin: manage BS year data
├── EventList.js                ← Event feed component
├── AddEventForm.js             ← Event creation form
├── BulkUploadModal.js          ← Excel bulk tree import
├── TreeShareModal.js           ← Tree sharing dialog
├── UserManagement.js           ← Admin: user role management
├── DataManagement.js           ← Admin: data operations
├── LanguageSelector.js         ← EN / NE switcher
├── Toast.js                    ← Notification toasts
├── Admin/
│   ├── AdminCalendarPage.js
│   ├── AdminEditCards.js       ← Home card CMS
│   └── AdminManagement.js
└── TreeBuilder/
    ├── TreeBuilderPage.js      ← Main tree editor
    ├── TreeDetailPage.js       ← Tree read-only preview
    ├── TreeSelectionPage.js    ← Tree list / picker
    ├── EmbeddedBuilderPage.js  ← Embeddable tree editor
    ├── nodes/
    │   ├── FamilyNode.js       ← ReactFlow person node
    │   └── MarriagePointNode.js← ReactFlow marriage node
    ├── edges/
    │   └── (custom edge types)
    └── utils/
        └── (tree manipulation, import/export)
```

### Services

| Service | Responsibility |
|---|---|
| `adminExcelService.js` | Excel read/write for admin bulk data operations |
| `BulkUploadService.js` | Client-side validation for bulk tree Excel uploads |
| `CalendarEventService.js` | CRUD operations for calendar events (Firestore) |
| `apiKeyRequestService.js` | Submit / manage API key requests |

---

## 5. Backend Architecture

The backend is entirely **serverless**, running as a single Firebase Cloud Function (`api`) exposing an Express.js REST server.

### REST API (`/v1/*`)

Authentication: `x-api-key` header validated against hashed keys stored in the `apiKeys` Firestore collection.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/v1/health` | No | Health check |
| GET | `/v1/calendar/:bsYear/:bsMonth` | API Key | Full Nepali month with AD dates + tithis |
| GET | `/v1/tithis` | API Key | Tithis in AD date range (`?startDate=&endDate=`) |
| GET | `/v1/events` | API Key | Public calendar events in date range |
| GET | `/v1/tithi/today` | API Key | Active tithi(s) at current moment |
| GET | `/v1/convert/ad-to-bs` | API Key | Single AD → BS conversion |
| GET | `/v1/convert/bs-to-ad` | API Key | Single BS → AD conversion |
| POST | `/v1/convert/batch` | API Key | Batch conversion (max 100 dates) |
| GET | `/v1/today` | API Key | Today's Nepali date (lightweight) |

### Callable Cloud Functions

| Function | Caller Requires | Description |
|---|---|---|
| `setAdminRole(email, makeAdmin)` | Admin auth claim | Assigns or revokes admin role via custom JWT claim |

### Middleware Stack (Cloud Functions)

```
HTTP Request
    │
    ▼
CORS Middleware (all origins)
    │
    ▼
Express JSON Parser
    │
    ▼
apiKeyMiddleware (hash-validates x-api-key against Firestore)
    │
    ▼
Route Handler
    │
    ▼
Firebase Admin SDK → Firestore / Auth
```

---

## 6. Database Design

**Type:** Google Cloud Firestore (NoSQL document database — conceptually similar to MongoDB collections/documents)  
**Named Instance:** `hamropanchanga-db`

### Collections Overview

```mermaid
erDiagram
    trees {
        string ownerUid
        string name
        map sharedWith
        array sharedWithEmails
        boolean deleted
        timestamp createdAt
    }
    trees_members {
        string name
        string gender
        string dob
        string photoUrl
        string treeId
    }
    trees_relationships {
        string type
        string sourceId
        string targetId
    }
    trees_marriagePoints {
        string spouse1Id
        string spouse2Id
        string position
    }
    users {
        string email
        string displayName
        string role
        map permissions
        boolean active
        timestamp createdAt
    }
    adminList {
        string uid
    }
    userInvitations {
        string role
        map permissions
        string displayName
        boolean processed
    }
    calendarEvents {
        string createdBy
        string treeId
        string dateKey
        boolean isPublic
        string title
        string description
    }
    tithis {
        string name
        string tithiMonth
        string paksha
        string startDate
        string endDate
        string startTime
        string endTime
        string category
    }
    nepaliCalendarYears {
        number bsYear
        string adStartDate
        array monthData
    }
    apiKeys {
        string hashedKey
        string ownerUid
        boolean active
        timestamp createdAt
    }
    apiKeyRequests {
        string requesterUid
        string email
        string status
        timestamp createdAt
    }
    siteSettings {
        boolean showTithiCalculator
    }

    trees ||--o{ trees_members : "subcollection"
    trees ||--o{ trees_relationships : "subcollection"
    trees ||--o{ trees_marriagePoints : "subcollection"
    users ||--o{ trees : "owns (ownerUid)"
    users ||--o{ calendarEvents : "creates (createdBy)"
    trees ||--o{ calendarEvents : "linked (treeId)"
    adminList ||--|| users : "references uid"
```

### Key Firestore Indexes

| Collection | Indexed Fields | Purpose |
|---|---|---|
| `tithis` | `(startDate ASC, startTime ASC)` | Date-range tithi queries |
| `calendarEvents` | `(createdBy, dateKey)` | Personal events by date |
| `calendarEvents` | `(isPublic, dateKey)` | Public events by date |
| `calendarEvents` | `(treeId, dateKey)` | Tree-linked events by date |
| `homeCards` | `(published, order)` | Home page card ordering |

### Firestore Security Rules Summary

```
trees       → owner full access; sharedWith[email].permission governs read/edit for others
users       → self read/write; admin reads all
adminList   → admin write; authenticated read
tithis      → admin write; authenticated read
apiKeys     → admin write; owner read
calendarEvents → creator full access; public events readable by authenticated users
```

---

## 7. Authentication & Role-Based Access Control

### Sign-In Flow

```mermaid
sequenceDiagram
    participant U as User
    participant SPA as React SPA
    participant FA as Firebase Auth
    participant FS as Firestore

    U->>SPA: Click "Sign in with Google"
    SPA->>FA: signInWithPopup(GoogleProvider)
    FA-->>SPA: Firebase User + ID Token

    SPA->>FS: Check userInvitations/{email}
    alt Invitation exists & not processed
        FS-->>SPA: Invitation doc (role, permissions)
        SPA->>FS: Create users/{uid} with role/permissions
        SPA->>FS: Mark invitation processed
    end

    SPA->>FS: Check adminList/{uid}
    SPA->>FA: Check custom claim admin==true
    SPA->>FS: Check users/{uid}.role == 'admin'
    SPA-->>U: Authenticated session (isAdmin resolved)
```

### Role Hierarchy & Permissions

```mermaid
flowchart TD
    ADMIN["Admin\n───────────────\n✅ manageUsers\n✅ viewAllCustomers\n✅ manageHomeCards\n✅ bulkUpload\n✅ manageTithis\n✅ manageEvents\n✅ manageCalendar\n✅ manualDashboard\n✅ manageOwnCustomers\n✅ viewOwnCustomers"]

    SUPER["Super User\n───────────────\n❌ manageUsers\n❌ viewAllCustomers\n⚙️ manageHomeCards (config)\n⚙️ bulkUpload (config)\n⚙️ manageTithis (config)\n⚙️ manageEvents (config)\n⚙️ manageCalendar (config)\n⚙️ manualDashboard (config)\n✅ manageOwnCustomers\n✅ viewOwnCustomers"]

    USER["User\n───────────────\n❌ All admin perms\n✅ manageOwnCustomers\n✅ viewOwnCustomers"]

    ADMIN --> SUPER
    SUPER --> USER
```

`⚙️ config` = permission granted or revoked individually by Admin per Super User account.

---

## 8. Tithi Calculation Pipeline

Tithis are Hindu lunar days, calculated from the angular difference between the Moon and Sun.

```mermaid
flowchart TD
    A["Input: UTC Timestamp"] --> B["astronomy-engine\nGeoVector(Moon, time)\nGeoVector(Sun, time)"]
    B --> C["EclipticGeoMoon()\nEclipticGeoSun()\n→ ecliptic longitude (0–360°)"]
    C --> D["Δ = Moon longitude − Sun longitude\n(normalized 0–360°)"]
    D --> E["Tithi Index = floor(Δ / 12°) + 1\n(1 = Pratipada → 30 = Amavasya)"]
    E --> F["Tithi Progress = (Δ mod 12°) / 12°\n(0.0 → 1.0)"]
    F --> G["Calculate transition timestamp\nwhen Δ crosses next 12° boundary"]
    G --> H["Return: { index, name, paksha,\nstartTime, endTime, progress }"]
```

**Paksha (lunar fortnight):**
- Index 1–15 → **Shukla Paksha** (waxing moon)
- Index 16–30 → **Krishna Paksha** (waning moon)

---

## 9. Deployment Topology

```mermaid
flowchart LR
    subgraph Dev["Local Development"]
        CODE["Source Code\n(React + Functions)"]
        EMU["Firebase Emulator Suite\n─ Functions :5001\n─ Firestore :8080\n─ Emulator UI"]
    end

    subgraph Build["Build Step"]
        CRA["npm run build\n(React Scripts)\n→ /build output"]
        ENV[".env\nREACT_APP_FIREBASE_*\nREACT_APP_FIRESTORE_DATABASE_ID"]
    end

    subgraph Firebase["Firebase Platform (Production)"]
        FH["Firebase Hosting\n/build → CDN"]
        FCF["Cloud Functions\n(Node.js 20)\n/functions"]
        FS["Firestore\nhamropanchanga-db"]
        FA["Firebase Auth"]
        FCST["Cloud Storage"]
    end

    CODE --> EMU
    CODE --> CRA
    ENV --> CRA
    CRA -- "firebase deploy --only hosting" --> FH
    CODE -- "firebase deploy --only functions" --> FCF
    FCF --> FS
    FCF --> FA
    FH --> FA
    FH --> FS
    FH --> FCST
```

### Deploy Commands

```bash
# Build frontend
npm run build

# Deploy everything
firebase deploy

# Deploy only hosting (frontend)
firebase deploy --only hosting

# Deploy only Cloud Functions
firebase deploy --only functions

# Run locally with emulators
firebase emulators:start
```

---

## 10. Data Flow Diagrams

### Real-Time Family Tree Loading

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant FS as Firestore

    SPA->>FS: onSnapshot(trees where ownerUid == uid)
    FS-->>SPA: Owned trees (live stream)

    SPA->>FS: onSnapshot(trees where sharedWithEmails contains email)
    FS-->>SPA: Shared trees (live stream)

    note over SPA: Merge + deduplicate owned and shared trees

    SPA->>FS: onSnapshot(trees/{id}/members)
    FS-->>SPA: Members (live stream)

    SPA->>FS: onSnapshot(trees/{id}/relationships)
    FS-->>SPA: Edges (live stream)

    note over SPA: ReactFlow renders nodes + edges as interactive graph
```

### Bulk Upload Flow

```mermaid
sequenceDiagram
    participant U as Admin User
    participant SPA as React SPA
    participant BUS as BulkUploadService
    participant FS as Firestore

    U->>SPA: Upload Excel file
    SPA->>BUS: parseAndValidate(file)
    BUS-->>SPA: ValidationResult (errors / parsed rows)

    alt Validation passed
        SPA->>FS: batch.set() — create tree doc
        SPA->>FS: batch.set() — create members subcollection
        SPA->>FS: batch.set() — create relationships subcollection
        FS-->>SPA: Batch commit success
        SPA-->>U: Success toast
    else Validation failed
        SPA-->>U: Error list with row/column references
    end
```

### Public API Request Flow

```mermaid
sequenceDiagram
    participant DEV as API Consumer
    participant CF as Cloud Function (Express)
    participant AKM as apiKeyMiddleware
    participant FS as Firestore

    DEV->>CF: GET /v1/calendar/2081/1\n(x-api-key: abc123)

    CF->>AKM: Validate API key
    AKM->>FS: Query apiKeys where hash == SHA256(abc123)
    FS-->>AKM: Key doc (active: true)
    AKM-->>CF: Key valid

    CF->>FS: Query nepaliCalendarYears (bsYear 2081)
    CF->>FS: Query tithis (startDate in month range)
    FS-->>CF: Calendar + tithi data

    CF-->>DEV: JSON response\n{ bsYear, bsMonth, days: [...], tithis: [...] }
```

---

## Summary

| Layer | Technology |
|---|---|
| UI Framework | React 18 (Create React App) |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS + PostCSS |
| Graph Visualization | ReactFlow |
| State Management | React Context API (Auth + Language) |
| Database | Firebase Firestore (NoSQL) |
| Authentication | Firebase Auth — Google OAuth + custom claims |
| Backend | Firebase Cloud Functions (Express.js / Node.js 20) |
| File Storage | Firebase Cloud Storage |
| Hosting | Firebase Hosting (SPA) |
| Astronomical Engine | astronomy-engine (Moon/Sun positions) |
| Calendar System | Custom BS ↔ AD conversion engine |
| Internationalization | Custom Context-based i18n (EN / NE) |
| Excel I/O | xlsx library |
| Image Export | html-to-image |
