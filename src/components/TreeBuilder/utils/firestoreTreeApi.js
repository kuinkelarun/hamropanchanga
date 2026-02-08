import { db } from '../../../firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { buildSearchFields, normalizeForCompare } from '../../../utils/textNormalize';

// Recursively delete a tree and all its members, relationships, marriage points, and events
export async function deleteTreeAndAssociations(treeId) {
  if (!treeId) throw new Error('treeId is required');
  // Delete all members
  const membersSnap = await getDocs(collection(db, 'trees', treeId, 'members'));
  await Promise.all(membersSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete all relationships
  const relSnap = await getDocs(collection(db, 'trees', treeId, 'relationships'));
  await Promise.all(relSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete all marriage points
  const mpSnap = await getDocs(collection(db, 'trees', treeId, 'marriagePoints'));
  await Promise.all(mpSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete all events in calendarEvents with this treeId
  const eventsSnap = await getDocs(query(collection(db, 'calendarEvents'), where('treeId', '==', treeId)));
  await Promise.all(eventsSnap.docs.map(d => deleteDoc(d.ref)));

  // Soft delete the tree itself
  await Trees.delete(treeId);
  return { ok: true };
}

// Helper to get trees collection
function treesCollection() {
  return collection(db, 'trees');
}

// ---- Trees API ----

export const Trees = {
  async create(title, ownerUid, metadata = {}) {
    const colRef = treesCollection();
    const safeTitle = title || 'My Tree';
    const payload = {
      title: safeTitle,
      titleNormalized: normalizeForCompare(safeTitle),
      ownerUid: ownerUid || null,
      ownerEmail: metadata.ownerEmail || '',
      contact: metadata.contact || '',
      location: metadata.location || '',
      primaryMemberName: metadata.primaryMemberName || '',
      contactNormalized: normalizeForCompare(metadata.contact || ''),
      locationNormalized: normalizeForCompare(metadata.location || ''),
      primaryMemberNameNormalized: normalizeForCompare(metadata.primaryMemberName || ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deleted: false,
    };
    const docRef = await addDoc(colRef, payload);
    const snap = await getDoc(docRef);
    return { id: docRef.id, ...(snap.data() || {}) };
  },

  async list(ownerUid, options = {}) {
    // options: { includeShared: boolean, userEmail: string, includeDeleted: boolean }
    const { includeShared = false, userEmail = null, includeDeleted = false } = options;
    const colRef = treesCollection();
    
    if (!ownerUid) {
      // Return all trees (admin view)
      const snap = await getDocs(colRef);
      const trees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return includeDeleted ? trees : trees.filter(t => !t.deleted);
    }
    
    // Get trees owned by user
    const ownedQuery = query(colRef, where('ownerUid', '==', ownerUid));
    const ownedSnap = await getDocs(ownedQuery);
    let trees = ownedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // If includeShared is true and userEmail provided, also get shared trees
    if (includeShared && userEmail) {
      try {
        console.log('[Trees.list] Fetching shared trees for email:', userEmail.toLowerCase());
        // Query using array-contains on sharedWithEmails array (queryable field)
        const sharedQuery = query(colRef, where('sharedWithEmails', 'array-contains', userEmail.toLowerCase()));
        const sharedSnap = await getDocs(sharedQuery);
        const sharedTrees = sharedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Trees.list] Found', sharedTrees.length, 'shared trees:', sharedTrees.map(t => ({ id: t.id, name: t.name, sharedWithEmails: t.sharedWithEmails })));
        
        // Merge owned and shared trees, avoiding duplicates
        const treeMap = new Map();
        trees.forEach(t => treeMap.set(t.id, t));
        sharedTrees.forEach(t => {
          if (!treeMap.has(t.id)) {
            treeMap.set(t.id, t);
          }
        });
        trees = Array.from(treeMap.values());
        console.log('[Trees.list] Total trees after merge:', trees.length);
      } catch (err) {
        console.error('[Trees.list] Failed to fetch shared trees:', err);
        // Continue with owned trees only
      }
    }
    
    // Filter out deleted trees unless explicitly requested
    const filtered = includeDeleted ? trees : trees.filter(t => !t.deleted);
    console.log('[Trees.list] Before filter:', trees.length, '| After filter:', filtered.length, '| Deleted count:', trees.filter(t => t.deleted).length);
    console.log('[Trees.list] Deleted trees:', trees.filter(t => t.deleted).map(t => ({ id: t.id, name: t.name, deleted: t.deleted })));
    return filtered;
  },

  async get(id) {
    const ref = doc(db, 'trees', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Tree not found');
    return { id: snap.id, ...snap.data() };
  },

  async update(id, payload) {
    const ref = doc(db, 'trees', id);
    const sanitized = { ...(payload || {}) };
    if (Object.prototype.hasOwnProperty.call(sanitized, 'contact')) {
      sanitized.contact = String(sanitized.contact || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'contactInfo')) {
      sanitized.contactInfo = String(sanitized.contactInfo || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'location')) {
      sanitized.location = String(sanitized.location || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'primaryMemberName')) {
      sanitized.primaryMemberName = String(sanitized.primaryMemberName || '').trim();
    }
    const normalized = {};
    if (Object.prototype.hasOwnProperty.call(sanitized, 'title')) {
      normalized.titleNormalized = normalizeForCompare(sanitized.title || '');
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'contact')) {
      normalized.contactNormalized = normalizeForCompare(sanitized.contact || '');
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'contactInfo')) {
      normalized.contactInfoNormalized = normalizeForCompare(sanitized.contactInfo || '');
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'location')) {
      normalized.locationNormalized = normalizeForCompare(sanitized.location || '');
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'primaryMemberName')) {
      normalized.primaryMemberNameNormalized = normalizeForCompare(sanitized.primaryMemberName || '');
    }
    const updatePayload = {
      ...sanitized,
      ...normalized,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(ref, updatePayload);
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() || {}) };
  },

  async delete(id) {
    // Soft delete by default (mark deleted = true)
    const ref = doc(db, 'trees', id);
    await updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() });
    return { ok: true };
  },
};

