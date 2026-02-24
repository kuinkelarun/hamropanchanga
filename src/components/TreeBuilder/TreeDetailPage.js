import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Trees, Members, Relationships, MarriagePoints } from './utils/firestoreTreeApi';
import AddEventForm from '../AddEventForm';
import TreePreview from './TreePreview';
import MemberModal from './MemberModal';
import KebabMenu from './KebabMenu';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../../constants/firestoreCollections';
import { formatAdDateToNepaliStringWithNumerals } from '../../utils/nepaliDateUtils';
import { normalizePakshaToNepali } from '../../constants/calendarConstants';
import { normalizeForCompare } from '../../utils/textNormalize';
import { createEvent, updateEvent, deleteEvent, getEventsByTree } from '../../services/CalendarEventService';
import { useLanguage } from '../../contexts/LanguageContext';
import TreeShareModal from '../TreeShareModal';

export default function TreeDetailPage({ user }) {
  const { t, tn, isNepali } = useLanguage();
  const { treeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserEmailLower = (user?.email || '').toLowerCase().trim();
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
  const [memberPreviewMode, setMemberPreviewMode] = useState(false);
  const [eventPreviewOpen, setEventPreviewOpen] = useState(false);
  const [previewingEvent, setPreviewingEvent] = useState(null);
  const [highlightedEventId, setHighlightedEventId] = useState(null);
  const [highlightedMemberId, setHighlightedMemberId] = useState(null);
  const [aboutFamilyOpen, setAboutFamilyOpen] = useState(false);
  const [aboutFamilyRows, setAboutFamilyRows] = useState([]);
  const [aboutFamilyEditMode, setAboutFamilyEditMode] = useState(false);
  const [aboutFamilyDescription, setAboutFamilyDescription] = useState('');
  const [aboutFamilyHeaders, setAboutFamilyHeaders] = useState({ field1: 'Field 1', field2: 'Field 2', field3: 'Field 3' });
  const [savingAboutFamily, setSavingAboutFamily] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);

  // Tree sharing state
  const [showShareModal, setShowShareModal] = useState(false);

  // Check for highlighted event ID from navigation state
  useEffect(() => {
    if (location.state?.highlightEventId) {
      setHighlightedEventId(location.state.highlightEventId);
      // Clear the state to prevent persistence
      window.history.replaceState({}, document.title);
      // Scroll to the highlighted event after a brief delay to ensure DOM is rendered
      setTimeout(() => {
        const eventElement = document.getElementById(`event-${location.state.highlightEventId}`);
        if (eventElement) {
          eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [location.state?.highlightEventId]);

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
      
      // Load all data in parallel for faster page load
      const [
        treeData,
        membersList,
        relationshipsList,
        marriagePointsList,
        eventsList
      ] = await Promise.all([
        Trees.get(treeId),
        Members.list(treeId),
        Relationships.list(treeId),
        MarriagePoints.list(treeId),
        getEventsByTree(treeId)
      ]);

      setTree(treeData);

      // Backfill ownerEmail for older trees so shared users can see consistent attribution.
      // Only the owner should write this field.
      if (
        user?.uid &&
        user?.email &&
        treeData?.ownerUid === user.uid &&
        (!treeData.ownerEmail || treeData.ownerEmail !== user.email)
      ) {
        try {
          await Trees.update(treeId, { ownerEmail: user.email });
        } catch (e) {
          // Non-fatal: keep rendering even if backfill fails.
        }
      }
      setMembers(membersList || []);
      setRelationships(relationshipsList || []);
      setMarriagePoints(marriagePointsList || []);
      
      setEvents(eventsList || []);

      // Load About Family data
      const aboutFamily = treeData.aboutFamily || [];
      const aboutDescription = treeData.aboutFamilyDescription || '';
      const aboutHeaders = treeData.aboutFamilyHeaders || { field1: 'Field 1', field2: 'Field 2', field3: 'Field 3' };
      
      // Initialize with at least 7 empty rows
      const initialRows = aboutFamily.length >= 7 ? aboutFamily : [
        ...aboutFamily,
        ...Array(7 - aboutFamily.length).fill({ field1: '', field2: '', field3: '' })
      ];
      setAboutFamilyRows(initialRows);
      setAboutFamilyDescription(aboutDescription);
      setAboutFamilyHeaders(aboutHeaders);
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
      await createEvent({ name, description, date, personId, repetition, tithi, userId: user.uid, treeId });
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

  const handlePreviewEvent = (event) => {
    setPreviewingEvent(event);
    setEventPreviewOpen(true);
  };

  const handleMemberNameClick = (memberId) => {
    if (!memberId) return;
    // Set highlighted member and clear the highlight after 3 seconds
    setHighlightedMemberId(memberId);
    // Scroll to the member card
    setTimeout(() => {
      const memberElement = document.getElementById(`member-${memberId}`);
      if (memberElement) {
        memberElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedMemberId(null);
    }, 3000);
  };

  const handleUpdateEvent = async ({ name, description, date, personId, repetition, tithi }) => {
    if (!user || !treeId || !editingEvent) return;
    try {
      await updateEvent(editingEvent.id, { name, description, date, personId, repetition, tithi });
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
      await deleteEvent(eventId);
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

  const getTithiDisplayString = (tithiInfo) => {
    if (!tithiInfo) return '';
    const { month, paksha, name } = tithiInfo;
    if (!month || !paksha || !name) return '';
    // Normalize paksha to Nepali if it's in English (legacy data)
    const pakshaDisplay = normalizePakshaToNepali(paksha);
    return ` (${month} ${pakshaDisplay} ${name})`;
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setMemberPreviewMode(false);
    setMemberModalOpen(true);
  };

  const handlePreviewMember = (member) => {
    setEditingMember(member);
    setMemberPreviewMode(true);
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

  const handleOpenAboutFamily = () => {
    setAboutFamilyOpen(true);
    setAboutFamilyEditMode(false);
  };

  const handleEditAboutFamily = () => {
    setAboutFamilyEditMode(true);
  };

  const handleCancelEditAboutFamily = () => {
    // Reload data from tree to discard changes
    loadTreeData();
    setAboutFamilyEditMode(false);
  };

  const handleSaveAboutFamily = async () => {
    setSavingAboutFamily(true);
    try {
      // Filter out completely empty rows before saving
      const nonEmptyRows = aboutFamilyRows.filter(row => 
        (row.field1 && row.field1.trim()) || 
        (row.field2 && row.field2.trim()) || 
        (row.field3 && row.field3.trim())
      );
      
      const treeRef = doc(db, COLLECTIONS.TREES, treeId);
      await updateDoc(treeRef, {
        aboutFamily: nonEmptyRows,
        aboutFamilyDescription: aboutFamilyDescription,
        aboutFamilyHeaders: aboutFamilyHeaders,
        updatedAt: serverTimestamp()
      });
      
      setAboutFamilyEditMode(false);
      loadTreeData();
    } catch (err) {
      console.error('Error saving about family:', err);
      alert('Failed to save family information');
    } finally {
      setSavingAboutFamily(false);
    }
  };

  const handleAddRow = () => {
    setAboutFamilyRows([...aboutFamilyRows, { field1: '', field2: '', field3: '' }]);
  };

  const handleRemoveRow = (index) => {
    const newRows = aboutFamilyRows.filter((_, i) => i !== index);
    // Ensure at least 7 rows
    if (newRows.length < 7) {
      const emptyRowsNeeded = 7 - newRows.length;
      setAboutFamilyRows([...newRows, ...Array(emptyRowsNeeded).fill({ field1: '', field2: '', field3: '' })]);
    } else {
      setAboutFamilyRows(newRows);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...aboutFamilyRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setAboutFamilyRows(newRows);
  };

  // Format date for display
  const formatDateForDisplay = (dateObj) => {
    if (!dateObj) return null;
    try {
      let date;
      // Handle Firestore Timestamp objects
      if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        date = dateObj.toDate();
      } else if (dateObj instanceof Date) {
        date = dateObj;
      } else {
        return null;
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // If less than 1 day old, show "today" or "yesterday"
      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) return t('treeDetail.justNow');
        return isNepali ? `${tn(diffHours)} ${t('treeDetail.hoursAgo')}` : `${t('treeDetail.updated')} ${diffHours}${t('treeDetail.hoursAgo')}`;
      }
      if (diffDays === 1) return t('treeDetail.yesterday');
      if (diffDays < 7) return isNepali ? `${tn(diffDays)} ${t('treeDetail.daysAgo')} ${t('treeDetail.updated')}` : `${t('treeDetail.updated')} ${diffDays} ${t('treeDetail.daysAgo')}`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return isNepali ? `${tn(weeks)} ${t('treeDetail.weeksAgo')} ${t('treeDetail.updated')}` : `${t('treeDetail.updated')} ${weeks}${t('treeDetail.weeksAgo')}`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return isNepali ? `${tn(months)} ${t('treeDetail.monthsAgo')} ${t('treeDetail.updated')}` : `${t('treeDetail.updated')} ${months}${t('treeDetail.monthsAgo')}`;
      }
      const years = Math.floor(diffDays / 365);
      return isNepali ? `${tn(years)} ${t('treeDetail.yearsAgo')} ${t('treeDetail.updated')}` : `${t('treeDetail.updated')} ${years}${t('treeDetail.yearsAgo')}`;
    } catch (err) {
      return null;
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
    nickname: m.nickname || '',
    relation: ''
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-800">{tree.title || 'Untitled Tree'}</h1>
                {/* Shared Status Indicator */}
                {tree.sharedWith && Object.keys(tree.sharedWith).length > 0 && (
                  <div className="group relative">
                    <span className="inline-flex items-center justify-center p-1.5 text-blue-700 cursor-pointer rounded hover:bg-blue-50 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                    <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {(
                        tree.ownerUid !== user?.uid &&
                        currentUserEmailLower &&
                        tree.sharedWith &&
                        tree.sharedWith[currentUserEmailLower]
                      )
                        ? `Shared by ${tree.sharedWith[currentUserEmailLower].sharedBy || tree.ownerEmail || 'Unknown User'}`
                        : `Shared with ${Object.keys(tree.sharedWith).length} ${Object.keys(tree.sharedWith).length === 1 ? 'user' : 'users'}`
                      }
                    </div>
                  </div>
                )}
                <button
                  onClick={handleOpenAboutFamily}
                  className="group flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-700 rounded-full font-medium transition-all shadow-sm hover:shadow-md"
                  title="About this family"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">About Family</span>
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  disabled={!user}
                  className="group flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 rounded-full font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Share this tree with other users"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="hidden sm:inline">Share Tree</span>
                </button>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                {tree.location && <span>📍 {tree.location}</span>}
                {tree.contact && (
                  <a 
                    href={`tel:${tree.contact.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors max-w-fit"
                    title={tree.contact}
                  >
                    📞 <span className="truncate">{tree.contact}</span>
                  </a>
                )}
                {tree.updatedAt && (
                  <span 
                    className="text-gray-500 flex items-center gap-1"
                    title={tree.updatedAt?.toDate ? tree.updatedAt.toDate().toLocaleString() : new Date(tree.updatedAt).toLocaleString()}
                  >
                    📅 {formatDateForDisplay(tree.updatedAt)}
                  </span>
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
              <h3 className="text-lg font-bold text-gray-800 mb-4">{t('treeDetail.treePreview')}</h3>
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
                {t('treeDetail.openTreeCanvas')}
              </button>
            </div>
          </div>

          {/* Right Column - Members & Events */}
          <div className="lg:col-span-2 space-y-6">
            {/* Family Members Section */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">{t('treeDetail.familyMembers')}</h3>
                <button
                  onClick={handleAddMember}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  {t('treeDetail.addMember')}
                </button>
              </div>
              {members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {members.map(member => (
                    <div 
                      key={member.id}
                      id={`member-${member.id}`}
                      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                        highlightedMemberId === member.id
                          ? 'bg-yellow-50 border-yellow-400 shadow-lg ring-2 ring-yellow-300'
                          : 'bg-gradient-to-br from-gray-50 to-white border-gray-200'
                      }`}
                      onDoubleClick={() => handlePreviewMember(member)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800">{member.name || 'Unknown'}</h4>
                            {tree?.primaryMemberName && normalizeForCompare(member.name || '') === normalizeForCompare(tree.primaryMemberName) && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                Primary
                              </span>
                            )}
                          </div>
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
                        <div className="ml-2">
                          <KebabMenu
                            onEdit={() => handleEditMember(member)}
                            onDelete={() => handleDeleteMember(member.id)}
                          />
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
                <h3 className="text-lg font-bold text-gray-800">{t('treeDetail.events')}</h3>
                <button
                  onClick={() => setIsAddingEvent(true)}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  {t('treeDetail.addEvent')}
                </button>
              </div>
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map(event => {
                    const nepaliDate = event.dateKey ? formatAdDateToNepaliStringWithNumerals(event.dateKey) : '';
                    const tithiDisplay = getTithiDisplayString(event.tithi);
                    return (
                      <div 
                        key={event.id}
                        id={`event-${event.id}`}
                        className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                          highlightedEventId === event.id
                            ? 'bg-yellow-50 border-yellow-400 shadow-lg ring-2 ring-yellow-300'
                            : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                        }`}
                        onDoubleClick={() => handlePreviewEvent(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{(event.title || 'Untitled Event')}</h4>
                            {event.memberId && (
                              <p className="text-sm text-purple-700 mt-0.5">
                                <span className="cursor-pointer hover:text-purple-900 hover:underline" onClick={(e) => {e.stopPropagation(); handleMemberNameClick(event.memberId);}} title="Click to go to family member">👤 {getMemberName(event.memberId)}</span>
                              </p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">📅 {event.dateKey}</p>
                            {nepaliDate && (
                              <p className="text-sm text-purple-600 mt-0.5">🗓️ {nepaliDate}{tithiDisplay}</p>
                            )}
                            {event.repetition && event.repetition !== 'none' && (
                              <span className="inline-block text-xs px-2 py-0.5 bg-purple-200 text-purple-700 rounded-full mt-2">
                                {event.repetition}
                              </span>
                            )}
                          </div>
                          <div className="ml-3">
                            <KebabMenu
                              onEdit={() => handleEditEvent(event)}
                              onDelete={() => handleDeleteEvent(event.id)}
                            />
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
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
          setMemberPreviewMode(false);
        }}
        onDelete={editingMember ? () => handleDeleteMember(editingMember.id) : undefined}
        previewMode={memberPreviewMode}
      />

      {/* Event Preview Modal */}
      {eventPreviewOpen && previewingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2"
          onClick={() => {
            setEventPreviewOpen(false);
            setPreviewingEvent(null);
          }}
        >
          <div
            className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl backdrop-blur-xl bg-white/80 border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 rounded-t-2xl bg-gradient-to-r from-slate-400 to-slate-500 text-white">
              <h3 className="text-sm font-semibold">{(previewingEvent?.title || t('eventPreview.eventDetails'))}</h3>
              <button
                type="button"
                onClick={() => {
                  setEventPreviewOpen(false);
                  setPreviewingEvent(null);
                }}
                className="text-xs font-medium px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                title="Press Escape or click outside to close"
                aria-label={t('eventPreview.close')}
              >
                ✕
              </button>
            </div>
            
            <div className="px-4 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {previewingEvent.memberId && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">{t('eventPreview.associatedMember')}</label>
                  <div className="mt-1 px-3 py-2 bg-white text-gray-900 rounded-md text-sm border border-gray-300">
                    {getMemberName(previewingEvent.memberId) || '—'}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700">{t('eventPreview.description')}</label>
                <div className="mt-1 px-3 py-2 bg-white text-gray-900 rounded-md text-sm border border-gray-300 max-h-[70px] overflow-y-auto whitespace-pre-wrap">
                  {previewingEvent.description || '—'}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">{t('eventPreview.dateGregorian')}</label>
                <div className="mt-1 px-3 py-2 bg-white text-gray-900 rounded-md text-sm border border-gray-300">
                  {previewingEvent.dateKey || '—'}
                </div>
              </div>

              {previewingEvent.dateKey && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">{t('eventPreview.dateNepali')}</label>
                  <div className="mt-1 px-3 py-2 bg-white text-gray-900 rounded-md text-sm border border-gray-300">
                    {formatAdDateToNepaliStringWithNumerals(previewingEvent.dateKey)}
                    {getTithiDisplayString(previewingEvent.tithi)}
                  </div>
                </div>
              )}

              {previewingEvent.repetition && previewingEvent.repetition !== 'none' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">{t('eventPreview.repetition')}</label>
                  <div className="mt-1 px-3 py-2 bg-white text-gray-900 rounded-md text-sm border border-gray-300">
                    {t(`repetitionValues.${previewingEvent.repetition}`) || previewingEvent.repetition}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About Family Modal */}
      {aboutFamilyOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border border-white/20">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">{tree.title || 'Family'}</h2>
                  {aboutFamilyEditMode ? (
                    <input
                      type="text"
                      value={aboutFamilyDescription}
                      onChange={(e) => setAboutFamilyDescription(e.target.value)}
                      placeholder="Add a short description about your family..."
                      className="mt-1 w-full px-3 py-1.5 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80"
                    />
                  ) : (
                    <p className="text-sm text-gray-600 mt-0.5">
                      {aboutFamilyDescription || 'General information about your family'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAboutFamilyOpen(false);
                    setAboutFamilyEditMode(false);
                  }}
                  className="p-2 active:bg-white/70 sm:hover:bg-white/50 rounded-full transition-colors ml-2 sm:ml-4 touch-manipulation"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {!aboutFamilyEditMode ? (
                /* Preview Mode */
                <div>
                  {aboutFamilyRows.filter(row => 
                    (row.field1 && row.field1.trim()) || 
                    (row.field2 && row.field2.trim()) || 
                    (row.field3 && row.field3.trim())
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {/* Column Headers */}
                      <div className="grid grid-cols-12 gap-2 sm:gap-3 pb-2 border-b-2 border-purple-300 font-semibold text-xs sm:text-sm text-gray-800 bg-purple-50/50 px-2 sm:px-3 py-2 rounded-lg sticky top-0 z-10 backdrop-blur-sm">
                        <div className="col-span-3">{aboutFamilyHeaders.field1}</div>
                        <div className="col-span-4">{aboutFamilyHeaders.field2}</div>
                        <div className="col-span-5">{aboutFamilyHeaders.field3}</div>
                      </div>

                      {/* Data Rows Container with max height for scrolling */}
                      <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
                        {aboutFamilyRows
                          .filter(row => 
                            (row.field1 && row.field1.trim()) || 
                            (row.field2 && row.field2.trim()) || 
                            (row.field3 && row.field3.trim())
                          )
                          .map((row, index) => (
                            <div 
                              key={index} 
                              onClick={() => setSelectedRowIndex(index)}
                              className={`grid grid-cols-12 gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all duration-200 cursor-pointer touch-manipulation ${
                                selectedRowIndex === index 
                                  ? 'bg-purple-100 shadow-sm scale-[1.01] sm:scale-[1.02] border border-purple-300' 
                                  : 'active:bg-purple-50/70 sm:hover:bg-purple-50/50 border border-transparent'
                              }`}
                            >
                              <div className="col-span-3 text-xs sm:text-sm text-gray-700 break-words line-clamp-3">{row.field1 || '-'}</div>
                              <div className="col-span-4 text-xs sm:text-sm text-gray-700 break-words line-clamp-3">{row.field2 || '-'}</div>
                              <div className="col-span-5 text-xs sm:text-sm text-gray-700 break-words line-clamp-3">{row.field3 || '-'}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">No information added yet</p>
                      <p className="text-sm mt-1">Click Edit to add details about your family</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-3 flex flex-col h-full">
                  {/* Editable Column Headers */}
                  <div className="grid grid-cols-12 gap-3 pb-2 border-b border-gray-300 font-semibold text-sm text-gray-700">
                    <input
                      type="text"
                      value={aboutFamilyHeaders.field1}
                      onChange={(e) => setAboutFamilyHeaders({ ...aboutFamilyHeaders, field1: e.target.value })}
                      placeholder="Column 1 Name"
                      className="col-span-3 px-2 py-1 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-purple-50"
                    />
                    <input
                      type="text"
                      value={aboutFamilyHeaders.field2}
                      onChange={(e) => setAboutFamilyHeaders({ ...aboutFamilyHeaders, field2: e.target.value })}
                      placeholder="Column 2 Name"
                      className="col-span-4 px-2 py-1 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-purple-50"
                    />
                    <input
                      type="text"
                      value={aboutFamilyHeaders.field3}
                      onChange={(e) => setAboutFamilyHeaders({ ...aboutFamilyHeaders, field3: e.target.value })}
                      placeholder="Column 3 Name"
                      className="col-span-4 px-2 py-1 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-purple-50"
                    />
                    <div className="col-span-1"></div>
                  </div>

                  {/* Data Rows - Scrollable Container */}
                  <div className="overflow-y-auto max-h-[280px] sm:max-h-[320px] space-y-2 pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {aboutFamilyRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-start group">
                      <input
                        type="text"
                        value={row.field1 || ''}
                        onChange={(e) => handleRowChange(index, 'field1', e.target.value)}
                        placeholder="Enter text..."
                        className="col-span-3 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all break-words whitespace-normal"
                      />
                      <input
                        type="text"
                        value={row.field2 || ''}
                        onChange={(e) => handleRowChange(index, 'field2', e.target.value)}
                        placeholder="Enter text..."
                        className="col-span-4 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all break-words whitespace-normal"
                      />
                      <input
                        type="text"
                        value={row.field3 || ''}
                        onChange={(e) => handleRowChange(index, 'field3', e.target.value)}
                        placeholder="Enter text..."
                        className="col-span-4 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all break-words whitespace-normal"
                      />
                      <button
                        onClick={() => handleRemoveRow(index)}
                        className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    onClick={handleAddRow}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-700 rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Row
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 rounded-b-2xl flex justify-end gap-2 sm:gap-3">
              {!aboutFamilyEditMode ? (
                <button
                  onClick={handleEditAboutFamily}
                  className="px-4 sm:px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 active:from-purple-700 active:to-pink-700 sm:hover:from-purple-700 sm:hover:to-pink-700 text-white rounded-lg font-semibold shadow-md transition-all touch-manipulation"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEditAboutFamily}
                    className="px-4 sm:px-5 py-2 text-sm border border-gray-300 active:bg-white/70 sm:hover:bg-white/50 text-gray-700 rounded-lg font-medium transition-all touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAboutFamily}
                    disabled={savingAboutFamily}
                    className="px-4 sm:px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 active:from-purple-700 active:to-pink-700 sm:hover:from-purple-700 sm:hover:to-pink-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {savingAboutFamily ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tree Share Modal */}
      {showShareModal && user && tree && (
        <TreeShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          tree={tree}
          onComplete={() => {
            loadTreeData(); // Reload to get updated shared info
            setShowShareModal(false);
          }}
          userEmail={user.email}
          userId={user.uid}
        />
      )}
    </div>
  );
}
