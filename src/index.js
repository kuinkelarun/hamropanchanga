import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { auth, db } from './firebase';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  documentId,
  FieldPath,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// Expose db globally for migration scripts in development
if (process.env.NODE_ENV === 'development' || true) { // Always expose for admin tools
  window.db = db;
  // Expose auth for diagnostics (token claims, currentUser)
  window.auth = auth;
  // Back-compat for older scripts/snippets
  window.firebaseAuth = auth;

  // Quick environment check (helps detect “admin ran in staging, user ran in prod”).
  window.__debugEnv = () => {
    try {
      const projectId = db?.app?.options?.projectId;
      const authProjectId = auth?.app?.options?.projectId;
      // Some internal fields may exist depending on SDK version; guard everything.
      const dbId = db?._databaseId ? { projectId: db._databaseId.projectId, database: db._databaseId.database } : null;
      const settings = db?._settings ? { host: db._settings.host, ssl: db._settings.ssl } : null;
      console.log('[__debugEnv] db.app.options.projectId:', projectId);
      console.log('[__debugEnv] auth.app.options.projectId:', authProjectId);
      console.log('[__debugEnv] db._databaseId:', dbId);
      console.log('[__debugEnv] db._settings:', settings);
    } catch (e) {
      console.error('[__debugEnv] failed:', e);
    }
  };

  // Minimal auth debug helper for DevTools (no imports needed in console).
  window.__debugAuth = async (treeIdToTest, options = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn('[__debugAuth] No currentUser. Are you signed in?');
        return;
      }

      const { forceRefreshToken = true } = options || {};

      console.log('[__debugAuth] currentUser.uid:', user.uid);
      console.log('[__debugAuth] currentUser.email:', user.email);
      console.log('[__debugAuth] currentUser.emailVerified:', user.emailVerified);
      console.log(
        '[__debugAuth] currentUser.providerData:',
        (user.providerData || []).map((p) => ({ providerId: p.providerId, uid: p.uid, email: p.email }))
      );

      const token = await user.getIdTokenResult(forceRefreshToken);
      console.log('[__debugAuth] claims.email:', token?.claims?.email);
      console.log('[__debugAuth] claims.firebase.sign_in_provider:', token?.claims?.firebase?.sign_in_provider);
      console.log('[__debugAuth] claims.firebase.identities.email:', token?.claims?.firebase?.identities?.email);

      // Optional: see if your profile doc exists (used as a fallback in rules).
      if (window.__firestoreHelpers?.getDoc && window.__firestoreHelpers?.doc) {
        try {
          const userSnap = await window.__firestoreHelpers.getDoc(
            window.__firestoreHelpers.doc(db, 'users', user.uid)
          );
          console.log('[__debugAuth] users/{uid} exists:', userSnap.exists());
          if (userSnap.exists()) {
            const data = userSnap.data() || {};
            console.log('[__debugAuth] users/{uid}.email:', data.email);
            console.log('[__debugAuth] users/{uid}.emailLower:', data.emailLower);
          }
        } catch (e) {
          console.warn('[__debugAuth] users/{uid} read failed:', e);
        }
      }

      if (treeIdToTest && window.__firestoreHelpers?.getDoc && window.__firestoreHelpers?.doc) {
        try {
          const snap = await window.__firestoreHelpers.getDoc(
            window.__firestoreHelpers.doc(db, 'trees', treeIdToTest)
          );
          console.log('[__debugAuth] canReadTree:', treeIdToTest, snap.exists());
        } catch (e) {
          console.error('[__debugAuth] tree read failed:', treeIdToTest, e);
        }
      }
    } catch (e) {
      console.error('[__debugAuth] failed:', e);
    }
  };

  // Reproduce the shared list query (and show a clear error if rules block it).
  window.__debugSharedQuery = async (emailToTest, options = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn('[__debugSharedQuery] No currentUser. Are you signed in?');
        return;
      }

      const { max = 10, excludeDeleted = false } = options || {};
      const emailLower = (emailToTest || user.email || '').toLowerCase();
      console.log('[__debugSharedQuery] using emailLower:', emailLower);
      console.log('[__debugSharedQuery] excludeDeleted:', !!excludeDeleted);

      if (!emailLower) {
        console.warn('[__debugSharedQuery] No email available (user.email empty).');
        return;
      }

      const clauses = [
        where('sharedWithEmails', 'array-contains', emailLower),
        limit(Math.max(1, Math.min(50, max))),
      ];
      if (excludeDeleted) {
        clauses.unshift(where('deleted', '==', false));
      }

      const q = query(collection(db, 'trees'), ...clauses);

      const snaps = await getDocs(q);
      console.log('[__debugSharedQuery] docs:', snaps.size);
      console.log(
        '[__debugSharedQuery] ids:',
        snaps.docs.map((d) => d.id)
      );
    } catch (e) {
      console.error('[__debugSharedQuery] failed:', e);
    }
  };

  // Test a query that returns a single known doc (helps detect “poison doc” scenarios).
  window.__debugSharedQueryByDocId = async (treeId, emailToTest) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn('[__debugSharedQueryByDocId] No currentUser. Are you signed in?');
        return;
      }

      const emailLower = (emailToTest || user.email || '').toLowerCase();
      if (!treeId) {
        console.warn('[__debugSharedQueryByDocId] treeId is required');
        return;
      }
      if (!emailLower) {
        console.warn('[__debugSharedQueryByDocId] No email available');
        return;
      }

      // NOTE: this query should succeed if THAT specific doc is readable.
      const q = query(
        collection(db, 'trees'),
        where('sharedWithEmails', 'array-contains', emailLower),
        where(documentId(), '==', treeId),
        limit(1)
      );

      const snaps = await getDocs(q);
      console.log('[__debugSharedQueryByDocId] docs:', snaps.size);
      console.log('[__debugSharedQueryByDocId] ids:', snaps.docs.map((d) => d.id));
    } catch (e) {
      console.error('[__debugSharedQueryByDocId] failed:', e);
    }
  };

  // Admin tool: find/repair “poison” shares that break recipient queries.
  // Run as an admin user in DevTools.
  window.__repairPoisonSharesForEmail = async (targetEmail, options = {}) => {
    const emailLower = String(targetEmail || '').toLowerCase().trim();
    const { dryRun = true, max = 500 } = options || {};

    try {
      if (!emailLower) {
        console.warn('[__repairPoisonSharesForEmail] targetEmail is required');
        return;
      }

      console.log('[__repairPoisonSharesForEmail] start', { emailLower, dryRun, max });

      const q = query(
        collection(db, 'trees'),
        where('sharedWithEmails', 'array-contains', emailLower),
        limit(Math.max(1, Math.min(500, max)))
      );

      const snap = await getDocs(q);
      console.log('[__repairPoisonSharesForEmail] matched trees:', snap.size);

      let alreadyOk = 0;
      let updated = 0;
      let staleRemoved = 0;
      let mixedCaseFixed = 0;

      const batchMax = 450;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const treeDoc of snap.docs) {
        const treeId = treeDoc.id;
        const data = treeDoc.data() || {};
        const sharedWith = data.sharedWith && typeof data.sharedWith === 'object' && !Array.isArray(data.sharedWith)
          ? data.sharedWith
          : {};
        const sharedWithEmails = Array.isArray(data.sharedWithEmails) ? data.sharedWithEmails : [];

        const emailListNormalized = Array.from(
          new Set(sharedWithEmails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean))
        );

        const hasExact = Object.prototype.hasOwnProperty.call(sharedWith, emailLower);
        const keys = Object.keys(sharedWith);
        const mixedKeys = keys.filter((k) => String(k || '').toLowerCase().trim() === emailLower && k !== emailLower);

        let nextSharedWith = sharedWith;
        let nextEmails = emailListNormalized;
        let needsWrite = false;

        // Fix mixed-case key -> exact lowercase key
        if (!hasExact && mixedKeys.length > 0) {
          const fromKey = mixedKeys[0];
          nextSharedWith = { ...sharedWith };
          nextSharedWith[emailLower] = nextSharedWith[fromKey];
          delete nextSharedWith[fromKey];
          needsWrite = true;
          mixedCaseFixed++;
        }

        const hasRecord = Object.prototype.hasOwnProperty.call(nextSharedWith, emailLower);

        // If no share record, remove from sharedWithEmails (stale/unshared)
        if (!hasRecord) {
          if (nextEmails.includes(emailLower)) {
            nextEmails = nextEmails.filter((e) => e !== emailLower);
            needsWrite = true;
            staleRemoved++;
          }
        } else {
          // If share record exists but email not in helper array, add it
          if (!nextEmails.includes(emailLower)) {
            nextEmails = nextEmails.concat([emailLower]);
            needsWrite = true;
          }
        }

        nextEmails = Array.from(new Set(nextEmails)).sort();

        if (!needsWrite) {
          alreadyOk++;
          continue;
        }

        updated++;
        console.log('[__repairPoisonSharesForEmail] fix tree', {
          treeId,
          title: data.title || data.name || '(untitled)',
          mixedKeys,
          beforeEmails: emailListNormalized,
          afterEmails: nextEmails,
          hasRecord,
        });

        if (!dryRun) {
          batch.update(doc(db, 'trees', treeId), {
            sharedWith: nextSharedWith,
            sharedWithEmails: nextEmails,
            updatedAt: serverTimestamp(),
          });
          batchCount++;
        }

        if (!dryRun && batchCount >= batchMax) {
          await batch.commit();
          console.log('[__repairPoisonSharesForEmail] committed batch', batchCount);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (!dryRun && batchCount > 0) {
        await batch.commit();
        console.log('[__repairPoisonSharesForEmail] committed final batch', batchCount);
      }

      console.log('[__repairPoisonSharesForEmail] done', {
        scanned: snap.size,
        alreadyOk,
        updated,
        staleRemoved,
        mixedCaseFixed,
        mode: dryRun ? 'dryRun' : 'applied',
      });
    } catch (e) {
      console.error('[__repairPoisonSharesForEmail] failed:', e);
    }
  };

  // Admin tool: force (re)share a specific tree for a recipient email.
  // Useful when a single doc is “poisoning” the shared-trees query.
  window.__adminReshareTree = async (treeId, recipientEmail, permission = 'view', options = {}) => {
    const emailLower = String(recipientEmail || '').toLowerCase().trim();
    const { sharedByEmail = auth.currentUser?.email || null } = options || {};

    try {
      if (!treeId) {
        console.warn('[__adminReshareTree] treeId is required');
        return;
      }
      if (!emailLower) {
        console.warn('[__adminReshareTree] recipientEmail is required');
        return;
      }
      if (permission !== 'view' && permission !== 'edit') {
        console.warn('[__adminReshareTree] permission must be "view" or "edit"');
        return;
      }

      const treeRef = doc(db, 'trees', treeId);
      const shareRecord = {
        permission,
        sharedAt: serverTimestamp(),
        sharedBy: sharedByEmail,
      };

      await updateDoc(
        treeRef,
        new FieldPath('sharedWith', emailLower),
        shareRecord,
        'sharedWithEmails',
        arrayUnion(emailLower),
        'updatedAt',
        serverTimestamp()
      );

      console.log('[__adminReshareTree] ok', { treeId, emailLower, permission });
    } catch (e) {
      console.error('[__adminReshareTree] failed:', e);
    }
  };

  // Admin tool: force unshare a specific tree for a recipient email.
  window.__adminUnshareTree = async (treeId, recipientEmail) => {
    const emailLower = String(recipientEmail || '').toLowerCase().trim();

    try {
      if (!treeId) {
        console.warn('[__adminUnshareTree] treeId is required');
        return;
      }
      if (!emailLower) {
        console.warn('[__adminUnshareTree] recipientEmail is required');
        return;
      }

      const treeRef = doc(db, 'trees', treeId);
      await updateDoc(
        treeRef,
        new FieldPath('sharedWith', emailLower),
        deleteField(),
        'sharedWithEmails',
        arrayRemove(emailLower),
        'updatedAt',
        serverTimestamp()
      );

      console.log('[__adminUnshareTree] ok', { treeId, emailLower });
    } catch (e) {
      console.error('[__adminUnshareTree] failed:', e);
    }
  };

  // Expose Firestore helper functions from the SAME bundled SDK instance.
  // This avoids DevTools scripts importing a different Firestore module (CDN)
  // which causes "Expected first argument to collection() to be a ... FirebaseFirestore".
  window.__firestoreHelpers = {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    deleteField,
    documentId,
    FieldPath,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where,
    doc,
    writeBatch,
    serverTimestamp,
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
