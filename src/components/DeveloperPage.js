import React, { useState, useEffect, useCallback } from 'react';
import { signInWithGoogle } from '../firebase';
import { submitApiKeyRequest, getMyRequest, acknowledgeKey } from '../services/apiKeyRequestService';

const API_BASE = 'https://us-central1-hamropanchanga.cloudfunctions.net/api';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/v1/health',
    auth: false,
    description: 'Check API availability. No key required.',
    curl: `curl "${API_BASE}/v1/health"`,
    response: `{ "status": "ok", "version": "v1", "timestamp": "2026-02-23T..." }`,
  },
  {
    method: 'GET',
    path: '/v1/tithi/today',
    auth: true,
    description: 'Get the current tithi (from server clock, UTC).',
    curl: `curl "${API_BASE}/v1/tithi/today" \\\n  -H "X-API-Key: npcal_your_key_here"`,
    response: `{
  "date": "2026-02-23",
  "sunLon": 310.4,
  "moonLon": 47.2,
  "tithi": 10,
  "paksha": "Shukla",
  "tithiName": "Dashami",
  "tithiStart": "2026-02-22T18:30:00.000Z",
  "tithiEnd": "2026-02-23T20:15:00.000Z"
}`,
  },
  {
    method: 'GET',
    path: '/v1/calendar/:bsYear/:bsMonth',
    auth: true,
    description: 'Full Nepali calendar month data. bsYear: 2078–2090, bsMonth: 1–12.',
    curl: `curl "${API_BASE}/v1/calendar/2082/1" \\\n  -H "X-API-Key: npcal_your_key_here"`,
    response: `{
  "bsYear": 2082,
  "bsMonth": 1,
  "days": [ { "bsDay": 1, "adDate": "2025-04-14", "tithi": 2, ... }, ... ],
  "metadata": { "monthName": "Baisakh", "totalDays": 31 }
}`,
  },
  {
    method: 'GET',
    path: '/v1/tithis?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD',
    auth: true,
    description: 'List all tithis in an AD date range (max 366 days).',
    curl: `curl "${API_BASE}/v1/tithis?startDate=2025-04-01&endDate=2025-04-30" \\\n  -H "X-API-Key: npcal_your_key_here"`,
    response: `{
  "count": 30,
  "tithis": [ { "id": "...", "bsDate": "2082-01-01", "tithi": 2, "paksha": "Shukla", ... }, ... ]
}`,
  },
  {
    method: 'GET',
    path: '/v1/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD',
    auth: true,
    description: 'List public calendar events in an AD date range (max 366 days).',
    curl: `curl "${API_BASE}/v1/events?startDate=2025-04-01&endDate=2025-04-30" \\\n  -H "X-API-Key: npcal_your_key_here"`,
    response: `{
  "count": 5,
  "events": [ { "id": "...", "title": "Nepali New Year", "dateKey": "2082-01-01", ... }, ... ]
}`,
  },
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-green-100 text-green-800',
    POST: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
      {method}
    </span>
  );
}

