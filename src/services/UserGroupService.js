import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, getDocs, serverTimestamp,
} from 'firebase/firestore';

const COL = 'userGroups';

export const getUserGroups = async (uid) => {
  const q = query(
    collection(db, COL),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
