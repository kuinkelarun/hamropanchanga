import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';

/**
 * Hook that manages Firestore listeners for calendar events.
 * Handles guest mode (public + tree events), authenticated users
 * (public + user + tree + shared), and admin mode (all above + admin private).
 *
 * @param {Object} params
 * @param {Object|null} params.user - Firebase auth user object
 * @param {boolean} params.authLoading - Whether auth state is still loading
 * @param {boolean} params.isAdmin - Whether user is admin
 * @param {string[]} params.sharedTreeIds - IDs of trees shared with (but not owned by) user
 * @returns {{ calendarEvents: Array, setCalendarEvents: Function }}
 */
export function useCalendarEvents({ user, authLoading, isAdmin, sharedTreeIds = [] }) {
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    if (authLoading) return;

    const eventsCollection = collection(db, COLLECTIONS.CALENDAR_EVENTS);

    if (!user) {
      // --- Guest mode: public events + tree-linked events ---
      const publicQuery = query(eventsCollection, where('isPublic', '==', true));
      const treeQuery = query(eventsCollection);

      let publicEventsById = new Map();
      let treeEventsById = new Map();

      const emitMerged = () => {
        const merged = new Map();
        [publicEventsById, treeEventsById].forEach(m => m.forEach((v, k) => merged.set(k, v)));
        setCalendarEvents(Array.from(merged.values()));
      };

      const unsub1 = onSnapshot(publicQuery, (snap) => {
        publicEventsById = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
        emitMerged();
      }, (err) => console.error('Public events error:', err));

      const unsub2 = onSnapshot(treeQuery, (snap) => {
        const next = new Map();
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.treeId) next.set(d.id, { id: d.id, ...data });
        });
        treeEventsById = next;
        emitMerged();
      }, (err) => console.error('Tree events error:', err));

      return () => { unsub1(); unsub2(); };
    }

    // --- Authenticated mode ---
    const publicQuery = query(eventsCollection, where('isPublic', '==', true));
    const userQuery = query(eventsCollection, where('createdBy', '==', user.uid));

    // Admin sees all events; regular users only see their own + shared
    const treeQuery = isAdmin ? query(eventsCollection) : null;

    // Chunk shared tree IDs (Firestore `in` limit = 30)
    const sharedChunks = (!isAdmin && sharedTreeIds.length > 0)
      ? Array.from({ length: Math.ceil(sharedTreeIds.length / 30) }, (_, i) =>
          sharedTreeIds.slice(i * 30, i * 30 + 30))
      : [];

    let publicEventsById = new Map();
    let userEventsById = new Map();
    let treeEventsById = new Map();
    let adminPrivateEventsById = new Map();

    const emitMerged = () => {
      const merged = new Map();
      [publicEventsById, userEventsById, treeEventsById, adminPrivateEventsById]
        .forEach(m => m.forEach((v, k) => merged.set(k, v)));
      setCalendarEvents(Array.from(merged.values()));
    };

    const unsub1 = onSnapshot(publicQuery, (snap) => {
      publicEventsById = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      emitMerged();
    }, (err) => console.error('Public events error:', err));

    const unsub2 = onSnapshot(userQuery, (snap) => {
      userEventsById = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      emitMerged();
    }, (err) => console.error('User events error:', err));

    const unsub3 = treeQuery
      ? onSnapshot(treeQuery, (snap) => {
          const next = new Map();
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.treeId) next.set(d.id, { id: d.id, ...data });
          });
          treeEventsById = next;
          emitMerged();
        }, (err) => console.error('Tree events error:', err))
      : () => {};

    const sharedUnsubs = sharedChunks.map(chunk => {
      const sharedQ = query(eventsCollection, where('treeId', 'in', chunk));
      return onSnapshot(sharedQ, (snap) => {
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.treeId) treeEventsById.set(d.id, { id: d.id, ...data });
        });
        emitMerged();
      }, (err) => console.error('Shared tree events error:', err));
    });

    let unsub4 = null;
    if (isAdmin) {
      const adminPrivateQuery = query(
        eventsCollection,
        where('createdByAdmin', '==', true),
        where('isPublic', '==', false)
      );
      unsub4 = onSnapshot(adminPrivateQuery, (snap) => {
        adminPrivateEventsById = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
        emitMerged();
      }, (err) => console.error('Admin private events error:', err));
    }

    return () => {
      unsub1(); unsub2(); unsub3();
      if (unsub4) unsub4();
      sharedUnsubs.forEach(u => u());
    };
  }, [authLoading, user, isAdmin, sharedTreeIds]);

  return { calendarEvents, setCalendarEvents };
}