// ── Key Status Panel (top-level component to prevent remount on parent re-render) ──
function KeyPanel({
  user,
  loadingRequest,
  request,
  form,
  setForm,
  formError,
  submitting,
  copyKeyDone,
  acknowledging,
  onSubmit,
  onCopyKey,
  onAcknowledge,
  onResetRequest,
}) {
  if (!user) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in to Request an API Key</h3>
        <p className="text-sm text-gray-500 mb-4">Create a free account to get started with the HamroPanchanga API.</p>
        <button
          onClick={async () => { try { await signInWithGoogle(); } catch (_) {} }}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (loadingRequest) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Request a Free API Key</h3>
        <p className="text-sm text-gray-500 mb-5">Free plan: 1,000 requests/day. We'll review your request and send your key within 24 hours.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={user.displayName || ''}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Use Case <span className="text-red-500">*</span></label>
            <textarea
              value={form.useCase}
              onChange={(e) => setForm(f => ({ ...f, useCase: e.target.value }))}
              placeholder="e.g. Building a Nepali calendar app, research project, personal website..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website / Project URL</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://yourapp.com (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    );
  }

  if (request.status === 'pending') {
    return (
      <div className="bg-white rounded-xl border border-amber-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Request Under Review</h3>
            <p className="text-sm text-gray-600 mt-1">
              Your API key request has been received and is being reviewed. You'll be able to see your key here once it's approved — usually within 24 hours.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Submitted for: <span className="font-medium text-gray-600">{request.email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (request.status === 'approved' && !request.rawKeyAcknowledged) {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-green-900">API Key Approved!</h3>
        </div>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <strong>⚠ Copy your key now.</strong> For security, it will be masked after you acknowledge it and cannot be retrieved again.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4 font-mono text-sm break-all">
          <span className="flex-1 text-gray-900">{request.rawKey}</span>
          <button
            onClick={onCopyKey}
            className="ml-2 flex-shrink-0 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
          >
            {copyKeyDone ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="bg-gray-100 rounded p-2 mb-4 overflow-x-auto">
          <p className="text-xs text-gray-500 mb-1">Send this header with every request:</p>
          <code className="text-xs font-mono break-all">X-API-Key: {request.rawKey}</code>
        </div>
        <button
          onClick={onAcknowledge}
          disabled={acknowledging}
          className="w-full border-2 border-green-600 text-green-700 py-2 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50 transition-colors"
        >
          {acknowledging ? 'Saving...' : 'I have saved my key — Continue'}
        </button>
      </div>
    );
  }

  if (request.status === 'approved' && request.rawKeyAcknowledged) {
    const maskedKey = (request.rawKey || '').replace(/(?<=npcal_...).+/, '*'.repeat(16));
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Your API Key</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active · Free Plan</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3 font-mono text-sm">
          <span className="flex-1 text-gray-500">{maskedKey}</span>
        </div>
        <p className="text-xs text-gray-500">Rate limit: <strong>1,000 requests / day</strong>. The key is masked for security; you cannot retrieve the original value.</p>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Need a higher limit? Contact us at <a href="mailto:hamropanchanga@gmail.com" className="text-indigo-600 hover:underline">hamropanchanga@gmail.com</a></p>
        </div>
      </div>
    );
  }

  if (request.status === 'rejected') {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Request Not Approved</h3>
            {request.rejectionReason && (
              <p className="text-sm text-gray-600 mt-1">{request.rejectionReason}</p>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">You may submit a new request with more information about your use case.</p>
        <button
          onClick={onResetRequest}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Submit New Request
        </button>
      </div>
    );
  }

  return null;
}

export default function DeveloperPage({ user, isAdmin }) {
  const [request, setRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', useCase: '', website: '' });
  const [formError, setFormError] = useState('');
  const [copyKeyDone, setCopyKeyDone] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!user) return;
    setLoadingRequest(true);
    try {
      const r = await getMyRequest(user.uid);
      setRequest(r);
    } catch (err) {
      console.error('Failed to load API key request:', err);
    } finally {
      setLoadingRequest(false);
    }
  }, [user]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.useCase.trim()) {
      setFormError('Please describe your use case.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      await submitApiKeyRequest(user, form);
      await loadRequest();
    } catch (err) {
      console.error('Failed to submit:', err);
      setFormError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (!request?.rawKey) return;
    navigator.clipboard.writeText(request.rawKey).then(() => setCopyKeyDone(true));
  };

  const handleAcknowledge = async () => {
    if (!request?.id) return;
    setAcknowledging(true);
    try {
      await acknowledgeKey(request.id);
      await loadRequest();
    } catch (err) {
      console.error('Acknowledge failed:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-sm text-gray-500">Nepali Calendar &amp; Tithi data for your applications</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {['REST', 'JSON', 'Free Plan', 'API Key Auth'].map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Docs */}
        <div className="lg:col-span-2 space-y-8">

          {/* Quick Start */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
            <p className="text-sm text-gray-600 mb-3">
              Base URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{API_BASE}</code>
            </p>
            <p className="text-sm text-gray-600 mb-4">Authenticate with the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">X-API-Key</code> header:</p>
            <CodeBlock code={`curl "${API_BASE}/v1/tithi/today" \\
  -H "X-API-Key: npcal_your_key_here"`} />
          </section>

          {/* Endpoints */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Endpoints</h2>
            <div className="space-y-6">
              {ENDPOINTS.map((ep) => (
                <div key={ep.path} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MethodBadge method={ep.method} />
                    <code className="text-sm font-mono text-gray-800">{ep.path}</code>
                    {!ep.auth && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">no auth</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{ep.description}</p>
                  <details className="group">
                    <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-800 select-none">
                      Show example
                    </summary>
                    <div className="mt-2 space-y-2">
                      {ep.curl && <CodeBlock code={ep.curl} />}
                      <CodeBlock code={ep.response} />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>

          {/* Authentication */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication</h2>
            <p className="text-sm text-gray-600 mb-4">
              Include your API key in the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">X-API-Key</code> header for every authenticated request. Keys are prefixed <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">npcal_</code>.
            </p>
            <div className="space-y-3">
              {[
                { code: 401, label: 'Unauthorized', desc: 'Missing or invalid API key' },
                { code: 429, label: 'Too Many Requests', desc: 'Daily rate limit exceeded (resets at 00:00 UTC)' },
                { code: 400, label: 'Bad Request', desc: 'Invalid parameters (e.g. date range > 366 days)' },
              ].map(e => (
                <div key={e.code} className="flex items-start gap-3 text-sm">
                  <span className="font-mono font-bold text-gray-700 w-8 flex-shrink-0">{e.code}</span>
                  <span className="text-gray-500"><strong className="text-gray-700">{e.label}</strong> — {e.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Rate Limits */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-600 font-medium">Plan</th>
                    <th className="text-left py-2 text-gray-600 font-medium">Requests / day</th>
                    <th className="text-left py-2 text-gray-600 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 text-gray-800 font-medium">Free</td>
                    <td className="py-2 text-gray-600">1,000</td>
                    <td className="py-2 text-gray-600">Free forever</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right: Key Panel */}
        <div className="space-y-4">
          <KeyPanel
            user={user}
            loadingRequest={loadingRequest}
            request={request}
            form={form}
            setForm={setForm}
            formError={formError}
            submitting={submitting}
            copyKeyDone={copyKeyDone}
            acknowledging={acknowledging}
            onSubmit={handleSubmit}
            onCopyKey={handleCopyKey}
            onAcknowledge={handleAcknowledge}
            onResetRequest={() => setRequest(null)}
          />

          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">Using an AI coding tool?</h4>
            <p className="text-xs text-indigo-700 mb-2">
              Connect Claude Desktop, VS Code Copilot, or Codex CLI directly to HamroPanchanga via MCP.
            </p>
            <a href="/mcp" className="text-xs font-medium text-indigo-600 hover:underline">
              MCP Setup →
            </a>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Support</h4>
            <p className="text-xs text-gray-500">
              Questions or issues? Email{' '}
              <a href="mailto:hamropanchanga@gmail.com" className="text-indigo-600 hover:underline">
                hamropanchanga@gmail.com
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
