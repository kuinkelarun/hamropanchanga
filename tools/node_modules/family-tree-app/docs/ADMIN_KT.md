Admin feature — Knowledge Transfer (KT)

Overview
--------
This document explains the "no-cost" admin implementation added to the Family Tree app. The goal: allow one or more admin users to see all customers across the app (instead of only their own). The approach chosen minimizes cost and operational overhead by using a Firestore document `adminList/{uid}` as the authoritative list of admin users.

What changed (summary)
----------------------
- Client-side
  - `src/App.js`
    - On sign-in, the app now checks whether the signed-in user is an admin by reading `adminList/{uid}` (document exists => admin).
    - If `isAdmin` is true the app queries `customers` without `where('userId', '==', user.uid')`, returning all customers.
    - Non-admins continue to see only their own customers via a `where('userId', '==', user.uid')` query.

- Firestore rules
  - `firestore.rules`
    - Added helper functions: `isAuthenticated()`, `isAdmin()` (which checks both token claim and `adminList/{uid}` existence), and `isOwnerOfUserId()`.
    - Protects `adminList` so only admins can create/update/delete entries, and users can read their own admin doc. This means the first admin must be bootstrapped manually (or via the provided tools script).

- Tools
  - `tools/bootstrap-admin.js`
    - Node script that requires a Firebase service account JSON. It looks up a Firebase Auth user by email and writes `adminList/{uid}` with audit fields. Use this to create the first admin.
  - `tools/package.json`
    - Defines `firebase-admin` and `minimist` dependencies for the bootstrap script.

- Optional Cloud Functions (scaffolded)
  - `functions/` (scaffolded previously)
    - A callable Cloud Function `setAdminRole` was scaffolded to support a custom-claims-based workflow if you later enable Cloud Functions and billing. This is not required for the current no-cost approach.

Why this strategy
------------------
- Minimal cost: avoids Cloud Functions and custom claim writes which may require billing or more complex permissions. Reading a small doc (`adminList/{uid}`) from Firestore is low cost and fits the project's needs.
- Simplicity: easy to bootstrap and inspect via Firebase Console; simple client-side check and small rules changes are sufficient to enforce behavior.
- Security: `firestore.rules` prevents arbitrary users from adding themselves to `adminList`. Only users with an admin token claim, or existing admins (via adminList entries), can modify the `adminList` collection. The first admin must be created through a secure process (tool or console) which is documented below.

How to bootstrap the first admin (safe steps)
---------------------------------------------
Option A (recommended): Use the provided local Admin SDK script
1. Download a Firebase service account JSON (Project Settings → Service accounts → Generate new private key).
2. Save it as `tools/service-account.json` (or other path and pass `--serviceAccount`).
3. Install tool deps (from project root):

```powershell
npm install --prefix .\tools
```

4. Run the bootstrap script with the admin email:

```powershell
node .\tools\bootstrap-admin.js --email admin@example.com --serviceAccount .\tools\service-account.json
```

This will locate the Auth user by email and create `adminList/{uid}` with fields `email`, `createdAt`, and `bootstrappedBy`.

Option B (manual via Console)
1. In Firebase Console → Authentication, confirm the admin user exists (create them if necessary).
2. In Firebase Console → Firestore, create collection `adminList`, add a document whose ID is the admin user's UID, and add fields like `email` and `createdAt` (timestamp).

Deploying Firestore rules
-------------------------
Once `firestore.rules` is ready locally, deploy rules from the project root:

```powershell
firebase deploy --only firestore:rules
```

PowerShell tips: if your environment blocks scripts, you can use:

```powershell
powershell -ExecutionPolicy Bypass -Command "npx firebase deploy --only firestore:rules"
```

Testing
-------
1. Sign in with the bootstrapped admin account in the app. You should see all customers listed.
2. Sign in as a non-admin account and ensure that only that user's customers are visible.
3. To verify in Firestore, check `adminList/{uid}` exists for the admin user and `customers` documents' `userId` fields are correct.

Notes & Next steps
------------------
- If you later prefer managed custom-claims:
  - Use the scaffolded callable function in `functions/` to set `admin` custom claim and update `users/{uid}` for auditing.
  - Requires enabling Cloud Functions and possibly enabling billing.
- The rules are intentionally conservative: only admins can add/remove entries in `adminList`. Keep your service account JSON secure.

Files changed or added
----------------------
- Modified: `src/App.js` (admin detection and query selection)
- Modified: `firestore.rules` (helpers and `adminList` protection)
- Added: `tools/bootstrap-admin.js`, `tools/package.json`
- Added: `docs/ADMIN_KT.md` (this file)

Contact
-------
If you want, I can also add a small Admin UI to the app to manage admins (protected by your admin rules) or implement the Cloud Functions route later.
