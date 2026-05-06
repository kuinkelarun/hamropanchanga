/**
 * CalendarEventService.js
 * 
 * Centralized service for all calendar event CRUD operations.
 * Replaces duplicated Firestore logic previously spread across
 * TreeDetailPage, TreeSelectionPage, and NepaliCalendar.
 */
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeForCompare } from '../utils/textNormalize';
import { computeNepaliRecurrence } from '../utils/nepaliRecurrence';

const COLLECTION = 'calendarEvents';

/**
 * Build a standardized calendar event document for Firestore.
 *
 * @param {Object} params
 * @param {string} params.name        – Event title
 * @param {string} [params.description] – Optional description
 * @param {string} params.date        – AD date key (YYYY-MM-DD)
 * @param {string} [params.personId]  – Associated member ID
 * @param {string} [params.repetition] – 'none' | 'monthly' | 'yearly'
 * @param {Object|null} [params.tithi] – Tithi info object or null
 * @param {string} params.userId      – Firebase auth UID of the creator
 * @param {string} params.treeId      – Tree ID the event belongs to
 * @param {boolean} [params.isPublic] – Visibility flag (default false)
 * @param {boolean} [params.isAdmin]  – Whether created by an admin (default false)
 * @returns {Object} Firestore-ready document (without serverTimestamp for createdAt – added in create)
 */
export function buildEventDocument({ name, description, date, personId, repetition = 'none', tithi, userId, treeId, isPublic = false, isAdmin = false, showInAdhika = false }) {
  const nepaliDateForRecurrence = computeNepaliRecurrence(date, repetition, tithi);

  return {
    title: name,
    titleNormalized: normalizeForCompare(name),
    description: description || '',
    descriptionNormalized: normalizeForCompare(description || ''),
    dateKey: date,
    repetition,
    tithi: tithi || null,
    nepaliDateForRecurrence: nepaliDateForRecurrence || null,
    isPublic,
    createdBy: userId,
    createdByAdmin: isAdmin,
    treeId: treeId || null,
    memberId: personId || null,
    showInAdhika: !!showInAdhika,
  };
}

/**
 * Create a new calendar event in Firestore.
 *
 * @param {Object} params – Same as buildEventDocument params
 * @returns {Promise<import('firebase/firestore').DocumentReference>}
 */
export async function createEvent(params) {
  const docData = buildEventDocument(params);
  docData.createdAt = serverTimestamp();
  return addDoc(collection(db, COLLECTION), docData);
}

/**
 * Update an existing calendar event.
 *
 * @param {string} eventId – Firestore doc ID
 * @param {Object} params  – Fields to update (same shape as buildEventDocument sans userId/treeId)
 * @returns {Promise<void>}
 */
export async function updateEvent(eventId, { name, description, date, personId, repetition = 'none', tithi, showInAdhika = false }) {
  const nepaliDateForRecurrence = computeNepaliRecurrence(date, repetition, tithi);

  const updateData = {
    title: name,
    titleNormalized: normalizeForCompare(name),
    description: description || '',
    descriptionNormalized: normalizeForCompare(description || ''),
    dateKey: date,
    repetition,
    memberId: personId || null,
    nepaliDateForRecurrence: nepaliDateForRecurrence || null,
    tithi: tithi || null,
    showInAdhika: !!showInAdhika,
  };

  const eventRef = doc(db, COLLECTION, eventId);
  return updateDoc(eventRef, updateData);
}

/**
 * Delete a calendar event by ID.
 *
 * @param {string} eventId – Firestore doc ID
 * @returns {Promise<void>}
 */
export async function deleteEvent(eventId) {
  return deleteDoc(doc(db, COLLECTION, eventId));
}

/**
 * Fetch all calendar events for a specific tree.
 *
 * @param {string} treeId
 * @returns {Promise<Array<Object>>}
 */
export async function getEventsByTree(treeId) {
  const q = query(collection(db, COLLECTION), where('treeId', '==', treeId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
