# HamroPanchanga MCP Server — Planning Document

> **Project:** Extend HamroPanchanga to support AI-driven interactions via an MCP (Model Context Protocol) server, enabling both in-app chatbot experiences and external AI client access (Claude.ai, Claude Desktop, etc.)
>
> **Status:** Planning / Pre-implementation
> **Last updated:** April 2026 — revised after codebase analysis

---

## 1. Context: Current HamroPanchanga Stack (verified against codebase)

### Current architecture

- **Frontend:** React SPA at `hamropanchanga.web.app` (Firebase Hosting)
- **Backend:**
  - **Firebase Auth** — Google OAuth sign-in (no email/password, no anonymous)
  - **Firestore** — primary data store (project: `hamropanchanga`, database: `hamropanchanga-db`)
  - **Firebase Cloud Functions** — `functions/` directory
    - `computeEphemeris` (callable) — computes tithi via Python **Skyfield** ephemeris
    - `setAdminRole`, `syncAuthUsersToFirestore` — user admin ops
    - `approveApiKeyRequest`, `rejectApiKeyRequest`, `regenerateApiKey` — API key lifecycle
    - Public REST API routes under `/v1/*` (see §4 Public API)
  - **Cloud Storage** — configured but lightly used
- **No custom long-running backend** — React + Cloud Functions only

### Current capabilities (actual feature catalog)

The app is substantially larger than the original planning doc assumed. Confirmed features:

> **Scope note:** The **graph-construction side of the TreeBuilder canvas** — drawing relationship edges, creating marriage-point couple nodes, and any canvas-specific visual positioning — is **out of scope** for the MCP server. AI-driven graph wiring is not a goal; that remains a UI-only workflow. However, **member CRUD is in scope** — users can ask the AI to add, update, or remove members in a tree. The AI simply doesn't connect them into the graph; that step happens in the canvas.

1. **Family tree management (called "trees" in code, not "families")** — *in scope*
   - Create/rename/delete trees with soft-delete
   - Tree metadata: title, contact, location, primary member name (all with normalized-search variants)
   - **Tree sharing**: share with other users by email with VIEW or EDIT permission (`sharedWithEmails` array)

2. **Member management (subcollection under each tree)** — *in scope*
   - Full CRUD on members: name, nickname, dob (AD, supports Nepali numerals), dod, photo, gender, status (alive/deceased), notes, location
   - Normalized searchable fields for client-side search
   - The AI can add/edit/remove members but does NOT wire them into the family graph — connecting them to parents/spouses/children remains a canvas task

3. **Relationship management (subcollection)** — *out of scope for MCP*
   - Typed edges between members: parent-child, spouse, sibling
   - **Marriage points** (`marriagePoints` subcollection) — logical "couple" nodes parenting shared children
   - Managed entirely via TreeBuilder canvas; not exposed to AI

4. **Calendar events (top-level `calendarEvents` collection)**
   - AD-date events and **tithi-based events** (resolve to AD via tithi lookup)
   - Repetition: none / monthly / yearly (yearly tithi events repeat on same lunar tithi each BS year)
   - Scoping: public (visible in public API + public calendar) OR private to user OR associated with a tree/member
   - `nepaliDateForRecurrence` field computed for Nepali-calendar recurrence

5. **Panchanga / Tithi data (top-level `tithis` collection)**
   - Each tithi doc: name, paksha (Shukla/Krishna), tithiName, tithiMonth (lunar), tithiYear (BS), start/end date+time, optional category (festival/eclipse/etc.)
   - Spans date ranges (multi-day tithi supported)
   - Generated server-side via `computeEphemeris` Cloud Function (Python Skyfield)
   - Read in real-time client-side via `useTithisData` hook
   - **Not currently computed**: nakshatra, yoga, karana, sunrise/sunset (can be added)

6. **Nepali calendar data (`nepaliCalendarYears/{bsYear}`)**
   - BS year definitions: AD start date + days-per-BS-month array
   - Used for AD↔BS conversion

7. **User management & RBAC**
   - Roles: `admin`, `superuser`, `user`
   - 9+ granular permissions: `manageUsers`, `manageHomeCards`, `manageTithis`, `manageEvents`, `bulkUpload`, `manageCalendar`, `manualDashboard`, `viewAllCustomers`, `manageOwnCustomers`, `viewOwnCustomers`
   - Admin detection cascade: `adminList/{uid}` → token `admin` claim → `users/{uid}.role == 'admin'`
   - Permissions stored on `users/{uid}.permissions`

8. **User invitations (`userInvitations/{email}`)**
   - Admins pre-create invitation with role+permissions
   - Processed on invitee's first Google sign-in (`AuthContext.processInvitation()`)