// ---- Members API ----

function membersCollection(treeId) {
  return collection(db, 'trees', treeId, 'members');
}

export const Members = {
  // payload is expected to already contain treeId and member fields according to
  // the standalone builder's expectations.
  async create(payload) {
    const { treeId, ...memberData } = payload;
    if (!treeId) throw new Error('treeId is required for Members.create');
    const colRef = membersCollection(treeId);

    const sanitizedMember = { ...memberData };
    const docRef = await addDoc(colRef, {
      ...sanitizedMember,
      ...buildSearchFields(sanitizedMember, ['name', 'nickname', 'notes', 'location']),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(docRef);
    return { id: docRef.id, ...(snap.data() || {}) };
  },

  async list(treeId) {
    if (!treeId) throw new Error('treeId is required for Members.list');
    const colRef = membersCollection(treeId);
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async update(id, payload) {
    const { treeId, ...memberData } = payload;
    if (!treeId) throw new Error('treeId is required for Members.update');
    const ref = doc(db, 'trees', treeId, 'members', id);

    const sanitizedMember = { ...memberData };
    await updateDoc(ref, {
      ...sanitizedMember,
      ...buildSearchFields(sanitizedMember, ['name', 'nickname', 'notes', 'location']),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() || {}) };
  },

  async delete(id, treeId) {
    if (!treeId) throw new Error('treeId is required for Members.delete');
    const ref = doc(db, 'trees', treeId, 'members', id);
    await deleteDoc(ref);
    return { ok: true };
  },
};

// ---- Relationships API ----

function relationshipsCollection(treeId) {
  return collection(db, 'trees', treeId, 'relationships');
}

export const Relationships = {
  async create(payload) {
    const { treeId, ...relData } = payload;
    if (!treeId) throw new Error('treeId is required for Relationships.create');
    const colRef = relationshipsCollection(treeId);
    const cleanData = {};
    Object.entries(relData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    const docRef = await addDoc(colRef, {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(docRef);
    return { id: docRef.id, ...(snap.data() || {}) };
  },

  async update(id, payload) {
    const { treeId, ...relData } = payload;
    if (!treeId) throw new Error('treeId is required for Relationships.update');
    const ref = doc(db, 'trees', treeId, 'relationships', id);
    const cleanData = {};
    Object.entries(relData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    await updateDoc(ref, { ...cleanData, updatedAt: serverTimestamp() });
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() || {}) };
  },

  async list(treeId) {
    if (!treeId) throw new Error('treeId is required for Relationships.list');
    const colRef = relationshipsCollection(treeId);
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async removeByMember(treeId, memberId) {
    if (!treeId) throw new Error('treeId is required for Relationships.removeByMember');
    if (!memberId) return { ok: true };
    const colRef = relationshipsCollection(treeId);
    const snap = await getDocs(colRef);
    const toDelete = snap.docs.filter(d => {
      const data = d.data() || {};
      return data.fromMemberId === memberId || data.toMemberId === memberId;
    });
    await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
    return { ok: true };
  },

  async removeByEndpoints(treeId, fromMemberId, toMemberId, type) {
    if (!treeId) throw new Error('treeId is required for Relationships.remove');
    const colRef = relationshipsCollection(treeId);
    const snap = await getDocs(colRef);
    const batchCandidates = snap.docs.filter(d => {
      const data = d.data() || {};
      return (
        data.fromMemberId === fromMemberId &&
        data.toMemberId === toMemberId &&
        data.type === type
      );
    });
    // For now, just delete matching docs one by one (few edges expected).
    await Promise.all(batchCandidates.map(d => deleteDoc(d.ref)));
    return { ok: true };
  },

  // Remove any relationships between two endpoints regardless of type or direction
  async removeBetweenEndpoints(treeId, a, b) {
    if (!treeId) throw new Error('treeId is required for Relationships.removeBetweenEndpoints');
    const colRef = relationshipsCollection(treeId);
    const snap = await getDocs(colRef);
    const toDelete = snap.docs.filter(d => {
      const data = d.data() || {};
      const from = data.fromMemberId;
      const to = data.toMemberId;
      return (from === a && to === b) || (from === b && to === a);
    });
    await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
    return { ok: true, count: toDelete.length };
  },

  async delete(id, treeId) {
    if (!treeId) throw new Error('treeId is required for Relationships.delete');
    if (!id) return { ok: true };
    const ref = doc(db, 'trees', treeId, 'relationships', id);
    await deleteDoc(ref);
    return { ok: true };
  },
};

// ---- Marriage Points API ----

function marriagePointsCollection(treeId) {
  return collection(db, 'trees', treeId, 'marriagePoints');
}

export const MarriagePoints = {
  async list(treeId) {
    if (!treeId) throw new Error('treeId is required for MarriagePoints.list');
    const colRef = marriagePointsCollection(treeId);
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async upsert(treeId, id, payload) {
    if (!treeId) throw new Error('treeId is required for MarriagePoints.upsert');
    if (!id) throw new Error('id is required for MarriagePoints.upsert');
    const ref = doc(db, 'trees', treeId, 'marriagePoints', id);
    const current = await getDoc(ref);
    if (current.exists()) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() || {}) };
  },

  async delete(treeId, id) {
    if (!treeId) throw new Error('treeId is required for MarriagePoints.delete');
    if (!id) throw new Error('id is required for MarriagePoints.delete');
    const ref = doc(db, 'trees', treeId, 'marriagePoints', id);
    await deleteDoc(ref);
    return { ok: true };
  },
};

// Validation, kinship, admin, etc. from the original API will be added later
// as we decide which features to support client-side vs via Cloud Functions.
