/**
 * InvitationLandingPage
 * Shown when a user follows a WhatsApp invitation link: /invite/:invitationId
 *
 * - Reads the invitation from Firestore
 * - If valid/pending → show tree name + sender + Sign In / Create Account buttons
 * - If already claimed or expired → show friendly message
 * - If authenticated → call claimInvitation callable and redirect to the tree
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const BASE_APP_URL = 'https://hamropanchanga.com';

export default function InvitationLandingPage() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [invitation, setInvitation] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'valid' | 'invalid' | 'claiming' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // ── Load invitation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!invitationId) {
      setLoadState('invalid');
      return;
    }

    const load = async () => {
      try {
        const ref = doc(db, 'invitations', invitationId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setLoadState('invalid');
          setErrorMsg('This invitation link is invalid or has been removed.');
          return;
        }

        const data = snap.data();

        if (data.status === 'claimed') {
          setLoadState('invalid');
          setErrorMsg('This invitation has already been claimed.');
          return;
        }

        if (data.status === 'expired') {
          setLoadState('invalid');
          setErrorMsg('This invitation has expired. Please ask the tree owner to share it again.');
          return;
        }

        const expiresAt = data.expiresAt?.toDate?.();
        if (expiresAt && expiresAt < new Date()) {
          setLoadState('invalid');
          setErrorMsg('This invitation has expired. Please ask the tree owner to share it again.');
          return;
        }

        setInvitation(data);
        setLoadState('valid');
      } catch (err) {
        console.error('[InvitationLandingPage] Error loading invitation:', err);
        setLoadState('error');
        setErrorMsg('Failed to load the invitation. Please try again.');
      }
    };

    load();
  }, [invitationId]);

  // ── Auto-claim if already signed in ───────────────────────────────────────
  useEffect(() => {
    if (user && loadState === 'valid' && invitation) {
      const claim = async () => {
        setLoadState('claiming');
        try {
          const fn = httpsCallable(getFunctions(), 'claimInvitation');
          const result = await fn({ invitationId });
          const { treeId } = result.data;
          navigate(`/tree/${treeId}`, { replace: true });
        } catch (err) {
          console.error('[InvitationLandingPage] Claim error:', err);
          setLoadState('error');
          setErrorMsg(err.message || 'Failed to claim the invitation.');
        }
      };
      claim();
    }
  }, [user, loadState, invitation, invitationId, navigate]);

  // ── Redirect helpers for unauthenticated users ─────────────────────────────
  const goToLogin = () => {
    navigate('/login', {
      state: { from: `/invite/${invitationId}`, invitationId },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">

        {/* Loading */}
        {loadState === 'loading' && (
          <>
            <div className="text-5xl mb-4">🌳</div>
            <p className="text-gray-500 text-sm">Loading invitation…</p>
          </>
        )}

        {/* Claiming */}
        {loadState === 'claiming' && (
          <>
            <div className="text-5xl mb-4">🌳</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Joining your family tree…</h1>
            <p className="text-gray-500 text-sm">Please wait while we set up your access.</p>
          </>
        )}

        {/* Invalid / expired */}
        {loadState === 'invalid' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Invitation Unavailable</h1>
            <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Go to Home
            </button>
          </>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something Went Wrong</h1>
            <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Try Again
            </button>
          </>
        )}

        {/* Valid — unauthenticated user */}
        {loadState === 'valid' && !user && invitation && (
          <>
            <div className="text-5xl mb-4">🌳</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">You're Invited!</h1>
            <p className="text-gray-600 mb-1">
              <span className="font-semibold">{invitation.fromEmail}</span> has shared a family tree with you:
            </p>
            <p className="text-lg font-semibold text-green-700 mb-6">
              "{invitation.treeTitle || 'Family Tree'}"
            </p>

            <div className="bg-green-50 rounded-lg p-4 mb-6 text-left text-sm text-gray-600">
              <p>Sign in or create an account to view and explore the family tree.</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={goToLogin}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={goToLogin}
                className="w-full px-6 py-3 border border-green-600 text-green-700 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Create Account
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              This invitation expires in 30 days.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
