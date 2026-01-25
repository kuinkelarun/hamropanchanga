import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trees, Members } from './utils/firestoreTreeApi';
import AddEventForm from '../AddEventForm';
import { signInWithGoogle } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { normalizeForCompare } from '../../utils/textNormalize';
import { useLanguage } from '../../contexts/LanguageContext';
import BulkUploadModal from '../BulkUploadModal';

export default function TreeSelectionPage({ user, isAdmin }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [eventModal, setEventModal] = useState({ open: false, treeId: null, members: [] });
  const [creatingModalOpen, setCreatingModalOpen] = useState(false);
  const [editingModalOpen, setEditingModalOpen] = useState(false);
  const [editingTree, setEditingTree] = useState(null);
  const [newTreeData, setNewTreeData] = useState({
    title: '',
    primaryName: '',
    contact: '',
    location: ''
  });
  const [editTreeData, setEditTreeData] = useState({
    title: '',
    contact: '',
    location: ''
  });

  // Duplicate detection state
  const [treeNameWarning, setTreeNameWarning] = useState('');
  const [treeNameSuggestions, setTreeNameSuggestions] = useState([]);
  const [primaryNameWarning, setPrimaryNameWarning] = useState('');
  const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);

  // Bulk upload state
  const [showBulkUploadConfirmation, setShowBulkUploadConfirmation] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  // Cache owner email lookups for admin display in Other Users section
  const [ownerEmailByUid, setOwnerEmailByUid] = useState({});

  useEffect(() => {
    async function loadTrees() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // If admin, fetch all trees (pass null). Otherwise fetch only user's trees.
        const all = await Trees.list(isAdmin ? null : user.uid);
        const active = (all || []).filter(t => !t.deleted);
        setTrees(active);
      } catch (err) {
        console.error('Error loading trees:', err);
        setError(err.message || 'Failed to load trees');
      } finally {
        setLoading(false);
      }
    }
    loadTrees();
  }, [user, isAdmin]);

  const myTrees = useMemo(() => trees.filter(t => t.ownerUid === user?.uid), [trees, user]);
  const otherTrees = useMemo(() => trees.filter(t => t.ownerUid !== user?.uid), [trees, user]);

  // Check for duplicate tree names (case-insensitive, normalized) and show suggestions
  const checkDuplicateTreeName = (inputName) => {
    if (!inputName.trim()) {
      setTreeNameWarning('');
      setTreeNameSuggestions([]);
      return null;
    }
    
    const normalized = normalizeForCompare(inputName);
    
    // Find all trees that match (partial or full)
    const matches = myTrees.filter(t => {
      const treeTitle = t.title || '';
      const treeNormalized = normalizeForCompare(treeTitle);
      // Match if the input is contained in the tree name
      return treeNormalized.includes(normalized);
    });
    
    // Set suggestions for display
    setTreeNameSuggestions(matches);
    
    // Check for exact match for warning
    const exactMatch = myTrees.find(t => normalizeForCompare(t.title || '') === normalized);
    
    if (exactMatch) {
      setTreeNameWarning(`⚠️ A tree named "${exactMatch.title}" already exists`);
      return exactMatch;
    }
    
    setTreeNameWarning('');
    return null;
  };

  // Check for duplicate primary member names (case-insensitive, normalized)
  const checkDuplicatePrimaryMember = (inputName) => {
    if (!inputName.trim()) {
      setPrimaryNameWarning('');
      return null;
    }
    
    const normalized = normalizeForCompare(inputName);
    const duplicate = myTrees.find(t => {
      const primaryName = t.primaryMemberName || '';
      return normalizeForCompare(primaryName) === normalized;
    });
    
    if (duplicate) {
      setPrimaryNameWarning(`⚠️ "${duplicate.primaryMemberName}" is already the primary member in tree "${duplicate.title}"`);
      return duplicate;
    }
    
    setPrimaryNameWarning('');
    return null;
  };

  // For admins, resolve owner email for other trees
  useEffect(() => {
    async function loadOwnerEmails() {
      if (!isAdmin) return;
      const uniqueOwnerUids = Array.from(new Set((otherTrees || []).map(t => t.ownerUid).filter(Boolean)));
      const missing = uniqueOwnerUids.filter(uid => ownerEmailByUid[uid] === undefined);
      if (missing.length === 0) return;

      try {
        const results = await Promise.all(
          missing.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const data = snap.data() || {};
                return [uid, data.email || data.displayName || uid];
              }
            } catch (e) {
              // ignore individual lookup failures
            }
            return [uid, uid];
          })
        );
        setOwnerEmailByUid(prev => {
          const next = { ...prev };
          for (const [uid, email] of results) next[uid] = email;
          return next;
        });
      } catch (e) {
        // Ignore batch failures; UI will fall back to UID
      }
    }
    loadOwnerEmails();
  }, [isAdmin, otherTrees, ownerEmailByUid]);

  const handleRequireAuth = async () => {
    if (user) return true;
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
      return false;
    }
    // App will re-render with a user after successful sign-in.
    return false;
  };

  const handleOpenTree = treeId => {
    if (!treeId) return;
    // Navigate to tree detail page instead of canvas
    navigate(`/tree/${treeId}`);
  };

  const handleCreateTree = async () => {
    if (!user) {
      const ok = await handleRequireAuth();
      if (!ok) return;
      return;
    }
    // Open creation modal to collect tree title and initial member name
    setCreatingModalOpen(true);
  };

  const confirmCreateTree = async () => {
    if (!user) return;
    
    // Validate required fields
    if (!newTreeData.title.trim()) {
      alert('Tree Name is required');
      return;
    }
    if (!newTreeData.primaryName.trim()) {
      alert('Primary Member Name is required');
      return;
    }
    if (!newTreeData.contact.trim()) {
      alert('Contact Information is required');
      return;
    }
    if (!newTreeData.location.trim()) {
      alert('Location is required');
      return;
    }

    // Check for duplicates
    const treeNameDupe = checkDuplicateTreeName(newTreeData.title);
    const primaryNameDupe = checkDuplicatePrimaryMember(newTreeData.primaryName);
    
    // If duplicates found and not already showing confirmation, show confirmation modal
    if ((treeNameDupe || primaryNameDupe) && !showDuplicateConfirmation) {
      setShowDuplicateConfirmation(true);
      return;
    }
    
    // Proceed with creation
    setCreating(true);
    setError('');
    try {
      const title = newTreeData.title.trim();
      const primaryName = newTreeData.primaryName.trim();
      const contact = newTreeData.contact.trim();
      const location = newTreeData.location.trim();
      
      const newTree = await Trees.create(title, user.uid, { 
        contact, 
        location,
        primaryMemberName: primaryName 
      });
      
      try {
        await Members.create({
          treeId: newTree.id,
          name: primaryName,
          nickname: '',
          gender: 'unknown',
          position: { x: 0, y: 0 },
          archived: false,
        });
      } catch (seedErr) {
        console.error('Error seeding initial member for new tree:', seedErr);
      }
      setCreatingModalOpen(false);
      setNewTreeData({ title: '', primaryName: '', contact: '', location: '' });
      setTreeNameWarning('');
      setTreeNameSuggestions([]);
      setPrimaryNameWarning('');
      setShowDuplicateConfirmation(false);
      // Navigate to the new tree detail page
      navigate(`/tree/${newTree.id}`);
    } catch (err) {
      console.error('Error creating tree:', err);
      setError(err.message || 'Failed to create tree');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenBulkUploadConfirmation = () => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    setShowBulkUploadConfirmation(true);
  };

  const handleConfirmBulkUpload = () => {
    setShowBulkUploadConfirmation(false);
    setShowBulkUploadModal(true);
  };

  const handleBulkUploadComplete = (results, tabType) => {
    setShowBulkUploadModal(false);
    // Reload trees
    loadTrees();
  };

  const loadTrees = async () => {
    if (!user) return;
    try {
      const all = await Trees.list(isAdmin ? null : user.uid);
      const active = (all || []).filter(t => !t.deleted);
      setTrees(active);
    } catch (err) {
      console.error('Error loading trees:', err);
    }
  };

  const handleEditTree = (tree) => {
    setEditingTree(tree);
    setEditTreeData({
      title: tree.title || '',
      contact: tree.contactInfo || tree.contact || '',
      location: tree.location || ''
    });
    setEditingModalOpen(true);
  };

  const confirmEditTree = async () => {
    if (!user || !editingTree) return;
    
    // Validate required fields
    if (!editTreeData.title.trim()) {
      alert('Tree Name is required');
      return;
    }
    if (!editTreeData.contact.trim()) {
      alert('Contact Information is required');
      return;
    }
    if (!editTreeData.location.trim()) {
      alert('Location is required');
      return;
    }
    
    try {
      await Trees.update(editingTree.id, {
        title: editTreeData.title.trim(),
        contactInfo: editTreeData.contact.trim(),
        contact: editTreeData.contact.trim(),
        location: editTreeData.location.trim()
      });
      
      // Refresh list
      const all = await Trees.list(isAdmin ? null : user.uid);
      setTrees((all || []).filter(t => !t.deleted));
      
      setEditingModalOpen(false);
      setEditingTree(null);
      setEditTreeData({ title: '', contact: '', location: '' });
    } catch (err) {
      console.error('Error updating tree:', err);
      setError(err.message || 'Failed to update tree');
    }
  };

  const handleDeleteTree = async (treeId) => {
    const ok = window.confirm('Delete this tree? It will be archived and hidden.');
    if (!ok) return;
    try {
      await Trees.delete(treeId);
      // Refresh list
      const all = await Trees.list(isAdmin ? null : user.uid);
      setTrees((all || []).filter(t => !t.deleted));
    } catch (err) {
      console.error('Error deleting tree:', err);
      setError(err.message || 'Failed to delete tree');
    }
  };

  const handleAddEventFromModal = async ({ name, description, date, personId, repetition, tithi }) => {
    try {
      if (!eventModal.treeId || !user) return;
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'calendarEvents'), {
        title: name,
        titleNormalized: normalizeForCompare(name),
        description: description || '',
        descriptionNormalized: normalizeForCompare(description || ''),
        dateKey: date,
        repetition,
        tithi: tithi || null,
        isPublic: false,
        createdBy: user.uid,
        createdByAdmin: false,
        treeId: eventModal.treeId,
        memberId: personId,
        createdAt: serverTimestamp(),
      });
      setEventModal({ open: false, treeId: null, members: [] });
    } catch (err) {
      console.error('Error adding event:', err);
      alert('Failed to add event: ' + (err.message || 'unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading your trees...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-4 text-gray-800">{t('auth.signInToManageTrees')}</h1>
          <p className="text-sm text-gray-600 mb-6">
            {t('auth.needToSignIn')}
          </p>
          <button
            onClick={handleRequireAuth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm"
          >
            {t('auth.signInWithGoogle')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="mt-3 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            {t('auth.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Message */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-8 border border-gray-200">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-3">{t('treeSelection.buildYourFamilyLegacy')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('treeSelection.legacyDescription')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* My Trees Grid */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h3 className="text-xl font-bold text-gray-800">{t('treeSelection.yourTrees')}</h3>
            <div className="flex gap-3">
              <button
                onClick={handleCreateTree}
                disabled={creating}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {creating ? t('treeSelection.creating') : t('treeSelection.buildNewTree')}
              </button>
              <button
                onClick={handleOpenBulkUploadConfirmation}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold shadow-md transition-all transform hover:scale-105"
              >
                📁 Build From File Upload
              </button>
            </div>
          </div>

          {myTrees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myTrees.map(tree => (
                <div key={tree.id} className="relative bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="cursor-pointer" onClick={() => handleOpenTree(tree.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 mb-1">{tree.title || t('treeSelection.untitledTree')}</h4>
                        <p className="text-xs text-gray-500">ID: {tree.id}</p>
                      </div>
                    </div>
                    {tree.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {tree.location}</p>
                    )}
                    {tree.contact && (
                      <a 
                        href={`tel:${tree.contact.replace(/\D/g, '')}`}
                        className="inline-flex items-center gap-1 text-sm text-gray-600 mb-2 hover:text-blue-600 transition-colors max-w-fit"
                        title={tree.contact}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 <span className="truncate">{tree.contact}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium" onClick={() => handleOpenTree(tree.id)}>{t('treeSelection.viewDetails')}</button>
                    <button className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleEditTree(tree); }}>{t('treeSelection.edit')}</button>
                    <button className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleDeleteTree(tree.id); }}>{t('treeSelection.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">{t('treeSelection.noTreesYet')}</p>
              <p className="text-sm text-gray-500">{t('treeSelection.getStartedMessage')}</p>
            </div>
          )}
        </div>

        {/* Other Users' Trees Grid (Admin Only) */}
        {isAdmin && otherTrees.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{t('treeSelection.otherUsersTrees')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherTrees.map(tree => (
                <div key={tree.id} className="relative bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="cursor-pointer" onClick={() => handleOpenTree(tree.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 mb-1">{tree.title || t('treeSelection.untitledTree')}</h4>
                        <p className="text-xs text-gray-500">ID: {tree.id}</p>
                        {tree.ownerUid && (
                          <p className="text-xs text-gray-400 mt-1">
                            {t('treeSelection.owner')} {ownerEmailByUid[tree.ownerUid] || tree.ownerEmail || tree.ownerUid}
                          </p>
                        )}
                      </div>
                    </div>
                    {tree.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {tree.location}</p>
                    )}
                    {tree.contact && (
                      <a 
                        href={`tel:${tree.contact.replace(/\D/g, '')}`}
                        className="inline-flex items-center gap-1 text-sm text-gray-600 mb-2 hover:text-blue-600 transition-colors max-w-fit"
                        title={tree.contact}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 <span className="truncate">{tree.contact}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium" onClick={() => handleOpenTree(tree.id)}>{t('treeSelection.viewDetails')}</button>
                    <button className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleEditTree(tree); }}>{t('treeSelection.edit')}</button>
                    <button className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleDeleteTree(tree.id); }}>{t('treeSelection.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Tree Modal */}
      {creatingModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{t('treeSelection.createNewFamilyTree')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.treeName')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <div className="relative">
                  <input 
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      treeNameWarning ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                    }`}
                    value={newTreeData.title} 
                    onChange={(e) => {
                      setNewTreeData({...newTreeData, title: e.target.value});
                      checkDuplicateTreeName(e.target.value);
                    }}
                    placeholder={t('treeSelection.treeNamePlaceholder')}
                  />
                  
                  {/* Suggestions dropdown */}
                  {treeNameSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                        Existing trees with similar names:
                      </div>
                      {treeNameSuggestions.map(tree => (
                        <button
                          key={tree.id}
                          type="button"
                          onClick={() => {
                            // Navigate to existing tree
                            setCreatingModalOpen(false);
                            setNewTreeData({ title: '', primaryName: '', contact: '', location: '' });
                            setTreeNameSuggestions([]);
                            handleOpenTree(tree.id);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{tree.title}</p>
                              {tree.primaryMemberName && (
                                <p className="text-xs text-gray-500 mt-0.5">Primary: {tree.primaryMemberName}</p>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {treeNameWarning && (
                  <p className="mt-1 text-xs text-yellow-700 flex items-center gap-1">
                    {treeNameWarning}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.primaryMemberName')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    primaryNameWarning ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                  }`}
                  value={newTreeData.primaryName} 
                  onChange={(e) => {
                    setNewTreeData({...newTreeData, primaryName: e.target.value});
                    checkDuplicatePrimaryMember(e.target.value);
                  }}
                  placeholder={t('treeSelection.primaryMemberPlaceholder')}
                />
                {primaryNameWarning && (
                  <p className="mt-1 text-xs text-yellow-700 flex items-center gap-1">
                    {primaryNameWarning}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.contactInformation')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.contact} 
                  onChange={(e) => setNewTreeData({...newTreeData, contact: e.target.value})} 
                  placeholder={t('treeSelection.contactPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.location')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.location} 
                  onChange={(e) => setNewTreeData({...newTreeData, location: e.target.value})} 
                  placeholder={t('treeSelection.locationPlaceholder')}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors" 
                onClick={() => { 
                  setCreatingModalOpen(false); 
                  setNewTreeData({ title: '', primaryName: '', contact: '', location: '' });
                  setTreeNameWarning('');
                  setTreeNameSuggestions([]);
                  setPrimaryNameWarning('');
                  setShowDuplicateConfirmation(false);
                }}
              >
                {t('treeSelection.cancel')}
              </button>
              <button 
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60" 
                onClick={confirmCreateTree}
                disabled={creating}
              >
                {creating ? t('treeSelection.creating') : t('treeSelection.createTree')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Tree Modal */}
      {editingModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{t('treeSelection.editTree')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.treeName')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.title} 
                  onChange={(e) => setEditTreeData({...editTreeData, title: e.target.value})} 
                  placeholder={t('treeSelection.treeNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.contactInformation')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.contact} 
                  onChange={(e) => setEditTreeData({...editTreeData, contact: e.target.value})} 
                  placeholder={t('treeSelection.contactPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('treeSelection.location')} <span className="text-red-500">{t('treeSelection.required')}</span></label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.location} 
                  onChange={(e) => setEditTreeData({...editTreeData, location: e.target.value})} 
                  placeholder={t('treeSelection.locationPlaceholder')}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors" 
                onClick={() => { 
                  setEditingModalOpen(false); 
                  setEditingTree(null);
                  setEditTreeData({ title: '', contact: '', location: '' }); 
                }}
              >
                {t('treeSelection.cancel')}
              </button>
              <button 
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors" 
                onClick={confirmEditTree}
              >
                {t('treeSelection.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-yellow-400">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Possible Duplicate Detected</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {treeNameWarning && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="font-medium text-yellow-800">Tree Name Issue:</p>
                      <p className="text-yellow-700 mt-1">{treeNameWarning}</p>
                    </div>
                  )}
                  {primaryNameWarning && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="font-medium text-yellow-800">Primary Member Issue:</p>
                      <p className="text-yellow-700 mt-1">{primaryNameWarning}</p>
                    </div>
                  )}
                  <p className="mt-3 text-gray-600">
                    Are you sure you want to create this tree? This may result in duplicate family trees.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors" 
                onClick={() => {
                  setShowDuplicateConfirmation(false);
                }}
              >
                Go Back & Edit
              </button>
              <button 
                className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors" 
                onClick={() => {
                  setShowDuplicateConfirmation(false);
                  confirmCreateTree(); // Proceed with creation
                }}
              >
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {eventModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-lg">
            <AddEventForm familyMembers={eventModal.members} onAdd={handleAddEventFromModal} onCancel={() => setEventModal({ open: false, treeId: null, members: [] })} />
          </div>
        </div>
      )}

      {/* Bulk Upload Confirmation Dialog */}
      {showBulkUploadConfirmation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Ready for Bulk Upload?</h3>
            <p className="text-gray-600 mb-6">
              This feature is recommended for uploading 5 or more trees at once. It can also bulk upload family members and events. Do you have your Excel/CSV file ready?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkUploadConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkUpload}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded hover:from-blue-700 hover:to-cyan-700 transition"
              >
                Proceed to Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <BulkUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          onComplete={handleBulkUploadComplete}
          userId={user.uid}
          userEmail={user.email}
        />
      )}
    </div>
  );
}