9. **Bulk upload**
   - Excel/CSV import for trees, members, events, tithis
   - Pre-flight validation (FK checks, required fields) via `BulkUploadValidation`
   - Batch writes with progress reporting

10. **Public REST API with API keys**
    - User submits request → admin approves → key generated (`npcal_xxx` format)
    - SHA256 hash stored; raw key shown once then discarded
    - Per-key daily rate limiting
    - Endpoints under `/v1/*` (calendar, tithis, events, conversions, health)

11. **Admin tooling**
    - Bulk data management (generate tithis for date range, bulk delete with Excel backup)
    - Home-card / landing page block management
    - Site-settings feature flags (`siteSettings/block2`)
    - User invitation + role/permission management
    - API key request approval workflow
    - Export data to Excel (trees, events, tithis)

12. **Localization**
    - English + Nepali UI strings via `LanguageContext`
    - Nepali numeral support in date inputs

### Current user flow for adding a family event

1. User locates or creates a tree by name
2. User locates or creates the member within that tree
3. User adds the event (AD date or tithi-based) and optionally associates with the member

This multi-step flow is exactly the friction an AI chatbot collapses into one request.

---

## 2. Goal

Expose HamroPanchanga's capabilities through a dedicated **MCP server** so that:

- **External AI clients** (Claude.ai, Claude Desktop, future MCP-compatible tools) can read and manipulate user data with user consent
- **An in-app chatbot** (floating bubble + dedicated `/chat` page) uses the *same* MCP server as its tool layer, ensuring consistent behavior across all interfaces
- **The existing React UI continues to work unchanged** — the MCP server is additive, not a replacement
- **Every user-facing action in the React app has an equivalent MCP tool** — parity is a non-goal for admin tools but a goal for regular-user features

---

## 3. Target Architecture

```
                     ┌──────────────────────────┐
                     │   React App (unchanged)  │
                     │  ┌────────┐  ┌────────┐  │
                     │  │Floating│  │ /chat  │  │
                     │  │ chat   │  │  page  │  │
                     │  └───┬────┘  └───┬────┘  │
                     │      │           │       │
                     │  Traditional UI views    │
                     └──────┼───────────┼───────┘
                            │           │
                            └─────┬─────┘
                                  │ HTTPS + Firebase ID token
                                  ▼
                    ┌──────────────────────────┐
                    │   Chat Backend           │
                    │   (acts as MCP client)   │
                    └───────────┬──────────────┘
                                │ MCP protocol
                                ▼
┌───────────────────┐    ┌──────────────────────────┐
│  Claude Desktop   │────►   MCP Server             │
│  or Claude.ai     │MCP │   (Tools + Resources +   │
│  (external)       │    │    Prompts)              │
└───────────────────┘    └───────────┬──────────────┘
                                     │ Firebase Admin SDK
                                     │ + Callable Functions
                                     ▼
                         ┌──────────────────────────┐
                         │  Firebase (existing)     │
                         │  Auth + Firestore +      │
                         │  Cloud Functions         │
                         └──────────────────────────┘
```

### Deployment plan

| Component | Status | Platform |
|---|---|---|
| React app | Existing | Firebase Hosting |
| Firebase Auth + Firestore + Functions | Existing | Firebase |
| MCP Server | **New** | Railway (or Cloud Run / Fly.io) |
| Chat Backend | **New** | Same Railway service as MCP Server (initially) |
| OAuth provider | **New** | Railway (or delegated to Clerk/Auth0) |

Running MCP server and chat backend in the same Node.js process keeps deploy simple; can be split later if scaling demands it.

**Important:** the MCP server uses **Firebase Admin SDK** (bypasses Firestore security rules) and must also invoke existing **callable Cloud Functions** (`computeEphemeris`, `setAdminRole`, `approveApiKeyRequest`, etc.) rather than re-implement them. This keeps tithi generation and admin workflows consistent with the React app.

---

## 4. MCP Capabilities — Mapped to HamroPanchanga

MCP servers expose three primitives (tools, resources, prompts). The catalog below has been rewritten against the **actual** codebase.

### 4.1 Tools — Actions the AI can take

Tools are grouped by feature area. Every tool operates on the authenticated `userId` and, where relevant, re-enforces ownership/sharing checks in server code (see §6 on security rule bypass).

