# HamroPanchanga — Flutter Android App: Direction Document

## Context

This document captures the direction for building a Flutter-based Android companion app for **HamroPanchanga** (`hamropanchanga.web.app`). It is intended as a reference when starting fresh in the new Flutter repo.

The web app source lives at: `c:\private\test-claude-code\hamropanchanga`

---

## What Is HamroPanchanga?

A **Nepali calendar and family genealogy platform** targeting the Nepali/Hindu community globally. Core value propositions:

- **Bikram Sambat (BS) calendar** — the official Nepali calendar system, offset ~56–57 years ahead of AD
- **Tithi calculation** — Hindu lunar day (1–30 per lunar month) computed from Moon/Sun ecliptic longitude using `astronomy-engine`
- **Family tree builder** — interactive graph-based genealogy editor
- **Calendar events** — personal/public events tied to BS dates or Tithis, with WhatsApp reminders
- **AI chat assistant** — backed by Anthropic Claude or AWS Bedrock
- **Public REST API** — for third-party developers

---

## Why a Separate Flutter Repo?

- The web app is a complete, deployed React SPA with its own CI/CD (Firebase Hosting)
- Flutter introduces separate tooling (Gradle, Flutter SDK, Dart) incompatible with the existing Node.js/npm setup
- Different release cycle: Play Store reviews vs. instant web deploys
- No monorepo tooling is configured in the web repo
- iOS support is a free future option with Flutter at no architectural cost

---

## Tech Stack Decisions

| Concern | Decision |
|---|---|
| Framework | Flutter (latest stable) |
| Language | Dart |
| Target platform | Android (iOS kept open for later) |
| Auth | Firebase Authentication (Google OAuth + email/password) |
| Database | Firestore (`hamropanchanga-db`) — same instance as web app |
| Storage | Firebase Cloud Storage |
| State management | Riverpod (preferred) or Bloc — decide at project start |
| Local persistence | Hive or Isar for offline caching |
| Push notifications | Firebase Cloud Messaging (FCM) |
| HTTP / REST | Dio |
| Firebase integration | FlutterFire (official Firebase Flutter SDK) |

---

## Shared Backend (Do Not Rebuild)

The Flutter app consumes the **existing Firebase backend** — it does not need its own backend.

**Firebase project:** `hamropanchanga` (Firestore database: `hamropanchanga-db`)

**Existing Cloud Functions REST API (already live):**
- `GET /v1/calendar/:bsYear/:bsMonth` — full Nepali month with AD dates + Tithis
- `GET /v1/tithis?startDate=&endDate=` — Tithi range query
- `GET /v1/events?startDate=&endDate=` — public calendar events
- `GET /v1/tithi/today` — current Tithi
- `GET /v1/convert/ad-to-bs`, `GET /v1/convert/bs-to-ad` — date conversions
- `GET /v1/today` — today's Nepali date

Auth for API: SHA-256 hashed API keys stored in `apiKeys` Firestore collection.

**WhatsApp notifications:** Meta Cloud API (WhatsApp Business Cloud) — existing templates: `tree_shared`, `event_reminder`.

---

## Key Firestore Collections

| Collection | Purpose |
|---|---|
| `trees` | Family tree metadata (owner, sharing, name) |
| `trees/{id}/members` | Individual people in a tree |
| `trees/{id}/relationships` | Parent/child/spouse edges |
| `trees/{id}/marriagePoints` | Marriage nodes (spouse1, spouse2) |
| `users` | User profiles, roles (`admin`/`super`/`user`), phone |
| `calendarEvents` | Personal + public events tied to BS date or Tithi |
| `tithis` | Tithi definitions (name, paksha, start/end times) |
| `nepaliCalendarYears` | Pre-computed BS year tables (BS 2000–2200) |
| `userContacts` | Address book per user |

---

## Phase 1 Scope — Companion App (MVP)

Focus on **daily-use, mobile-native features** first. Leave the complex tree builder (desktop-optimized) for a later phase.

### Core Screens

