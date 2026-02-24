import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'apiKeyRequests';

/**
 * Submit a new API key request for the given user.
 * @param {object} user  - Firebase auth user ({ uid, email, displayName })
 * @param {object} fields - { name, useCase, website }
 * @returns {Promise<string>} The new document ID.
 */
export async function submitApiKeyRequest(user, { name, useCase, website }) {
  const ref = await addDoc(collection(db, COLLECTION), {
    uid: user.uid,
    email: user.email || '',
    name: name || user.displayName || '',
    useCase: useCase || '',
    website: website || '',
    status: 'pending',
    keyId: null,
    rawKey: null,
    rawKeyAcknowledged: false,
    rejectionReason: '',
    createdAt: serverTimestamp(),
    reviewedAt: null,
  });
  return ref.id;
}

/**
 * Get the most recent API key request for a given UID.
 * @param {string} uid
 * @returns {Promise<object|null>} Document data with `id` field, or null.
 */
export async function getMyRequest(uid) {
  const q = query(
    collection(db, COLLECTION),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Acknowledge that the user has copied their raw key.
 * After this, the rawKey field remains but rawKeyAcknowledged is true,
 * and the UI will mask the key.
 * @param {string} requestId
 */
export async function acknowledgeKey(requestId) {
  await updateDoc(doc(db, COLLECTION, requestId), {
    rawKeyAcknowledged: true,
  });
}

/**
 * Fetch ALL API key requests (admin only).
 * @returns {Promise<Array>}
 */
export async function getAllRequests() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Update request status to 'rejected' (Firestore direct — for admin use only).
 * For approval, use the approveApiKeyRequest Cloud Function callable.
 * @param {string} requestId
 * @param {string} [rejectionReason]
 */
export async function rejectRequest(requestId, rejectionReason = '') {
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected',
    rejectionReason,
    reviewedAt: serverTimestamp(),
  });
}