#### Tree tools (family trees)

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `list_trees` | `Trees.list(ownerUid, {includeShared: true})` | `include_shared` (default true), `include_deleted` (admin-only, default false) | Trees with id, title, contact, location, owner, shared emails, member count |
| `get_tree` | `Trees.get(id)` | `tree_id` OR `tree_title` (resolves via title-normalized search) | Full tree doc |
| `create_tree` | `Trees.create` | `title` (req), `contact`, `location`, `primary_member_name` | Created tree object |
| `update_tree` | `Trees.update` | `tree_id`, any of: `title`, `contact`, `location`, `primary_member_name` | Updated tree object |
| `delete_tree` | `Trees.delete` (soft) | `tree_id`, `confirmation` | `{success, deleted: true}` |
| `purge_tree` | `deleteTreeAndAssociations` | `tree_id`, `confirmation` (admin or owner+explicit) | Cascades: members, relationships, marriagePoints, events all deleted |
| `share_tree` | `TreeSharingUtils` add to `sharedWithEmails` | `tree_id`, `email`, `permission: 'view'\|'edit'` | Updated tree |
| `unshare_tree` | Remove from `sharedWithEmails` | `tree_id`, `email` | Updated tree |
| `list_tree_shares` | Read `sharedWithEmails` | `tree_id` | Array of `{email, permission}` |

#### Member tools

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `list_members` | `Members.list(treeId)` | `tree_id` OR `tree_title` | Array of members |
| `get_member` | Firestore doc read | `tree_id`, `member_id` | Member object |
| `find_member` | Client-side search over `nameSearchable` | `name_query`, optional `tree_hint` | Matched members across user's trees |
| `add_member` | `Members.create` | `tree_id` (or `tree_title`), `name` (req), optional `nickname`, `dob`, `dod`, `gender`, `status`, `notes`, `location`, `photo_url` | Created member (unconnected — no parent/spouse edges) |
| `update_member` | `Members.update` | `tree_id`, `member_id`, any fields to update | Updated member |
| `remove_member` | `Members.delete` | `tree_id`, `member_id`, `confirmation` | Success. **Note:** Firestore-side `Relationships.removeByMember` cascade runs as usual; the AI doesn't manage relationships but doesn't need to — deletion cleans up orphaned edges automatically |

> **Important:** `add_member` creates a member record in the tree's subcollection but does **not** place them in the graph. To connect the new member as someone's child, spouse, or parent, the user opens the TreeBuilder canvas. The AI should state this clearly after adding a member (e.g. "Added Ram to Smith Family. Open the Tree Builder to connect him to his parents.").

#### Relationships & marriage points — *not exposed in MCP*

Relationship edges (parent-child, spouse, sibling) and marriage-point couple nodes are part of the visual tree-building workflow and are intentionally omitted from the MCP surface. Any AI-driven graph wiring is out of scope.

#### Composite family tools (task-oriented — recommended for LLM ergonomics)

| Tool name | Behavior |
|---|---|
| `add_birthday` | Resolves tree + member + creates yearly-recurring event titled "<Name>'s birthday" from member's `dob`. If member has no `dob`, prompts the user to supply it (via `update_member`). |
| `add_death_anniversary` | Same but from `dod` (tithi-based if enabled) |

#### Calendar event tools

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `list_events` | Firestore query on `calendarEvents` scoped to user's visibility | `start_date`, `end_date`, optional `tree_id`, `member_id`, `include_public` | Array of events (expanded for recurrence) |
| `list_upcoming_events` | Convenience over `list_events` | `days_ahead` (default 7), optional `tree_id` | Events |
| `get_event` | Doc read | `event_id` | Event |
| `create_event` | `CalendarEventService.create` | `title` (req), EITHER `date` (AD, YYYY-MM-DD) OR `tithi: {paksha, tithi_name, month}`, optional `description`, `repetition: none\|monthly\|yearly`, `tree_id`, `member_id`, `is_public` (admin-gated) | Created event |
| `update_event` | Update | `event_id`, fields | Updated |
| `delete_event` | Delete | `event_id`, `confirmation` | Success |
| `resolve_tithi_event_date` | `useTithiDateResolver` logic | `tithi: {paksha, tithi_name, month}`, `bs_year` | AD date for that tithi occurrence |

#### Panchanga / tithi tools

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `get_tithi_for_date` | Query `tithis` where startDate ≤ date ≤ endDate | `date` (AD) | Active tithi(s) including name, paksha, month, BS year, start/end datetimes |
| `get_tithi_today` | Shortcut for today in Asia/Kathmandu | (none) | As above |
| `list_tithis_in_range` | Range query | `start_date`, `end_date` (AD, ≤366 days) | Array of tithi docs |
| `find_next_tithi` | Search `tithis` | `tithi_name`, optional `paksha`, `from_date` | Next occurrence(s) |
| `list_festivals` | Query `tithis` where category present | Optional `start_date`, `end_date`, `category` | Festivals/eclipses/etc. |
| `compute_ephemeris` | Invoke callable `computeEphemeris` | `date`, optional `lat`, `lon` | `{sunLon, moonLon, tithiStart, tithiEnd, ...}` |
| `generate_tithis` *(admin)* | Loop `computeEphemeris` + write | `start_date`, `end_date`, `overwrite` (default false) | Count created/updated |
| `update_tithi` *(admin)* | Doc update | `tithi_id`, fields | Updated |
| `delete_tithi` *(admin)* | Doc delete | `tithi_id`, `confirmation` | Success |

