import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, getDocs, getDoc, serverTimestamp,
} from 'firebase/firestore';

const COL = 'userGroups';

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

export const getUserGroups = async (uid) => {
  const q = query(
    collection(db, COL),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAccessibleGroups = async (uid, options = {}) => {
  const { includeAllOwners = false } = options;
  if (!includeAllOwners) {
    return getUserGroups(uid);
  }

  const q = query(
    collection(db, COL),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ownerDirectory = await buildOwnerDirectory(groups.map((group) => group.ownerUid));
  return attachOwnerMetadata(groups, ownerDirectory, uid);
};

export const createUserGroup = async (uid, name, description = '', members = []) => {
  return addDoc(collection(db, COL), {
    ownerUid: uid,
    name,
    description,
    members,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateUserGroup = async (groupId, patch) => {
  await updateDoc(doc(db, COL, groupId), { ...patch, updatedAt: serverTimestamp() });
};

export const deleteUserGroup = async (groupId) => {
  await deleteDoc(doc(db, COL, groupId));
};