1. **Home / Today Screen**
   - Today's BS date, day name (Nepali + English)
   - Current Tithi name and Paksha
   - Upcoming festivals/events (next 7 days)
   - Quick date converter widget

2. **BS Calendar Screen**
   - Monthly calendar grid in Bikram Sambat
   - Highlight Tithis and public events on each day
   - Navigate forward/backward by month

3. **Tithi Calculator Screen**
   - Pick any AD or BS date → get the Tithi
   - Show Tithi name, Paksha (Shukla/Krishna), lunar day number

4. **Events Screen**
   - List of upcoming personal + public events
   - Create/edit personal events tied to a BS date or Tithi

5. **Family Tree (Read-Only, Phase 1)**
   - List user's trees
   - View tree members and basic relationships (list/card view)
   - Full interactive graph editor deferred to Phase 2

6. **Auth Screens**
   - Sign in with Google
   - Email/password sign in
   - Phone number setup (for WhatsApp notifications)

7. **Settings Screen**
   - Language toggle (English / Nepali)
   - Notification preferences
   - AI provider config (Anthropic / AWS Bedrock keys)

### Mobile-Native Features (not on web)

- **Push notifications** via FCM — event reminders, tree sharing alerts
- **Home screen widget** — today's BS date + Tithi (Android App Widget)
- **Offline mode** — cache calendar data and tree members locally (Hive/Isar)

---

## Phase 2 Scope (Future)

- Interactive family tree graph editor (flutter_graph_view or custom)
- Bulk upload via mobile (Excel parsing with `excel` Dart package)
- AI chat assistant panel
- iOS release (no code changes needed, just App Store setup)

---

## Tithi Calculation Notes

The web app computes Tithis client-side using `astronomy-engine` (JS). For Flutter, two options:

1. **Use the Cloud Functions API** (`/v1/tithi/today`, `/v1/tithis`) — simplest, no reimplementation
2. **Port to Dart** — compute ecliptic longitude of Moon and Sun, take `Δ = moonLon - sunLon`, then `Tithi = floor(Δ / 12°) + 1`. Use the `astronomy` Dart package or port the JS logic directly.

For Phase 1, use the API. Port to Dart only if offline Tithi calculation becomes a requirement.

---

## BS ↔ AD Date Conversion

Pre-computed year tables exist in Firestore (`nepaliCalendarYears`, BS 2000–2200). The web app also bundles them locally. For the Flutter app:

- Fetch and cache the tables via Firestore or the REST API
- Implement the conversion logic in Dart (straightforward arithmetic once tables are cached)
- Cache locally (Hive) so conversion works offline

---

## Project Setup Checklist (New Repo)

- [ ] `flutter create hamropanchanga_app --org com.hamropanchanga`
- [ ] Add `google-services.json` (Android) from Firebase console
- [ ] Add FlutterFire packages: `firebase_core`, `firebase_auth`, `cloud_firestore`, `firebase_storage`, `firebase_messaging`
- [ ] Set up Riverpod (or Bloc) for state management
- [ ] Set up flavors: `dev` and `prod` (pointing to same Firebase project, different env configs)
- [ ] Configure signing keystore for Play Store
- [ ] Set up GitHub Actions: lint → test → build APK/AAB on PR

---

## Design Direction

- Follow **Material Design 3** (Flutter's default M3 theme)
- Color palette: pull from the web app (red/white primary — typical Nepali cultural palette)
- Bilingual: all user-facing strings must support English and Nepali (use Flutter's `intl` / `flutter_localizations`)
- Nepali text rendering: ensure Devanagari script renders correctly (Flutter supports it natively via Noto fonts)

---

## References

- Web app repo: `c:\private\test-claude-code\hamropanchanga`
- Live web app: `https://hamropanchanga.web.app`
- Firebase project: `hamropanchanga`
- Firestore database: `hamropanchanga-db`
- External MCP server: `https://hamropanchanga-mcp-server.up.railway.app`
- Meta WhatsApp API version in use: `v21.0`