#### Nepali calendar / conversion tools

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `convert_ad_to_bs` | `nepaliDateUtils` + `/v1/convert/ad-to-bs` | `date` (AD) | `{bsYear, bsMonth, bsDay, bsMonthName}` |
| `convert_bs_to_ad` | `nepaliDateUtils` + `/v1/convert/bs-to-ad` | `bs_year`, `bs_month`, `bs_day` | `{date}` (AD) |
| `convert_batch` | Bulk wrapper | Array of up to 100 conversions | Array of results |
| `get_calendar_month` | Assemble BS month view | `bs_year`, `bs_month` | Days with AD equivalents + tithis per day |
| `get_today` | NPT "today" helper | (none) | `{adDate, bsDate, bsMonthName, weekday}` |

#### User / RBAC tools *(admin-gated unless noted)*

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `get_my_profile` | Read `users/{currentUid}` | (none) | Profile + role + permissions |
| `update_my_profile` | Update limited fields | `display_name`, locale preferences | Updated |
| `list_users` *(admin)* | Query `users` collection | Optional `role` filter, `active` filter | Array |
| `get_user` *(admin)* | Doc read | `uid` or `email` | User |
| `invite_user` *(admin)* | Create `userInvitations/{email}` | `email`, `display_name`, `role`, `permissions` object | Invitation |
| `list_pending_invitations` *(admin)* | Query | (none) | Array |
| `cancel_invitation` *(admin)* | Delete pending invitation | `email` | Success |
| `update_user_role` *(admin)* | Invoke `setAdminRole` callable | `uid`, `role`, `permissions` | Updated |
| `deactivate_user` *(admin)* | Set `users/{uid}.active = false` | `uid` | Success |
| `reactivate_user` *(admin)* | Set `active = true` | `uid` | Success |
| `sync_auth_users` *(admin)* | Invoke `syncAuthUsersToFirestore` | (none) | Count synced |
| `list_admins` *(admin)* | Read `adminList` | (none) | Array |

#### API key management tools

| Tool name | Maps to | Inputs | Outputs |
|---|---|---|---|
| `request_api_key` | Create `apiKeyRequests/{id}` | `use_case`, `website`, `name` | Pending request |
| `list_my_api_key_requests` | Query by uid | (none) | Array with status |
| `get_my_api_keys` | Query `apiKeys` where `uid==currentUid && active` | (none) | Metadata only (no raw keys) |
| `list_api_key_requests` *(admin)* | Query all | Optional `status` filter | Array |
| `approve_api_key_request` *(admin)* | Invoke callable | `request_id`, optional `plan`, `rate_limit` | `{rawKey}` (shown once) |
| `reject_api_key_request` *(admin)* | Invoke callable | `request_id`, `reason` | Success |
| `regenerate_api_key` *(admin)* | Invoke callable | `request_id` | `{rawKey}` (shown once) |
| `revoke_api_key` *(admin)* | Set `apiKeys/{id}.active = false` | `key_id` | Success |
| `get_api_key_usage` | Read today's `requestsToday` counter | `key_id` (own or admin for any) | `{requestsToday, rateLimit, rateLimitDate}` |

#### Bulk / admin data tools *(admin-gated)*

| Tool name | Purpose |
|---|---|
| `bulk_import_trees` | Accept array of trees+members; validate via `BulkUploadValidation`; batch write |
| `bulk_import_events` | Same for events (AD + tithi-based) |
| `bulk_import_tithis` | Same for tithis |
| `export_data` | Export any of `trees`, `members`, `events`, `tithis` to JSON/CSV-shaped response |
| `bulk_delete_tithis` | Delete tithis in date range; returns backup payload first |
| `bulk_delete_events` | Same for events |
| `get_site_settings` | Read `siteSettings/block2` |
| `update_site_settings` | Update feature flags (e.g. `tithiCalculatorVisible`) |
| `list_home_cards` / `update_home_card` | Landing-page block management |

