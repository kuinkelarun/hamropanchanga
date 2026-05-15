import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, getDocs, getDoc, serverTimestamp,
} from 'firebase/firestore';

const COL = 'userContacts';

const TITLES = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Rev.', 'Sir'];

function parseNameParts(fullName) {
  if (!fullName) return { title: '', firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  let title = '';
  let remaining = parts;
  if (parts.length > 1 && TITLES.includes(parts[0])) {
    title = parts[0];
    remaining = parts.slice(1);
  }
  const firstName = remaining[0] || '';
  const lastName = remaining.slice(1).join(' ');
  return { title, firstName, lastName };
}

function buildDisplayName(title, firstName, lastName) {
  return [title, firstName, lastName].filter(Boolean).join(' ');
}

async function buildOwnerDirectory(ownerUids) {
  const uniqueOwnerUids = Array.from(new Set(ownerUids.filter(Boolean)));
  const ownerEntries = await Promise.all(uniqueOwnerUids.map(async (ownerUid) => {
    const ownerSnap = await getDoc(doc(db, 'users', ownerUid));
    if (!ownerSnap.exists()) {
      return [ownerUid, { ownerUid, ownerDisplayName: '', ownerEmail: '' }];
    }
    const ownerData = ownerSnap.data();
    return [ownerUid, {
      ownerUid,
      ownerDisplayName: ownerData.displayName || '',
      ownerEmail: ownerData.email || '',
    }];
  }));

  return new Map(ownerEntries);
}

function attachOwnerMetadata(records, ownerDirectory, currentUid) {
  return records.map((record) => {
    const ownerMeta = ownerDirectory.get(record.ownerUid) || {};
    return {
      ...record,
      ownerDisplayName: ownerMeta.ownerDisplayName || '',
      ownerEmail: ownerMeta.ownerEmail || '',
      isOwnedByCurrentUser: record.ownerUid === currentUid,
    };
  });
}

export const getUserContacts = async (uid) => {
  const q = query(
    collection(db, COL),
    where('ownerUid', '==', uid),
    orderBy('displayName', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAccessibleContacts = async (uid, options = {}) => {
  const { includeAllOwners = false } = options;
  if (!includeAllOwners) {
    return getUserContacts(uid);
  }

  const q = query(
    collection(db, COL),
    orderBy('displayName', 'asc'),
  );
  const snap = await getDocs(q);
  const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ownerDirectory = await buildOwnerDirectory(contacts.map((contact) => contact.ownerUid));
  return attachOwnerMetadata(contacts, ownerDirectory, uid);
};

export const createContact = async (uid, data) => {
  const displayName = data.displayName ||
    buildDisplayName(data.title, data.firstName, data.lastName);
  return addDoc(collection(db, COL), {
    ownerUid: uid,
    title: data.title || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    displayName,
    email: data.email || '',
    phone: data.phone || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateContact = async (contactId, patch) => {
  const update = { ...patch, updatedAt: serverTimestamp() };
  if (!update.displayName && (patch.title !== undefined || patch.firstName !== undefined || patch.lastName !== undefined)) {
    // caller should supply displayName; if not, skip auto-compute (they may have set it manually)
  }
  await updateDoc(doc(db, COL, contactId), update);
};

export const deleteContact = async (contactId) => {
  await deleteDoc(doc(db, COL, contactId));
};

export const importContacts = async (uid, rawContacts, existingContacts = []) => {
  let imported = 0;
  let skipped = 0;

  const results = await Promise.allSettled(
    rawContacts.map(async (raw) => {
      const fullName = Array.isArray(raw.name) ? raw.name[0] : (raw.name || '');
      const phone = (Array.isArray(raw.tel) ? raw.tel[0] : (raw.tel || '')).trim();
      const email = (Array.isArray(raw.email) ? raw.email[0] : (raw.email || '')).trim().toLowerCase();

      if (!phone && !email) {
        skipped++;
        return;
      }

      const isDup = existingContacts.some(
        (c) =>
          (email && c.email?.toLowerCase() === email) ||
          (phone && c.phone === phone),
      );
      if (isDup) {
        skipped++;
        return;
      }

      const { title, firstName, lastName } = parseNameParts(fullName);
      if (!firstName && !email && !phone) {
        skipped++;
        return;
      }

      await createContact(uid, { title, firstName, lastName, email, phone });
      imported++;
    }),
  );

  results.forEach((r) => {
    if (r.status === 'rejected') skipped++;
  });

  return { imported, skipped };
};
