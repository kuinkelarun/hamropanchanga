import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAllRequests } from '../../services/apiKeyRequestService';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdminApiKeyRequestsTab({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // requestId being acted on
  const [rejectModal, setRejectModal] = useState(null);   // { id } or null
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await getAllRequests();
      setRequests(all);
    } catch (err) {
      console.error('Failed to load API key requests:', err);
      setError('Failed to load requests. Make sure Firestore indexes are deployed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (requestId) => {
    setActionLoading(requestId);
    try {
      const fns = getFunctions();
      const approve = httpsCallable(fns, 'approveApiKeyRequest');
      await approve({ requestId });
      await load();
    } catch (err) {
      console.error('Approval failed:', err);
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (requestId) => {
    if (!window.confirm('Regenerate this API key? The old key will stop working immediately and the user will need to copy their new key.')) return;
    setActionLoading(requestId);
    try {
      const fns = getFunctions();
      const regen = httpsCallable(fns, 'regenerateApiKey');
      await regen({ requestId });
      await load();
    } catch (err) {
      console.error('Regeneration failed:', err);
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const fns = getFunctions();
      const reject = httpsCallable(fns, 'rejectApiKeyRequest');
      await reject({ requestId: rejectModal.id, rejectionReason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      await load();
    } catch (err) {
      console.error('Rejection failed:', err);
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const pending = requests.filter(r => r.status === 'pending');
  const rest = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">API Key Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pending.length} pending review</p>
        </div>
        <button
          onClick={load}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {requests.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-sm">No API key requests yet.</p>
        </div>
      )}

      {/* Pending requests first */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Pending</h3>
          <div className="space-y-3">
            {pending.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                formatDate={formatDate}
                actionLoading={actionLoading}
                onApprove={handleApprove}
                onReject={(id) => { setRejectModal({ id }); setRejectReason(''); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Processed requests */}
      {rest.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Processed</h3>
          <div className="space-y-3">
            {rest.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                formatDate={formatDate}
                actionLoading={actionLoading}
                onApprove={handleApprove}
                onReject={(id) => { setRejectModal({ id }); setRejectReason(''); }}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reject Request</h3>
            <p className="text-sm text-gray-600 mb-4">Optionally provide a reason (visible to the user):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient use case description..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!!actionLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, formatDate, actionLoading, onApprove, onReject, onRegenerate }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-gray-900 text-sm">{req.name || '—'}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
              {req.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">{req.email}</p>
          {req.useCase && (
            <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded p-2">{req.useCase}</p>
          )}
          {req.website && (
            <a href={req.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline mt-1 block truncate">{req.website}</a>
          )}
          {req.rejectionReason && (
            <p className="text-xs text-red-600 mt-1">Reason: {req.rejectionReason}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">Submitted: {formatDate(req.createdAt)}</p>
          {req.reviewedAt && (
            <p className="text-xs text-gray-400">Reviewed: {formatDate(req.reviewedAt)}</p>
          )}
          {req.regeneratedAt && (
            <p className="text-xs text-amber-600 mt-1">🔄 Key regenerated: {formatDate(req.regeneratedAt)}</p>
          )}
        </div>

        {req.status === 'approved' && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onRegenerate(req.id)}
              disabled={actionLoading === req.id}
              className="px-4 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading === req.id ? '...' : '🔄 Regenerate'}
            </button>
          </div>
        )}

        {req.status === 'pending' && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onApprove(req.id)}
              disabled={actionLoading === req.id}
              className="px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === req.id ? '...' : 'Approve'}
            </button>
            <button
              onClick={() => onReject(req.id)}
              disabled={!!actionLoading}
              className="px-4 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