> **Design principle:** prefer task-oriented composites over raw CRUD where it collapses the "find tree → find member → act" chain. The regular-user surface should feel like 10–15 verbs; admin surface can be larger. Tools marked *(admin)* must server-side verify caller is in `adminList` or has matching permission before proceeding.

### 4.2 Resources — Data the AI can read

| Resource URI | Description | Update frequency |
|---|---|---|
| `tithi://today` | Today's tithi(s) in NPT (name, paksha, start/end) | Daily |
| `panchanga://today` | Full panchanga for today (tithi only until nakshatra/yoga/karana added) | Daily |
| `user://profile` | Display name, email, role, permissions, timezone | Rarely |
| `user://trees/summary` | User's trees with member counts + shared-with info | On change |
| `user://events/this-week` | User's events for current NPT week | On change |
| `user://api-keys/summary` | User's active API keys (metadata only) | On change |
| `app://site-settings` | Public-facing feature flags | Rarely |

Resources are a polish layer; tools alone suffice for MVP.

### 4.3 Prompts — Reusable prompt templates

Ship a small set of slash-commands for external Claude users:

| Prompt name | Behavior |
|---|---|
| `weekly_review` | Summarize this week's events + tithis + upcoming festivals |
| `birthday_scan` | Scan all members across user's trees for birthdays in next 30 days |
| `death_anniversary_scan` | Same for death anniversaries (tithi-aware) |
| `upcoming_festivals` | Next major tithi-category events |
| `tree_summary` | Describe a given tree in prose |
| `family_overview` | List all trees + member counts + last activity |

**Defer to v2** after tools ship.

---

## 5. Authentication Strategy

Two client types converge on a single `userId` used to scope Firestore access.

### Auth path A: External AI clients (Claude.ai, Claude Desktop)

- **Method:** OAuth 2.0 (MCP authorization spec)
- **Token:** OAuth access token in `Authorization: Bearer ...`
- **Verification:** MCP server validates via OAuth provider
- **Flow:**
  1. User adds MCP server URL as custom connector
  2. Claude redirects through authorize endpoint
  3. User authenticates (ideally linked to their existing Firebase Auth / Google account)
  4. Authorization code → access token
  5. Token on all subsequent MCP calls

**Linking to Firebase identity:** since the app already uses Google OAuth via Firebase Auth, the MCP OAuth provider should accept Google as the IdP and map the resulting Google `sub` claim to the existing Firebase `uid` (lookup via Admin SDK `getUserByEmail` or a `googleSub → uid` mapping table).

### Auth path B: In-app chat backend

- **Method:** Firebase ID token pass-through
- **Token:** Firebase ID token in `Authorization: Bearer ...` + `X-Auth-Type: firebase`
- **Verification:** `firebase-admin` SDK
- **Flow:**
  1. User logs into React app (existing Google sign-in)
  2. React sends chat message with Firebase ID token to chat backend
  3. Chat backend forwards token to MCP server when invoking tools
  4. MCP server verifies and extracts `uid`

### Common path after auth

Both paths yield `userId`. Every tool handler:

```js
server.setRequestHandler('tools/call', async (request, extra) => {
  const { userId, role, permissions } = await authenticateRequest(extra.httpRequest);
  assertToolAllowed(request.params.name, role, permissions);
  // All tool logic scoped to userId
});
```

**Admin-gated tools** additionally check `role === 'admin'` or a specific permission (`manageUsers`, `manageTithis`, `bulkUpload`, etc.) — mirroring `usePermissions` logic on the server.

### OAuth provider decision

| Option | Pros | Cons |
|---|---|---|
| Self-hosted OAuth (`@node-oauth/oauth2-server`) | Full control, no per-user cost | 1–2 weeks of work, security burden |
| **Clerk** (recommended) | Managed, quick setup, Google IdP support | ~$25/mo + per-MAU fees |
| Auth0 | Enterprise-grade | More expensive, complex |
| Firebase Auth alone | Already integrated | Not a general-purpose OAuth provider for 3rd parties |

**Recommendation:** Clerk for MVP; revisit if cost becomes an issue.

---

## 6. Data Model — Firestore Mapping (verified)

### Actual schema (confirmed against code)

