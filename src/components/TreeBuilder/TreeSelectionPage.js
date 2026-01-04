import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trees, Members } from './utils/firestoreTreeApi';
import AddEventForm from '../AddEventForm';
import { signInWithGoogle } from '../../firebase';

export default function TreeSelectionPage({ user, isAdmin }) {
  const navigate = useNavigate();
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
      // Navigate to the new tree detail page
      navigate(`/tree/${newTree.id}`);
    } catch (err) {
      console.error('Error creating tree:', err);
      setError(err.message || 'Failed to create tree');
    } finally {
      setCreating(false);
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
      const all = await Trees.list(user.uid);
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
      const all = await Trees.list(user.uid);
      setTrees((all || []).filter(t => !t.deleted));
    } catch (err) {
      console.error('Error deleting tree:', err);
      setError(err.message || 'Failed to delete tree');
    }
  };

  const handleAddEventFromModal = async ({ name, date, personId, repetition, tithi }) => {
    try {
      if (!eventModal.treeId || !user) return;
      const { db } = await import('../../firebase');
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'calendarEvents'), {
        title: name,
        description: '',
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
          <h1 className="text-xl font-semibold mb-4 text-gray-800">Sign in to manage your trees</h1>
          <p className="text-sm text-gray-600 mb-6">
            You need to be signed in to create or open a family tree.
          </p>
          <button
            onClick={handleRequireAuth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm"
          >
            Sign in with Google
          </button>
          <button
            onClick={() => navigate('/')}
            className="mt-3 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const myTrees = trees.filter(t => t.ownerUid === user.uid);
  const otherTrees = trees.filter(t => t.ownerUid !== user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Your Family Trees</h1>
            <p className="text-sm text-gray-600 mt-1">Connect your past. Branch out your future.</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Message */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-8 border border-gray-200">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Build Your Family Legacy</h2>
            <p className="text-gray-600 leading-relaxed">
              Choose an existing tree to continue building your family history, or start fresh with a new tree. 
              Each tree can hold unlimited family members, relationships, and important life events.
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Your Trees</h3>
            <button
              onClick={handleCreateTree}
              disabled={creating}
              className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-md transition-all transform hover:scale-105"
            >
              {creating ? 'Creating...' : '+ Build New Tree'}
            </button>
          </div>

          {myTrees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myTrees.map(tree => (
                <div key={tree.id} className="relative bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="cursor-pointer" onClick={() => handleOpenTree(tree.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 mb-1">{tree.title || 'Untitled Tree'}</h4>
                        <p className="text-xs text-gray-500">ID: {tree.id}</p>
                      </div>
                    </div>
                    {tree.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {tree.location}</p>
                    )}
                    {tree.contact && (
                      <a 
                        href={`tel:${tree.contact.replace(/\D/g, '')}`}
                        className="text-sm text-gray-600 mb-2 block hover:text-blue-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 {tree.contact}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium" onClick={() => handleOpenTree(tree.id)}>View Details</button>
                    <button className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleEditTree(tree); }}>Edit</button>
                    <button className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleDeleteTree(tree.id); }}>Delete</button>
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
              <p className="text-gray-600 mb-4">You don't have any trees yet.</p>
              <p className="text-sm text-gray-500">Click "Build New Tree" to get started on your family history journey.</p>
            </div>
          )}
        </div>

        {/* Other Users' Trees Grid (Admin Only) */}
        {isAdmin && otherTrees.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Other Users' Trees</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherTrees.map(tree => (
                <div key={tree.id} className="relative bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="cursor-pointer" onClick={() => handleOpenTree(tree.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 mb-1">{tree.title || 'Untitled Tree'}</h4>
                        <p className="text-xs text-gray-500">ID: {tree.id}</p>
                        {tree.ownerUid && <p className="text-xs text-gray-400 mt-1">Owner: {tree.ownerUid}</p>}
                      </div>
                    </div>
                    {tree.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {tree.location}</p>
                    )}
                    {tree.contact && (
                      <a 
                        href={`tel:${tree.contact.replace(/\D/g, '')}`}
                        className="text-sm text-gray-600 mb-2 block hover:text-blue-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 {tree.contact}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium" onClick={() => handleOpenTree(tree.id)}>View Details</button>
                    <button className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleEditTree(tree); }}>Edit</button>
                    <button className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium" onClick={(e) => { e.stopPropagation(); handleDeleteTree(tree.id); }}>Delete</button>
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
            <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Family Tree</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tree Name *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.title} 
                  onChange={(e) => setNewTreeData({...newTreeData, title: e.target.value})} 
                  placeholder="e.g., Smith Family Tree" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Member Name *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.primaryName} 
                  onChange={(e) => setNewTreeData({...newTreeData, primaryName: e.target.value})} 
                  placeholder="e.g., John Smith" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.contact} 
                  onChange={(e) => setNewTreeData({...newTreeData, contact: e.target.value})} 
                  placeholder="Phone or Email" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={newTreeData.location} 
                  onChange={(e) => setNewTreeData({...newTreeData, location: e.target.value})} 
                  placeholder="City, State, or Country" 
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors" 
                onClick={() => { 
                  setCreatingModalOpen(false); 
                  setNewTreeData({ title: '', primaryName: '', contact: '', location: '' }); 
                }}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60" 
                onClick={confirmCreateTree}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Tree'}
              </button>
            </div>
          </div>
        </div>
      )}
Edit Tree Modal */}
      {editingModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Tree</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tree Name *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.title} 
                  onChange={(e) => setEditTreeData({...editTreeData, title: e.target.value})} 
                  placeholder="e.g., Smith Family Tree" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.contact} 
                  onChange={(e) => setEditTreeData({...editTreeData, contact: e.target.value})} 
                  placeholder="Phone or Email" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  value={editTreeData.location} 
                  onChange={(e) => setEditTreeData({...editTreeData, location: e.target.value})} 
                  placeholder="City, State, or Country" 
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
                Cancel
              </button>
              <button 
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors" 
                onClick={confirmEditTree}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
      {/* Add Event Modal */}
      {eventModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-lg">
            <AddEventForm familyMembers={eventModal.members} onAdd={handleAddEventFromModal} onCancel={() => setEventModal({ open: false, treeId: null, members: [] })} />
          </div>
        </div>
      )}
    </div>
  );
}
