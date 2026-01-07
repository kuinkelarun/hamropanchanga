import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trees, Members, Relationships, MarriagePoints } from './utils/firestoreTreeApi';
import AddEventForm from '../AddEventForm';
import TreePreview from './TreePreview';
import MemberModal from './MemberModal';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { formatAdDateToNepaliStringWithNumerals, convertAdToBs } from '../../utils/nepaliDateUtils';

export default function TreeDetailPage({ user }) {
  const { treeId } = useParams();
  const navigate = useNavigate();
  const [tree, setTree] = useState(null);
  const [members, setMembers] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [marriagePoints, setMarriagePoints] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  useEffect(() => {
    loadTreeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, user]);

  // Scroll to top only on initial mount, not on every treeId change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const loadTreeData = async () => {
    if (!treeId) return;
    
    // Wait for user authentication to be resolved before attempting to fetch data
    // This prevents "Missing or insufficient permissions" errors during initial load
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Loading tree data for:', { treeId });
      }
      
      // Load tree metadata
      const treeData = await Trees.get(treeId);
      console.log('Tree loaded:', treeData);
      setTree(treeData);

      // Load members
      const membersList = await Members.list(treeId);
      setMembers(membersList || []);

      // Load relationships
      const relationshipsList = await Relationships.list(treeId);
      setRelationships(relationshipsList || []);

      // Load marriage points
      const marriagePointsList = await MarriagePoints.list(treeId);
      setMarriagePoints(marriagePointsList || []);

      // Load events for this tree
      const eventsQuery = query(
        collection(db, 'calendarEvents'),
        where('treeId', '==', treeId)
      );
      const eventsSnap = await getDocs(eventsQuery);
      const eventsList = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsList);
    } catch (err) {
      console.error('Error loading tree data:', err);
      setError(err.message || 'Failed to load tree data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async ({ name, description, date, personId, repetition, tithi }) => {
    if (!user || !treeId) return;
    try {
      // For any repeating non-tithi events, store the original Nepali date
      // so we can match it correctly across repetitions (same logic as NepaliCalendar.js)
      let nepaliDateForRecurrence = null;
      if ((repetition === 'yearly' || repetition === 'monthly') && !tithi) {
        // Extract Nepali date from the AD date selected
        const [adY, adM, adD] = date.split('-').map(Number);
        const bsDate = convertAdToBs(adY, adM - 1, adD);
        nepaliDateForRecurrence = {
          year: bsDate.year,
          month: bsDate.month,
          day: bsDate.day
        };
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[TreeDetailPage] Storing Nepali date for ${repetition} recurrence:`, {
            nepaliDate: `${bsDate.year}/${bsDate.month}/${bsDate.day}`,
            adDate: date,
            title: name
          });
        }
      }

      const eventData = {
        title: name,
        description: description || '',
        dateKey: date,
        repetition,
        // Standardize: always set `tithi` field; null when not used.
        tithi: tithi || null,
        // Store original Nepali date for yearly/monthly recurrence (non-tithi events)
        nepaliDateForRecurrence: nepaliDateForRecurrence || null,
        isPublic: false,
        createdBy: user.uid,
        createdByAdmin: false,
        treeId: treeId,
        memberId: personId,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'calendarEvents'), eventData);
      setIsAddingEvent(false);
      loadTreeData(); // Refresh events
    } catch (err) {
      console.error('Error adding event:', err);
      alert('Failed to add event: ' + (err.message || 'unknown error'));
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setIsAddingEvent(true);
  };

  const handleUpdateEvent = async ({ name, description, date, personId, repetition, tithi }) => {
    if (!user || !treeId || !editingEvent) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const eventRef = doc(db, 'calendarEvents', editingEvent.id);
      
      // For any repeating non-tithi events, store the original Nepali date
      // (same logic as handleAddEvent and NepaliCalendar.js)
      let nepaliDateForRecurrence = null;
      if ((repetition === 'yearly' || repetition === 'monthly') && !tithi) {
        const [adY, adM, adD] = date.split('-').map(Number);
        const bsDate = convertAdToBs(adY, adM - 1, adD);
        nepaliDateForRecurrence = {
          year: bsDate.year,
          month: bsDate.month,
          day: bsDate.day
        };
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[TreeDetailPage] Updating Nepali date for ${repetition} recurrence:`, {
            nepaliDate: `${bsDate.year}/${bsDate.month}/${bsDate.day}`,
            adDate: date,
            title: name
          });
        }
      }
      
      const updateData = {
        title: name,
        description: description || '',
        dateKey: date,
        repetition,
        memberId: personId,
        // Update nepaliDateForRecurrence for recurring events
        nepaliDateForRecurrence: nepaliDateForRecurrence || null,
      };
      
      // Update tithi info if provided
      if (tithi) {
        updateData.tithi = tithi;
      } else {
        // Clear tithi if switching from tithi mode to date mode
        updateData.tithi = null;
      }
      
      await updateDoc(eventRef, updateData);
      setIsAddingEvent(false);
      setEditingEvent(null);
      loadTreeData(); // Refresh events
    } catch (err) {
      console.error('Error updating event:', err);
      alert('Failed to update event: ' + (err.message || 'unknown error'));
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'calendarEvents', eventId));
      loadTreeData(); // Refresh events
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event');
    }
  };

  const handleOpenCanvas = () => {
    navigate(`/builder?treeId=${treeId}`);
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? (member.name || 'Unknown') : 'Unknown';
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (memberData) => {
    if (!treeId) return;
    try {
      if (editingMember) {
        await Members.update(editingMember.id, { treeId, ...memberData });
      } else {
        // Create new member in pool (no position)
        await Members.create({ treeId, ...memberData, position: null, archived: false });
      }
      setMemberModalOpen(false);
      setEditingMember(null);
      loadTreeData();
    } catch (err) {
      console.error('Error saving member:', err);
      alert('Failed to save member');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Delete this member?')) return;
    try {
      await Members.delete(memberId, treeId);
      loadTreeData();
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('Failed to delete member');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-gray-600">Loading tree details...</div>
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-4 text-gray-800">Error</h1>
          <p className="text-sm text-red-600 mb-6">{error || 'Tree not found'}</p>
          <button
            onClick={() => navigate('/trees')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Back to Trees
          </button>
        </div>
      </div>
    );
  }

  const familyMembersForForm = members.map(m => ({
    id: m.id,
    name: m.name || 'Unknown',
    relation: ''
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{tree.title || 'Untitled Tree'}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              {tree.location && <span>📍 {tree.location}</span>}
              {tree.contact && (
                <a 
                  href={`tel:${tree.contact.replace(/\D/g, '')}`}
                  className="hover:text-blue-600 transition-colors"
                >
                  📞 {tree.contact}
                </a>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tree Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 sticky top-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Tree Preview</h3>
              <TreePreview
                treeId={treeId}
                members={members}
                relationships={relationships}
                marriagePoints={marriagePoints}
                onClick={handleOpenCanvas}
              />
              <button
                onClick={handleOpenCanvas}
                className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-md transition-all transform hover:scale-105"
              >
                Open Tree Canvas
              </button>
            </div>
          </div>

          {/* Right Column - Members & Events */}
          <div className="lg:col-span-2 space-y-6">
            {/* Family Members Section */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Family Members</h3>
                <button
                  onClick={handleAddMember}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  Add Member
                </button>
              </div>
              {members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {members.map(member => (
                    <div key={member.id} className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{member.name || 'Unknown'}</h4>
                          {member.nickname && (
                            <p className="text-xs text-gray-500 mt-0.5">"{member.nickname}"</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {member.gender && member.gender !== 'unknown' && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize">
                                {member.gender}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No family members added yet.</p>
                  <p className="text-sm mt-1">Open the canvas to start building your tree.</p>
                </div>
              )}
            </div>

            {/* Events Section */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Events</h3>
                <button
                  onClick={() => setIsAddingEvent(true)}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Add Event
                </button>
              </div>
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map(event => {
                    const nepaliDate = event.dateKey ? formatAdDateToNepaliStringWithNumerals(event.dateKey) : '';
                    return (
                      <div key={event.id} className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{event.title || 'Untitled Event'}</h4>
                            {event.memberId && (
                              <p className="text-sm text-purple-700 mt-0.5">👤 {getMemberName(event.memberId)}</p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">📅 {event.dateKey}</p>
                            {nepaliDate && (
                              <p className="text-sm text-purple-600 mt-0.5">🗓️ {nepaliDate}</p>
                            )}
                            {event.repetition && event.repetition !== 'none' && (
                              <span className="inline-block text-xs px-2 py-0.5 bg-purple-200 text-purple-700 rounded-full mt-2">
                                {event.repetition}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 ml-3">
                            <button
                              onClick={() => handleEditEvent(event)}
                              className="px-3 py-1.5 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No events added yet.</p>
                  <p className="text-sm mt-1">Click "Add Event" to create important dates.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {isAddingEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <AddEventForm
              familyMembers={familyMembersForForm}
              onAdd={editingEvent ? handleUpdateEvent : handleAddEvent}
              onCancel={() => {
                setIsAddingEvent(false);
                setEditingEvent(null);
              }}
              editingEvent={editingEvent}
            />
          </div>
        </div>
      )}

      {/* Add/Edit Member Modal */}
      <MemberModal
        open={memberModalOpen}
        member={editingMember}
        allMembers={members}
        onSave={handleSaveMember}
        onClose={() => {
          setMemberModalOpen(false);
          setEditingMember(null);
        }}
        onDelete={editingMember ? () => handleDeleteMember(editingMember.id) : undefined}
      />
    </div>
  );
}