```
firestore/
├── users/{userId}
│   └── email, displayName, role, permissions{}, active, createdAt, updatedAt, syncedFromAuth?
│
├── adminList/{userId}
│   └── email, addedAt
│
├── userInvitations/{email}
│   └── email, displayName, role, permissions{}, status, processed, processedAt?, processedUid?, createdAt
│
├── trees/{treeId}
│   ├── title, titleNormalized, ownerUid, ownerEmail, contact*, location*, primaryMemberName*
│   ├── createdAt, updatedAt, deleted, sharedWithEmails[]
│   ├── members/{memberId}
│   │   └── name, nameSearchable, nickname, dob, dod, photo, gender, status, notes, location, timestamps
│   ├── relationships/{relationshipId}
│   │   └── fromMemberId, toMemberId, type, timestamps
│   └── marriagePoints/{mpId}
│       └── spouse1Id, spouse2Id, marriageDate?, createdAt
│
├── calendarEvents/{eventId}
│   └── title*, description*, dateKey, repetition, tithi{}|null, nepaliDateForRecurrence,
│       isPublic, createdBy, createdByAdmin, treeId|null, memberId|null, createdAt
│
├── tithis/{tithiId}
│   └── name, pakshya, tithiName, tithiMonth, tithiYear, startDate, startTime, endDate, endTime,
│       category?, dateKey (legacy), timestamps
│
├── nepaliCalendarYears/{bsYear}
│   └── startAdDate, daysInMonths[]
│
├── apiKeyRequests/{requestId}
│   └── uid, email, name, useCase, website, status, keyId, rawKey (ephemeral), rawKeyAcknowledged,
│       rejectionReason?, createdAt, reviewedAt?, reviewedBy?, regeneratedAt?, regeneratedBy?
│
├── apiKeys/{keyId}
│   └── keyHash, owner, email, uid, plan, active, rateLimit, requestsToday, rateLimitDate,
│       createdAt, lastUsed|null
│
└── siteSettings/block2
    └── visible (Tithi Calculator visibility), other feature flags
```

\* = field has a normalized-search sibling (e.g. `titleNormalized`) for client-side text search.

### Key deviations from the original planning assumption

1. **"Families" are "trees"** in code. Naming convention for MCP tools should follow user-facing terminology — likely keep `tree` everywhere since the app UI says "tree".
2. **Members are a subcollection of trees**, not top-level with `familyId`.
3. **Relationships and marriagePoints are first-class subcollections** — the tree is a graph, not a flat list.
4. **Events are top-level `calendarEvents`**, with optional `treeId`/`memberId` pointers.
5. **Tithis are top-level `tithis`** with date-range support (not one-per-day).
6. **Nepali calendar metadata is in `nepaliCalendarYears`** (not `tithi_data`).
7. **Public API + API key infrastructure already exists** — MCP server should leverage it rather than duplicate.

### Critical: Firestore security rules vs MCP server

The React app relies on **Firestore security rules** to enforce ownership/sharing. The MCP server uses **Firebase Admin SDK** which bypasses those rules — so **every tool handler must re-enforce access control**:

- **Owned-tree access:** `tree.ownerUid === callerUid`
- **Shared-tree access:** `tree.sharedWithEmails` contains `callerEmail` (lowercased)
- **Admin override:** caller is in `adminList`
- **Event visibility:** `event.isPublic === true` OR `event.createdBy === callerUid` OR `event.treeId` is accessible
- **User-management tools:** caller has `role === 'admin'` (plus matching permission where relevant)

A shared helper (`assertCanAccessTree(treeId, callerUid, callerEmail)`) should front every tree-scoped tool. Code review and multi-user integration tests on this layer are critical before shipping.

### Verification checklist (now mostly resolved)

- [x] Exact collection names and paths — verified, see schema above
- [x] How member-family relationship is modeled — subcollection under `trees`
- [x] How self events are distinguished from member events — `treeId`/`memberId` nullable
- [x] Whether tithi data is cached — yes, in `tithis` collection, generated via `computeEphemeris`
- [ ] **What composite indexes exist** — still needs verification (check `firestore.indexes.json`)
- [ ] **Current Firestore security rules** — need to read `firestore.rules` to mirror in MCP server
- [ ] **Timezone conventions for event dates** — code appears to use NPT (Asia/Kathmandu) for "today"; confirm storage is UTC midnight or naive `YYYY-MM-DD`

---

## 7. In-App Chatbot UX

### Two interfaces, one chat experience

Both share the same chat backend and a common React component, with different layout modes.

#### Floating chat bubble
- Fixed-position button (bottom-right) on authenticated pages
- Expands to panel (~400×600px)
- "Open full page" link → `/chat` while preserving conversation
- Ideal for quick "what's today's tithi?" questions

#### Dedicated `/chat` page
- Full-width layout
- Sidebar with conversation history (stored per user in Firestore)
- Rich inline UI (event cards, calendar widgets, member cards, tree snippets)
- Ideal for longer planning sessions

### Shared chat state

`ChatProvider` at app root means conversation persists across navigation; user can switch mid-conversation; all messages + tool results accessible to both views.

### Context awareness

Chat backend enriches the system prompt with UI state:

