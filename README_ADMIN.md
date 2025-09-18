# Admin Management (Cloud Function)

This file explains how to deploy and use the `setAdminRole` Cloud Function to grant or revoke `admin` custom claims for users.

## Files added
- `functions/package.json` - dependencies for Cloud Functions (firebase-admin, firebase-functions)
- `functions/index.js` - callable Cloud Function `setAdminRole`

## Function behavior
- Callable function name: `setAdminRole`
- Input: `{ email: string, makeAdmin: boolean }`
- Only callable by authenticated users who already have `admin` custom claim.
- Sets/removes `admin` custom claim for the target user and writes an audit entry in `users/{uid}`.

## Deploying
1. Install Firebase CLI if you don't have it:
   ```bash
   npm install -g firebase-tools
   ````
2. Log into Firebase:
   ```bash
   firebase login
   ```
3. Initialize functions (if you haven't):
   ```bash
   firebase init functions
   ```
   - Choose JavaScript (or TypeScript if you prefer) and use Node 18.
4. Install dependencies in `functions/`:
   ```bash
   cd functions
   npm install
   ```
5. Deploy the function (from repo root):
   ```bash
   firebase deploy --only functions:setAdminRole
   ```

## Using the function from client
Use the callable functions SDK to call `setAdminRole`. The caller must be an admin.

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const setAdminRole = httpsCallable(functions, 'setAdminRole');

// Example: grant admin
await setAdminRole({ email: 'alice@example.com', makeAdmin: true });

// Example: revoke admin
await setAdminRole({ email: 'alice@example.com', makeAdmin: false });
```

## Token refresh
After a user's custom claims change, they must refresh their ID token to pick up the new claims. Instruct them to sign out and sign back in or call:

```javascript
await auth.currentUser.getIdToken(true);
```

## Security notes
- Do NOT commit service account keys to the repository.
- Prefer Cloud Functions over running admin scripts locally to avoid exposing service account JSON.
- Keep number of admins small and require MFA for admin accounts.

## Next recommended steps
- Update Firestore security rules to enforce admin vs owner access.
- Add unit tests for rules and use the emulator suite to test locally.
- Optionally, add a small Admin UI to manage admin users (calls this function).
