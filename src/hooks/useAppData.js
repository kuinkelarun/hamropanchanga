import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';

/**
 * Hook that manages all Firestore data subscriptions for the main App component.
 * Handles trees, calendar events (tree/personal/shared), and tree members.
 *
 * @param {Object|null} user - Firebase auth user
 * @param {boolean} isAdmin - Whether user is admin
 * @returns {{ trees, treeCalendarEvents, personalCalendarEvents, sharedTreeCalendarEvents, treeMembers, allFamilyMembers }}
 */
export function useAppData(user, isAdmin) {
  const [trees, setTrees] = useState([]);
  const [treeCalendarEvents, setTreeCalendarEvents] = useState([]);
  const [personalCalendarEvents, setPersonalCalendarEvents] = useState([]);
  const [sharedTreeCalendarEvents, setSharedTreeCalendarEvents] = useState([]);
  const [treeMembers, setTreeMembers] = useState([]);

  // Load trees for current user — includes both owned trees and trees shared with this user
  useEffect(() => {
    if (!user) { setTrees([]); return; }

    const colRef = collection(db, COLLECTIONS.TREES);

    if (isAdmin) {
      const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
        setTrees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.deleted));
      }, (error) => console.error('Error listening to trees:', error));
      return () => unsubscribe();
    }

    // Non-admin: merge owned trees + trees explicitly shared with this user
    const ownedById = new Map();
    const sharedById = new Map();
    const mergeAndSet = () => {
      const merged = new Map([...ownedById, ...sharedById]);
      setTrees([...merged.values()].filter(t => !t.deleted));
    };

    const unsubOwned = onSnapshot(
      query(colRef, where('ownerUid', '==', user.uid)),
      (snapshot) => {
        ownedById.clear();
        snapshot.docs.forEach(d => ownedById.set(d.id, { id: d.id, ...d.data() }));
        mergeAndSet();
      },
      (error) => console.error('Error listening to owned trees:', error)
    );

    const userEmailLower = (user.email || '').toLowerCase();
    const unsubShared = onSnapshot(
      query(colRef, where('sharedWithEmails', 'array-contains', userEmailLower)),
      (snapshot) => {
        sharedById.clear();
        snapshot.docs.forEach(d => sharedById.set(d.id, { id: d.id, ...d.data() }));
        mergeAndSet();
      },
      (error) => console.error('Error listening to shared trees:', error)
    );

    return () => { unsubOwned(); unsubShared(); };
  }, [user, isAdmin]);

  // Load calendar events for the landing-page feed
  useEffect(() => {
    if (!user) {
      setTreeCalendarEvents([]);
      setPersonalCalendarEvents([]);
      return;
    }

    const eventsCollection = collection(db, COLLECTIONS.CALENDAR_EVENTS);

    let treeEventsQuery;
    if (isAdmin) {
      treeEventsQuery = query(eventsCollection, where('treeId', '!=', null));
    } else {
      treeEventsQuery = query(eventsCollection, where('createdBy', '==', user.uid));
    }

    const personalEventsQuery = query(
      eventsCollection,
      where('createdBy', '==', user.uid),
      where('isPublic', '==', false)
    );

    const unsubscribeTree = onSnapshot(treeEventsQuery, (snapshot) => {
      const events = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e) => !!e.treeId);
      setTreeCalendarEvents(events);
    }, (error) => console.error("Error fetching tree calendar events:", error));

    const unsubscribePersonal = onSnapshot(personalEventsQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonalCalendarEvents(events);
    }, (error) => console.error("Error fetching personal calendar events:", error));

    return () => { unsubscribeTree(); unsubscribePersonal(); };
  }, [user, isAdmin]);

  // Load calendar events from trees shared with (but not owned by) this user
  useEffect(() => {
    if (!user || isAdmin) { setSharedTreeCalendarEvents([]); return; }

    const sharedTreeIds = (trees || [])
      .filter(t => t.ownerUid !== user.uid)
      .map(t => t.id);

    if (sharedTreeIds.length === 0) { setSharedTreeCalendarEvents([]); return; }

    const eventsCollection = collection(db, COLLECTIONS.CALENDAR_EVENTS);
    const byId = new Map();
    const unsubs = [];

    for (let i = 0; i < sharedTreeIds.length; i += 30) {
      const chunk = sharedTreeIds.slice(i, i + 30);
      const sharedQ = query(eventsCollection, where('treeId', 'in', chunk));
      unsubs.push(onSnapshot(sharedQ, (snap) => {
        snap.docs.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));
        setSharedTreeCalendarEvents(Array.from(byId.values()));
      }, (err) => console.error('Error fetching shared tree events:', err)));
    }

    return () => unsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
  }, [user, isAdmin, trees]);

  // Load tree members for all user's trees (realtime)
  useEffect(() => {
    if (!user || !trees || trees.length === 0) {
      setTreeMembers([]);
      return;
    }

    const unsubs = [];
    const byTreeId = new Map();

    const publish = () => {
      const merged = [];
      byTreeId.forEach((members) => merged.push(...members));
      setTreeMembers(merged);
    };

    trees.forEach((tree) => {
      const membersRef = collection(db, COLLECTIONS.TREES, tree.id, COLLECTIONS.MEMBERS);
      const unsub = onSnapshot(
        membersRef,
        (snap) => {
          const members = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            treeId: tree.id,
            ...docSnap.data(),
          }));
          byTreeId.set(tree.id, members);
          publish();
        },
        (err) => console.error('Error loading tree members:', err)
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
  }, [user, trees]);

  return {
    trees,
    treeCalendarEvents,
    personalCalendarEvents,
    sharedTreeCalendarEvents,
    treeMembers,
  };
}