```
Current context:
- Viewing page: tree-detail
- Currently selected tree: "Smith Family"
- Currently selected member: "Ram Smith" (optional)
- Today's date: 2026-04-23
- Today's BS date: 2083 Baishakh 10
- Today's tithi: Krishna Paksha Tritiya
- User timezone: Asia/Kathmandu
- User role: user (permissions: manageOwnCustomers)
```

Lets users say "add an event for Dad" without re-specifying the tree.

### Suggested starter prompts (empty-state)

- "What's today's tithi?"
- "Show me this week's events"
- "Add a birthday reminder for <member>"
- "List my trees"
- "What festivals are coming up?"
- "Convert 2083 Baishakh 10 to AD"

---

## 8. Build Sequence

Phased approach; each step produces a shippable checkpoint.

### Phase 1: MCP server foundation (1–2 weeks)
- [ ] Set up Node.js project with `@modelcontextprotocol/sdk`
- [ ] Implement 5–6 core tools: `list_trees`, `list_members`, `list_events`, `create_event`, `get_tithi_today`, `convert_ad_to_bs`
- [ ] Use **stdio transport** for initial local testing with Claude Desktop
- [ ] Hard-code test user ID; defer auth to Phase 3
- [ ] Verify end-to-end: "Create an event for today" in Claude Desktop → event appears in Firestore → visible in React app

