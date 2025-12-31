import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trees, Members } from './utils/firestoreTreeApi';
import { signInWithGoogle } from '../../firebase';

export default function TreeSelectionPage({ user }) {
  const navigate = useNavigate();
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTrees() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const all = await Trees.list(user.uid);
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
  }, [user]);

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
    navigate(`/builder?treeId=${treeId}`);
  };

  const handleCreateTree = async () => {
    if (!user) {
      const ok = await handleRequireAuth();
      if (!ok) return;
      return;
    }
    setCreating(true);
    setError('');
    try {
      const newTree = await Trees.create('My Family Tree', user.uid);

      try {
        await Members.create({
          treeId: newTree.id,
          name: user.displayName || 'Self',
          nickname: '',
          gender: 'unknown',
          position: { x: 0, y: 0 },
          archived: false,
        });
      } catch (seedErr) {
        console.error('Error seeding initial member for new tree:', seedErr);
      }

      navigate(`/builder?treeId=${newTree.id}`);
    } catch (err) {
      console.error('Error creating tree:', err);
      setError(err.message || 'Failed to create tree');
    } finally {
      setCreating(false);
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Your Family Trees</h1>
            <p className="text-sm text-gray-500">Select a tree to continue or create a new one.</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Back to Home
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {trees.length > 0 ? (
          <ul className="space-y-2 mb-6">
            {trees.map(tree => (
              <li
                key={tree.id}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleOpenTree(tree.id)}
              >
                <div>
                  <div className="text-sm font-medium text-gray-800">{tree.title || 'Untitled Tree'}</div>
                  <div className="text-xs text-gray-500">ID: {tree.id}</div>
                </div>
                <span className="text-xs text-blue-600 font-semibold">Open</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-6 text-sm text-gray-600">
            You don't have any trees yet. Create your first tree to get started.
          </div>
        )}

        <button
          onClick={handleCreateTree}
          disabled={creating}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md text-sm font-semibold shadow-sm"
        >
          {creating ? 'Creating tree...' : 'Create New Tree'}
        </button>
      </div>
    </div>
  );
}
