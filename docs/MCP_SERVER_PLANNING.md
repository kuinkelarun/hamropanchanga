# MCP Server Planning Document — Hamropanchanga

**Date:** April 19, 2026  
**Status:** Draft v2 — Ready for review  
**Project:** `hamropanchanga` (family-tree-app)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Why Cloud Run (Not Cloud Functions)](#3-why-cloud-run-not-cloud-functions)
4. [Authentication](#4-authentication)
5. [Firestore Data Model Reference](#5-firestore-data-model-reference)
6. [MCP Prompts — Conversation Templates](#6-mcp-prompts--conversation-templates)
7. [MCP Tools — Full Specification](#7-mcp-tools--full-specification)
8. [MCP Resources](#8-mcp-resources)
9. [Existing REST API (Reference)](#9-existing-rest-api-reference)
10. [Client-Side Utilities to Port](#10-client-side-utilities-to-port)
11. [Project Structure](#11-project-structure)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment](#14-deployment)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

Build a **standalone MCP server** (Node.js, Streamable HTTP transport) that exposes Hamropanchanga's Firestore data as tools, resources, and prompts. Any MCP-compatible client — Claude Desktop, VS Code Copilot, a custom chat UI, or third-party apps — can connect and interact with family trees, calendar events, tithis, and members on behalf of authenticated users.

MCP prompts define structured conversation templates with required/optional fields so the LLM knows exactly what to ask the user before executing write operations.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  MCP CLIENTS                                            │
│  • Claude Desktop                                       │
│  • VS Code (GitHub Copilot)                             │
│  • Custom Chat UI (React widget — Phase 3)              │
│  • Any third-party MCP-compatible app                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Streamable HTTP
                       │ POST/GET https://mcp.hamropanchanga.app/mcp
                       │ Authorization: Bearer <Firebase ID token>
                       │ Mcp-Session-Id: <session-uuid>
                       │
┌──────────────────────▼──────────────────────────────────┐
│  MCP SERVER (Cloud Run)                                 │
│                                                         │
│  @modelcontextprotocol/sdk                              │
│  ┌───────────┐  ┌────────┐  ┌───────────┐              │
│  │  Prompts  │  │ Tools  │  │ Resources │              │
│  │  (4)      │  │ (14)   │  │ (3)       │              │
│  └───────────┘  └────────┘  └───────────┘              │
│                                                         │
│  Auth middleware: verifyIdToken(bearer) → uid            │
│  All Firestore ops scoped to authenticated uid          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ firebase-admin SDK
                       │
┌──────────────────────▼──────────────────────────────────┐
│  FIRESTORE (hamropanchanga-db)                          │
│                                                         │
│  trees, trees/{id}/members, trees/{id}/relationships,   │
│  trees/{id}/marriagePoints, calendarEvents, users,      │
│  tithis, nepaliCalendarYears                            │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Standalone server** — not embedded in Cloud Functions. Keeps MCP concerns separate from the existing REST API.
- **Streamable HTTP** — single endpoint, POST for JSON-RPC messages, optional GET for SSE stream. Session affinity via `Mcp-Session-Id` header.
- **firebase-admin** — server-side SDK with service account. All queries scoped to the authenticated user's `uid` (owner check, `sharedWith` check, or admin role).

---

## 3. Why Cloud Run (Not Cloud Functions)

| Concern | Cloud Functions | Cloud Run |
|---------|----------------|-----------|
| Max request duration | 9 min (2nd gen) | 60 min |
| SSE / long-lived connections | Not supported | Native support |
| Session state (in-memory) | Lost between invocations | Preserved within instance |
| Cold starts | Frequent, breaks streams | `--min-instances=1` option |
| Cost at low traffic | Pay-per-invocation (cheap) | Pay-per-container-second |
| Deployment | `gcloud functions deploy` | `gcloud run deploy` or Dockerfile |

**Verdict:** Cloud Run is required for Streamable HTTP's optional SSE channel and for maintaining session state across multiple tool calls in a conversation.

---

## 4. Authentication

```
Client                    MCP Server                    Firebase Auth
  │                           │                              │
  │  POST /mcp                │                              │
  │  Authorization: Bearer <idToken>                         │
  │ ─────────────────────────>│                              │
  │                           │  admin.auth().verifyIdToken()│
  │                           │ ────────────────────────────>│
  │                           │         { uid, email }       │
  │                           │ <────────────────────────────│
  │                           │                              │
  │                           │  ctx.uid = uid               │
  │                           │  Proceed with tool execution │
```

- The MCP client obtains a Firebase ID token via Google OAuth (same flow the React app uses).
- Every MCP request includes `Authorization: Bearer <idToken>`.
- The server verifies the token with `firebase-admin` and extracts `uid` + `email`.
- All Firestore queries are scoped: `where('ownerUid', '==', uid)` or checked against `sharedWith`.
- Admin operations check `customClaims.admin` or the `adminList` collection.
- **No API keys** — MCP uses user identity, not the REST API's hashed-key system.

---

## 5. Firestore Data Model Reference

### 5.1 Trees

**Collection:** `trees`

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Tree name |
| `titleNormalized` | string | Lowercase for search |
| `ownerUid` | string | Firebase Auth UID |
| `ownerEmail` | string | Owner's email |
| `primaryMemberName` | string | Root person's name |
| `contact` | string | Contact info |
| `location` | string | Location |
| `deleted` | boolean | Soft-delete flag |
| `sharedWith` | map | `{ email: { permission: 'view'|'edit', sharedAt } }` |
| `sharedWithEmails` | array | Email list for `array-contains` queries |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 5.2 Members

**Collection:** `trees/{treeId}/members`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name |
| `nickname` | string | |
| `notes` | string | |
| `location` | string | |
| `*Normalized` | string | Lowercase variants for search |

### 5.3 Relationships

**Collection:** `trees/{treeId}/relationships`

| Field | Type | Description |
|-------|------|-------------|
| `fromMemberId` | string | Source member |
| `toMemberId` | string | Target member |
| `type` | string | `parent`, `child`, `spouse`, `custom` |

### 5.4 Marriage Points

**Collection:** `trees/{treeId}/marriagePoints`

Used for ReactFlow canvas layout. Not relevant for MCP tools (internal UI concern).

### 5.5 Calendar Events

**Collection:** `calendarEvents` (top-level)

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Event name |
| `titleNormalized` | string | Lowercase |
| `description` | string | |
| `dateKey` | string | AD date in `YYYY-MM-DD` format |
| `repetition` | string | `none`, `monthly`, `yearly` |
| `tithi` | object \| null | `{ id, name, paksha, month }` if tithi-based |
| `nepaliDateForRecurrence` | object \| null | BS date for recurring Nepali events |
| `isPublic` | boolean | Visible to all users |
| `createdBy` | string | Firebase UID |
| `createdByAdmin` | boolean | |
| `treeId` | string \| null | Associated tree |
| `memberId` | string \| null | Associated member |
| `createdAt` | timestamp | |

**Six event combinations:**

| # | Target | Date Mode | Example |
|---|--------|-----------|---------|
| 1 | Self | AD date | "My birthday Jan 15" |
| 2 | Self | Tithi | "My Shraddha on Kartik Sukla Pratipada" |
| 3 | Member | AD date | "Dad's birthday Apr 3" |
| 4 | Member | Tithi | "Grandpa's Shraddha on Baisakh Krishna Amavasya" |
| 5 | Self + repetition | AD/Tithi | "Anniversary (yearly)" |
| 6 | Member + repetition | AD/Tithi | "Mom's birthday (yearly)" |

### 5.6 Other Collections (Read-Only for MCP)

| Collection | Description |
|------------|-------------|
| `tithis` | Pre-computed tithi data |
| `nepaliCalendarYears` | BS calendar year data |
| `users` | User profiles, roles, permissions |

---

## 6. MCP Prompts — Conversation Templates

MCP prompts are **not** Zod schemas. They use flat `arguments[]` arrays where each argument has `name`, `description`, and `required`. The LLM uses these to know what to ask the user.

### 6.1 `add-event`

Creates a calendar event. Handles all 6 date/target/repetition combinations.

| Argument | Required | Description |
|----------|----------|-------------|
| `title` | Yes | Event name (e.g., "Dad's Shraddha") |
| `dateMode` | Yes | `"ad-date"` or `"tithi"` |
| `date` | No | AD date in YYYY-MM-DD format (required if dateMode is "ad-date") |
| `tithiMonth` | No | Nepali month name (required if dateMode is "tithi") |
| `tithiPaksha` | No | `"shukla"` or `"krishna"` (required if dateMode is "tithi") |
| `tithiName` | No | Tithi name, e.g., "Pratipada" (required if dateMode is "tithi") |
| `target` | Yes | `"self"` or `"member"` |
| `treeName` | No | Tree name (required if target is "member") |
| `memberName` | No | Member name (required if target is "member") |
| `repetition` | Yes | `"none"`, `"monthly"`, or `"yearly"` |
| `description` | No | Optional description |

**Prompt message template:**
```
You are helping the user add a calendar event to Hamropanchanga.
Ask for the event title, whether it's based on an AD date or a tithi,
the target (self or a family member), and whether it repeats.
If tithi-based, ask for the Nepali month, paksha, and tithi name.
If targeting a member, ask which tree and which member.
Then call the create-event tool with the collected information.
```

### 6.2 `add-tree-member`

Adds a new member to an existing family tree.

| Argument | Required | Description |
|----------|----------|-------------|
| `treeName` | Yes | Name of the tree to add to |
| `memberName` | Yes | Full name of the new member |
| `gender` | Yes | `"male"`, `"female"`, or `"other"` |
| `dateOfBirth` | No | Date of birth (AD, YYYY-MM-DD) |
| `relationTo` | No | Name of existing member this person is related to |
| `relationType` | No | `"parent"`, `"child"`, `"spouse"` |

**Prompt message template:**
```
You are helping the user add a member to a family tree.
Ask which tree, the member's name, gender, and optionally
their date of birth and relationship to an existing member.
Then call the add-member tool (and add-relationship if a relation is specified).
```

### 6.3 `create-tree`

Creates a new family tree.

| Argument | Required | Description |
|----------|----------|-------------|
| `title` | Yes | Tree name |
| `primaryMemberName` | No | Name of the first/root member |
| `location` | No | Location associated with the tree |

### 6.4 `query-events`

Queries calendar events with filters.

| Argument | Required | Description |
|----------|----------|-------------|
| `timeRange` | Yes | `"today"`, `"this-week"`, `"this-month"`, `"custom"` |
| `startDate` | No | Start date YYYY-MM-DD (required if timeRange is "custom") |
| `endDate` | No | End date YYYY-MM-DD (required if timeRange is "custom") |
| `type` | No | `"all"`, `"tithi-based"`, `"date-based"` |
| `treeName` | No | Filter by tree name |

---

## 7. MCP Tools — Full Specification

### 7.1 Read Tools (Phase 1)

#### `list-my-trees`

List all trees the authenticated user owns or has access to.

- **Parameters:** none (uses auth context)
- **Returns:** Array of `{ id, title, primaryMemberName, location, memberCount, role }` where `role` is `owner` or `shared`
- **Firestore:** Query `trees` where `ownerUid == uid` OR `sharedWithEmails array-contains email`, filter `deleted != true`

#### `list-tree-members`

List all members of a specific tree.

- **Parameters:** `treeId` (string, required) OR `treeName` (string, required — resolved to treeId)
- **Returns:** Array of `{ id, name, nickname, location }`
- **Firestore:** `trees/{treeId}/members`
- **Auth check:** User must own or have shared access to the tree

#### `list-events`

List calendar events, with optional filters.

- **Parameters:**
  - `treeId` (string, optional) — filter by tree
  - `startDate` (string, optional) — YYYY-MM-DD
  - `endDate` (string, optional) — YYYY-MM-DD
  - `type` (string, optional) — `"tithi-based"` | `"date-based"` | `"all"`
- **Returns:** Array of event objects with `{ id, title, dateKey, repetition, tithi, treeId, memberId }`
- **Firestore:** `calendarEvents` where `createdBy == uid` (+ optional treeId/dateKey filters)

#### `count-events`

Count events matching criteria (useful for "how many events do I have?" type queries).

- **Parameters:** Same filters as `list-events`
- **Returns:** `{ count: number }`

#### `get-tithi-info`

Get tithi information for a specific date.

- **Parameters:** `date` (string, YYYY-MM-DD — defaults to today)
- **Returns:** `{ date, tithiName, paksha, pakshaIndex, progress, moonLon, sunLon }`
- **Implementation:** Uses `astronomy-engine` library (ported from client-side `src/utils/ephemeris.js`)

#### `resolve-tithi`

Given a tithi specification, find the next (or previous) occurrence as an AD date.

- **Parameters:**
  - `tithiName` (string, required) — e.g., "Pratipada"
  - `paksha` (string, required) — "shukla" or "krishna"
  - `month` (string, optional) — Nepali month name
  - `direction` (string, optional) — "next" (default) or "previous"
- **Returns:** `{ adDate, bsDate, tithiName, paksha, month }`
- **Implementation:** Uses `findTithiBoundary()` from ephemeris utils

#### `search-members`

Search for members across all accessible trees by name.

- **Parameters:** `query` (string, required)
- **Returns:** Array of `{ memberId, memberName, treeId, treeName }`
- **Firestore:** Query across accessible trees, filter by name/nickname containing query (normalized)

### 7.2 Write Tools (Phase 2)

#### `create-event`

Create a calendar event. Handles all 6 combinations (self/member × date/tithi × repetition).

- **Parameters:**
  - `title` (string, required)
  - `description` (string, optional)
  - `dateKey` (string, required for AD-date events) — YYYY-MM-DD
  - `tithi` (object, optional) — `{ name, paksha, month }` for tithi-based events
  - `repetition` (string, required) — `"none"`, `"monthly"`, `"yearly"`
  - `treeId` (string, optional) — associate with a tree
  - `memberId` (string, optional) — associate with a member
  - `isPublic` (boolean, optional, default false)
- **Returns:** `{ id, title, dateKey }`
- **Firestore:** Creates doc in `calendarEvents` with `createdBy = uid`
- **Validation:**
  - If `memberId` is set, `treeId` must also be set
  - If tithi-based, resolve to AD date using `resolve-tithi` logic
  - User must own or have edit access to the tree (if treeId is set)

#### `update-event`

Update an existing calendar event.

- **Parameters:** `eventId` (string, required) + any fields from `create-event`
- **Returns:** `{ id, updated: true }`
- **Auth check:** `createdBy == uid` or admin

#### `delete-event`

Delete a calendar event.

- **Parameters:** `eventId` (string, required)
- **Returns:** `{ id, deleted: true }`
- **Auth check:** `createdBy == uid` or admin

#### `create-tree`

Create a new family tree.

- **Parameters:**
  - `title` (string, required)
  - `primaryMemberName` (string, optional)
  - `location` (string, optional)
  - `contact` (string, optional)
- **Returns:** `{ id, title }`
- **Firestore:** Creates doc in `trees` with `ownerUid = uid`

#### `add-member`

Add a member to a tree.

- **Parameters:**
  - `treeId` (string, required)
  - `name` (string, required)
  - `nickname` (string, optional)
  - `notes` (string, optional)
  - `location` (string, optional)
- **Returns:** `{ id, name, treeId }`
- **Auth check:** User must have edit permission on the tree

#### `add-relationship`

Add a relationship between two members.

- **Parameters:**
  - `treeId` (string, required)
  - `fromMemberId` (string, required)
  - `toMemberId` (string, required)
  - `type` (string, required) — `"parent"`, `"child"`, `"spouse"`, `"custom"`
- **Returns:** `{ id, type, from, to }`
- **Auth check:** User must have edit permission on the tree

#### `delete-member`

Delete a member and all their relationships from a tree.

- **Parameters:** `treeId` (string, required), `memberId` (string, required)
- **Returns:** `{ memberId, deleted: true, relationshipsRemoved: number }`
- **Implementation:** Calls `Relationships.removeByMember()` then `Members.delete()`
- **Auth check:** User must have edit permission on the tree

---

## 8. MCP Resources

Resources provide read-only, URI-addressable data that clients can subscribe to.

| URI Pattern | Description | Data |
|-------------|-------------|------|
| `tree://{treeId}` | A specific tree with members | Tree metadata + member list |
| `events://upcoming` | User's events in the next 30 days | Filtered event list |
| `tithi://today` | Today's tithi information | Current tithi, paksha, progress |

Resources are lower priority than tools/prompts and can be added incrementally.

---

## 9. Existing REST API (Reference)

The REST API (`functions/api/routes.js`) uses hashed API keys and is designed for third-party developers. The MCP server does **not** call the REST API — it talks directly to Firestore via `firebase-admin`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check |
| GET | `/v1/calendar/:bsYear/:bsMonth` | Full BS month with AD dates + tithis |
| GET | `/v1/tithis?startDate=&endDate=` | Tithi windows in AD date range |
| GET | `/v1/events?startDate=&endDate=` | Public calendar events |
| GET | `/v1/tithi/today` | Active tithi at current NPT moment |
| GET | `/v1/convert/ad-to-bs?date=` | AD → BS date conversion |
| GET | `/v1/convert/bs-to-ad?year=&month=&day=` | BS → AD date conversion |
| POST | `/v1/convert/batch` | Batch date conversions (max 100) |
| GET | `/v1/today` | Today's date in BS |

---

## 10. Client-Side Utilities to Port

These modules currently run in the browser. The MCP server needs server-side equivalents:

### 10.1 Tithi Calculation (`src/utils/ephemeris.js`)

| Function | Purpose | Port Strategy |
|----------|---------|---------------|
| `computeTithiFromLongitudes(moonLon, sunLon)` | Compute tithi index, paksha, progress | Copy directly — pure math |
| `getLongitudesAtTime(date)` | Get Moon/Sun ecliptic longitudes | Copy — uses `astronomy-engine` npm package |
| `findTithiBoundary(date, targetIndex, direction)` | Binary search for tithi start/end | Copy directly |
| `getEphemerisData(date, lat, lon)` | Full ephemeris for a date | Copy directly |

`astronomy-engine` is an npm package — works identically in Node.js. No changes needed, just import the module.

### 10.2 Event Document Builder (`src/services/CalendarEventService.js`)

| Function | Purpose | Port Strategy |
|----------|---------|---------------|
| `buildEventDocument(params)` | Construct Firestore event doc | Copy and adapt — replace client `serverTimestamp()` with admin SDK equivalent |

### 10.3 Tree/Member CRUD (`src/components/TreeBuilder/utils/firestoreTreeApi.js`)

| API | Functions | Port Strategy |
|-----|-----------|---------------|
| `Trees` | `create`, `list`, `get`, `update`, `delete` | Rewrite with `firebase-admin` — same logic, different SDK |
| `Members` | `create`, `list`, `update`, `delete` | Same |
| `Relationships` | `create`, `list`, `update`, `delete`, `removeByMember` | Same |

**Key difference:** Client SDK uses `getFirestore()` from `firebase/firestore`. Server uses `admin.firestore()`. Query syntax is slightly different but the logic is identical.

---

## 11. Project Structure

```
mcp-server/
├── package.json
├── tsconfig.json                    # TypeScript for type safety
├── Dockerfile
├── .env.example
├── src/
│   ├── index.ts                     # Entry point — create MCP server, register handlers
│   ├── server.ts                    # MCP server setup with StreamableHTTPServerTransport
│   ├── auth/
│   │   └── firebase.ts              # firebase-admin init + verifyIdToken middleware
│   ├── prompts/
│   │   ├── index.ts                 # Register all prompts
│   │   ├── addEvent.ts              # add-event prompt definition
│   │   ├── addTreeMember.ts         # add-tree-member prompt definition
│   │   ├── createTree.ts            # create-tree prompt definition
│   │   └── queryEvents.ts           # query-events prompt definition
│   ├── tools/
│   │   ├── index.ts                 # Register all tools
│   │   ├── read/
│   │   │   ├── listMyTrees.ts
│   │   │   ├── listTreeMembers.ts
│   │   │   ├── listEvents.ts
│   │   │   ├── countEvents.ts
│   │   │   ├── getTithiInfo.ts
│   │   │   ├── resolveTithi.ts
│   │   │   └── searchMembers.ts
│   │   └── write/
│   │       ├── createEvent.ts
│   │       ├── updateEvent.ts
│   │       ├── deleteEvent.ts
│   │       ├── createTree.ts
│   │       ├── addMember.ts
│   │       ├── addRelationship.ts
│   │       └── deleteMember.ts
│   ├── resources/
│   │   └── index.ts                 # Resource definitions (Phase 2+)
│   ├── firestore/
│   │   ├── trees.ts                 # Tree CRUD (server-side)
│   │   ├── members.ts               # Member CRUD (server-side)
│   │   ├── relationships.ts         # Relationship CRUD (server-side)
│   │   └── events.ts               # Event CRUD (server-side)
│   └── utils/
│       ├── ephemeris.ts             # Tithi calculations (ported from client)
│       └── dateConversion.ts        # AD↔BS conversion helpers
├── test/
│   ├── tools/                       # Tool unit tests
│   ├── prompts/                     # Prompt registration tests
│   └── integration/                 # End-to-end with Firestore emulator
└── claude-desktop-config.example.json
```

---

## 12. Implementation Phases

### Phase 1: Read-Only Tools + Query Prompt

**Goal:** Prove the architecture. Connect Claude Desktop to live Firestore data.

**Deliverables:**
- [ ] Project scaffold (`mcp-server/` with TypeScript, MCP SDK, firebase-admin)
- [ ] Auth middleware (verify Firebase ID token from Bearer header)
- [ ] Streamable HTTP transport setup
- [ ] Port `ephemeris.js` to TypeScript
- [ ] Implement 7 read tools: `list-my-trees`, `list-tree-members`, `list-events`, `count-events`, `get-tithi-info`, `resolve-tithi`, `search-members`
- [ ] Implement `query-events` prompt
- [ ] Local testing with Firestore emulator
- [ ] Claude Desktop config for local server (`http://localhost:3001/mcp`)
- [ ] Deploy to Cloud Run (dev)

**Test scenario:** Open Claude Desktop → "What events do I have this month?" → LLM calls `list-events` → returns results.

### Phase 2: Write Tools + Action Prompts

**Goal:** Full CRUD through natural language. "Add Shraddha for Kartik Sukla Pratipada" works end-to-end.

**Deliverables:**
- [ ] Port `CalendarEventService.buildEventDocument()` to server
- [ ] Port `firestoreTreeApi` CRUD to server (Trees, Members, Relationships)
- [ ] Implement 7 write tools: `create-event`, `update-event`, `delete-event`, `create-tree`, `add-member`, `add-relationship`, `delete-member`
- [ ] Implement 3 prompts: `add-event`, `add-tree-member`, `create-tree`
- [ ] Input validation with Zod schemas
- [ ] Integration tests with Firestore emulator
- [ ] Deploy to Cloud Run (staging)

**Test scenario:** "Add a yearly Shraddha for my grandfather on Baisakh Krishna Amavasya in the Sharma family tree" → LLM uses `add-event` prompt → asks for confirmation → calls `create-event` tool → event appears in Firestore and React app.

### Phase 3: Chat UI (Optional)

**Goal:** Embed a chat widget in the React app for non-technical users.

**Deliverables:**
- [ ] React chat widget component (`src/components/Chat/`)
- [ ] Cloud Function as proxy: React app → Cloud Function → LLM API (with MCP tool use) → MCP server → Firestore
- [ ] Stream responses to the widget
- [ ] Mobile-friendly UI

**Architecture for Phase 3:**
```
React App → Cloud Function (proxy) → LLM API (Claude/GPT)
                                        ↕ tool calls
                                     MCP Server (Cloud Run)
                                        ↕
                                     Firestore
```

---

## 13. Testing Strategy

### Unit Tests
- Each tool handler tested in isolation with mocked Firestore
- Ephemeris functions tested against known tithi dates
- Auth middleware tested with valid/invalid/expired tokens

### Integration Tests
- Firestore emulator (`firebase emulators:start`)
- Full tool execution: register tool → call with params → verify Firestore state
- Prompt registration: verify all prompts list correctly

### End-to-End
- Claude Desktop connected to local MCP server
- Manual test script with natural language queries
- Verify events/trees created in Firestore match expectations

---

## 14. Deployment

### Cloud Run Configuration

```yaml
# cloud-run-config (illustrative)
service: hamropanchanga-mcp
region: us-central1
memory: 512Mi
cpu: 1
min-instances: 1          # Avoid cold starts
max-instances: 5
timeout: 3600s             # 60min for SSE
env:
  - GOOGLE_CLOUD_PROJECT=hamropanchanga
  - FIRESTORE_DATABASE_ID=hamropanchanga-db
```

### Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "hamropanchanga": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer <FIREBASE_ID_TOKEN>"
      }
    }
  }
}
```

> **Note:** For production, the URL becomes `https://mcp.hamropanchanga.app/mcp`. The token must be refreshed periodically (Firebase ID tokens expire after 1 hour).

---

## 15. Open Questions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | TypeScript or JavaScript for MCP server? | TS (type safety, better DX) vs JS (consistency with existing codebase) | Leaning TS |
| 2 | How does Claude Desktop handle token refresh? | Manual paste, helper script, OAuth proxy | Needs research |
| 3 | Should MCP server share code with `functions/`? | Monorepo with shared `lib/` vs fully separate | Leaning separate |
| 4 | Rate limiting for MCP tools? | Per-user per-tool limits | TBD |
| 5 | Should write tools require explicit confirmation? | MCP elicitation for "are you sure?" | TBD — check client support |
| 6 | Nepali date conversion — port or call REST API? | Port `nepaliDateConverter.js` to server | Leaning port |
| 7 | How to handle `sharedWith` trees in search-members? | Query all accessible trees and scan | May need composite index |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "latest",
  "firebase-admin": "^13.6.0",
  "astronomy-engine": "^2.1.19",
  "zod": "^3.22.0",
  "express": "^4.18.0"
}
```

> `express` is needed as the HTTP layer for Streamable HTTP transport. The MCP SDK provides `StreamableHTTPServerTransport` which plugs into Express routes.

---

*Document generated from codebase analysis of `hamropanchanga` (family-tree-app).*