### Phase 2: Complete regular-user tool catalog (1–2 weeks)
- [ ] Tree tools (CRUD + sharing)
- [ ] Member tools (full CRUD — but NOT relationship edges or marriage points; those stay canvas-only)
- [ ] Full Calendar-event tools including tithi-based events
- [ ] Full Tithi read-side tools + conversion tools
- [ ] User-profile tools (non-admin)
- [ ] `add_birthday`, `add_death_anniversary` composites
- [ ] Input validation per tool
- [ ] Integration tests against Firestore emulator — include multi-user access tests (verify shared-tree ACL)
- [ ] Tool-description QA — in particular, member-CRUD tool descriptions must make clear that connecting members into the graph is a separate UI step
- [ ] Verify `remove_member` correctly triggers `Relationships.removeByMember` cleanup via the existing Firestore logic (even though MCP doesn't expose relationship tools)

### Phase 3: Auth + remote hosting (1–2 weeks)
- [ ] Add HTTP/SSE transport to MCP server
- [ ] Deploy to Railway
- [ ] Stand up OAuth provider (Clerk)
- [ ] Map OAuth identities to Firebase `uid`
- [ ] Implement dual auth (OAuth + Firebase ID token)
- [ ] Server-side ACL helper (`assertCanAccessTree`, etc.)
- [ ] Test external connection from Claude.ai as custom connector

### Phase 4: Admin tools (1 week)
- [ ] User management tools (invite, list, update role, deactivate, sync-auth)
- [ ] API key management tools (list, approve, reject, regenerate, revoke)
- [ ] Tithi generation tools (`generate_tithis`, `update_tithi`, `delete_tithi`)
- [ ] Bulk import/delete + export tools
- [ ] Site settings tools
- [ ] Server-side role/permission enforcement per tool

### Phase 5: Chat backend (1 week)
- [ ] Build `/api/chat` endpoint in same service
- [ ] MCP client connecting to own MCP server
- [ ] Anthropic API with tool forwarding
- [ ] Streaming response support
- [ ] Firebase ID token validation on incoming chat requests
- [ ] Context-enrichment system prompt (UI state, today's tithi, user profile)

### Phase 6: React chat UI (1–2 weeks)
- [ ] `ChatContext` provider at app root
- [ ] Shared `ChatInterface` component
- [ ] `FloatingChat` bubble
- [ ] `/chat` dedicated page
- [ ] Context awareness (pass selected tree/member/page to backend)
- [ ] Mobile responsive

### Phase 7: Polish (ongoing)
- [ ] MCP Resources (`tithi://today`, `user://trees/summary`, etc.)
- [ ] MCP Prompts (`/weekly_review`, `/birthday_scan`, `/upcoming_festivals`)
- [ ] Rich inline UI responses (event cards, tree snippets, member cards)
- [ ] Conversation history persistence in Firestore
- [ ] Rate limiting per user (piggyback on existing `apiKeys` rate-limit infra if desired)
- [ ] Observability (structured logs: userId, tool name, latency, result status)
- [ ] Add nakshatra / yoga / karana / sunrise-sunset to `computeEphemeris` output if product wants it

**Total estimated effort:** 7–12 weeks for a solo dev (grew from 6–10 after factoring in admin surface + sharing ACL). Shippable externally by end of Phase 5.

---

## 9. Open Questions / Decisions Needed

Flagging for follow-up before or during implementation:

1. **Tithi timezone storage:** `startTime`/`endTime` fields are "UTC" strings — confirm they are ISO-like and consistent; document the convention.
2. **Panchanga breadth:** extend `computeEphemeris` to emit nakshatra, yoga, karana, sunrise/sunset? This would round out the panchanga surface and enable richer AI answers.
3. **Tithi-event yearly recurrence edge cases:** when a tithi doesn't occur in a given BS year (rare), what does `resolve_tithi_event_date` return? Document.
4. **Admin-tool exposure to external Claude:** should admins be able to invite users / generate tithis / regenerate API keys from Claude Desktop? Or restrict admin tools to in-app chatbot only? (Recommendation: expose everywhere — the auth layer is the gate, not the transport.)
5. **Conversation history:** store chat transcripts in Firestore per user? Opt-in? Retention policy?
6. **Monetization of chat:** LLM API costs are real. Free / tiered / premium? Could piggyback on existing `apiKeys` plan field.
7. **OAuth provider:** final decision on Clerk vs self-hosted vs Auth0.
8. **Monorepo vs separate repo:** new backend service alongside `family-tree-app/` or standalone?
9. **MCP server registered name:** "HamroPanchanga" or more specific like "HamroPanchanga Family & Calendar"?
10. **Composite-vs-atomic tool balance:** how far to go on task-oriented composites (`add_birthday`, `describe_tree`) vs exposing raw CRUD? Risk is tool-count bloat.
11. **Cloud Function invocation from MCP:** use callable-function dispatch (`getFunctions().httpsCallable`) from admin SDK, or replicate logic? Recommendation: invoke callables to preserve single source of truth.
12. **Photo upload via MCP:** `update_member` accepts `photo_url` but the React app sometimes stores base64. Decide MCP contract (URL-only recommended; if upload needed, use Cloud Storage signed URLs).

---

## 10. Success Criteria

The MCP server implementation is successful when:

1. A user can complete "add birthday for Dad in Smith Family" in a single chat message (provided Dad already exists in the tree with a `dob`), across any interface
2. A user can add a new member to a tree via chat (e.g. "Add my cousin Sita, born 1995-03-12, to Smith Family") and the member appears in the TreeBuilder as an unconnected node
3. Creating an event via chat → appears instantly in the React app's calendar (Firestore real-time)
4. External Claude.ai users can connect via OAuth and use all regular-user tools
5. Shared-tree users can access others' trees via chat within their permission level; unshared access is impossible (verified by multi-user integration tests)
6. Admins can perform invitation / tithi generation / API key approval workflows via chat
7. p95 chat response latency under 5s for single-tool queries; under 10s for composite queries
8. No cross-user data leak is possible (verified by adversarial tests — "show me someone else's tree")
9. Tool catalog covers ≥95% of regular-user UI actions **excluding relationship/marriage-point graph wiring** (that stays canvas-only by design)
10. When asked to connect members into the graph (parent-child, spouse), the AI clearly directs the user to the TreeBuilder rather than failing silently
11. Costs remain sustainable (<$X/month per active chat user — target TBD)

---

## 11. Summary

HamroPanchanga is uniquely well-suited to an MCP server integration because:

- Its **calendar/event/tithi** operations map cleanly to discrete, well-named tools — this is where AI chat adds the most value
- Its multi-step workflows (find tree → find member → add event) are exactly what natural-language interfaces collapse elegantly
- Its domain-specific data (panchanga, BS calendar) is niche enough that AI assistants can't answer from general knowledge — the tools add real informational value
- Its Firestore real-time sync means UI consistency across interfaces is automatic
- It **already has a public REST API + callable Cloud Functions** — the MCP server reuses this infrastructure rather than reinventing it
- **Relationship/marriage-point graph wiring is intentionally excluded** — connecting members into a visual family tree is a spatial task that doesn't translate well to natural language. Member CRUD is exposed (add/edit/remove people) but the act of drawing parent-child or spouse edges stays in the TreeBuilder canvas.

The architecture preserves the existing React app unchanged, adds one new backend service (MCP server + chat backend), and opens up three interface modalities (traditional UI, in-app chatbot, external AI) all operating on the same data.

Main risks:
1. **Auth complexity** — two auth paths, OAuth-to-Firebase identity mapping, admin gating
2. **ACL correctness** — Admin SDK bypasses Firestore rules, so server-side checks must replicate the rule matrix exactly, including shared-tree access
3. **Tool design quality** — good tool descriptions determine whether the LLM uses them correctly

All three are manageable with the phased approach above.

---

*End of planning document.*
