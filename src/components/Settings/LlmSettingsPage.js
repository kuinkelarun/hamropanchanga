import React, { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ChatBackendError,
  deleteLlmConfig,
  getLlmConfig,
  saveLlmConfig,
  testLlmConfig,
} from '../../services/chatBackendService';
import UserGroupsSection from './UserGroupsSection';
import ContactsSection from './ContactsSection';

const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-7';
const BEDROCK_DEFAULT_MODEL = 'anthropic.claude-opus-4-v1:0';

const VALID_TABS = ['whatsapp', 'contacts', 'groups', 'ai-provider'];

export default function LlmSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refreshConfig } = useChat();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { tab } = useParams();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [provider, setProvider] = useState('anthropic');

  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState(ANTHROPIC_DEFAULT_MODEL);

  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');
  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('');
  const [bedrockSecretKey, setBedrockSecretKey] = useState('');
  const [bedrockSessionToken, setBedrockSessionToken] = useState('');
  const [bedrockModel, setBedrockModel] = useState(BEDROCK_DEFAULT_MODEL);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const activeTab = VALID_TABS.includes(tab) ? tab : 'whatsapp';
  const setActiveTab = (newTab) => navigate(`/settings/${newTab}`, { replace: true });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLlmConfig();
      setConfig(data);
      if (data?.configured) {
        setProvider(data.provider);
        setMode('view');
        if (data.provider === 'anthropic') {
          setAnthropicModel(data.anthropic?.model || ANTHROPIC_DEFAULT_MODEL);
        } else if (data.provider === 'bedrock') {
          setBedrockRegion(data.bedrock?.awsRegion || 'us-east-1');
          setBedrockModel(data.bedrock?.model || BEDROCK_DEFAULT_MODEL);
        }
      } else {
        setMode('edit');
      }
    } catch (err) {
      setError(err.message || 'Failed to load configuration');
      setMode('edit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadConfig();
  }, [authLoading, user, loadConfig]);

  const resetForms = () => {
    setAnthropicKey('');
    setBedrockAccessKeyId('');
    setBedrockSecretKey('');
    setBedrockSessionToken('');
    setError(null);
    setTestResult(null);
    setSaveSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setTestResult(null);
    setSaveSuccess(false);

    let body;
    if (provider === 'anthropic') {
      if (!anthropicKey || anthropicKey.length < 10) {
        setError('Anthropic API key is required.');
        return;
      }
      body = {
        provider: 'anthropic',
        anthropic: {
          apiKey: anthropicKey,
          model: anthropicModel || ANTHROPIC_DEFAULT_MODEL,
        },
      };
    } else {
      if (!bedrockRegion || !bedrockAccessKeyId || !bedrockSecretKey) {
        setError('AWS region, access key ID, and secret key are required.');
        return;
      }
      body = {
        provider: 'bedrock',
        bedrock: {
          awsRegion: bedrockRegion,
          accessKeyId: bedrockAccessKeyId,
          secretAccessKey: bedrockSecretKey,
          sessionToken: bedrockSessionToken || undefined,
          model: bedrockModel || BEDROCK_DEFAULT_MODEL,
        },
      };
    }

    setSaving(true);
    try {
      const updated = await saveLlmConfig(body);
      setConfig(updated);
      setSaveSuccess(true);
      setMode('view');
      resetForms();
      await refreshConfig();
    } catch (err) {
      if (err instanceof ChatBackendError && err.code === 'invalid_config') {
        setError('Invalid configuration — check the fields and try again.');
      } else {
        setError(err.message || 'Failed to save configuration');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLlmConfig();
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove your saved AI provider configuration? You will need to re-enter credentials to chat again.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteLlmConfig();
      setConfig({ configured: false });
      setMode('edit');
      resetForms();
      await refreshConfig();
    } catch (err) {
      setError(err.message || 'Failed to delete configuration');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Settings</h1>
        <p className="text-gray-600">Sign in to configure your settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabButton
          label="WhatsApp Notifications"
          active={activeTab === 'whatsapp'}
          onClick={() => setActiveTab('whatsapp')}
        />
        <TabButton
          label={t('contacts.tabLabel')}
          active={activeTab === 'contacts'}
          onClick={() => setActiveTab('contacts')}
        />
        <TabButton
          label={t('userGroups.tabLabel')}
          active={activeTab === 'groups'}
          onClick={() => setActiveTab('groups')}
        />
        <TabButton
          label="AI Provider"
          active={activeTab === 'ai-provider'}
          onClick={() => setActiveTab('ai-provider')}
        />
      </div>

      {/* Tab: WhatsApp Notifications */}
      {activeTab === 'whatsapp' && (
        <WhatsAppSection uid={user.uid} />
      )}

      {/* Tab: Contacts */}
      {activeTab === 'contacts' && (
        <ContactsSection uid={user.uid} />
      )}

      {/* Tab: Contact Groups */}
      {activeTab === 'groups' && (
        <UserGroupsSection uid={user.uid} />
      )}

      {/* Tab: AI Provider */}
      {activeTab === 'ai-provider' && (
        <>
          <p className="text-sm text-gray-500 mb-5">
            Bring your own API key. Credentials are encrypted on the server and never shared with other users.
          </p>
          {loading ? (
            <div className="text-gray-500">Loading configuration…</div>
          ) : (
            <>
              {error && mode !== 'edit' && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  {error}
                </div>
              )}
              {config?.configured && mode === 'view' && (
                <ConfiguredView
                  config={config}
                  onEdit={() => { setMode('edit'); setSaveSuccess(false); setTestResult(null); }}
                  onTest={handleTest}
                  onDelete={handleDelete}
                  testing={testing}
                  deleting={deleting}
                  testResult={testResult}
                  saveSuccess={saveSuccess}
                />
              )}

              {mode === 'edit' && (
                <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                    <div className="flex gap-3">
                      <ProviderRadio
                        id="anthropic"
                        label="Anthropic API"
                        sublabel="Use your Anthropic API key directly"
                        checked={provider === 'anthropic'}
                        onChange={() => setProvider('anthropic')}
                      />
                      <ProviderRadio
                        id="bedrock"
                        label="AWS Bedrock"
                        sublabel="Use Claude via your AWS account"
                        checked={provider === 'bedrock'}
                        onChange={() => setProvider('bedrock')}
                      />
                    </div>
                  </div>

                  {provider === 'anthropic' ? (
                    <AnthropicFields
                      apiKey={anthropicKey}
                      setApiKey={setAnthropicKey}
                      model={anthropicModel}
                      setModel={setAnthropicModel}
                    />
                  ) : (
                    <BedrockFields
                      region={bedrockRegion}
                      setRegion={setBedrockRegion}
                      accessKeyId={bedrockAccessKeyId}
                      setAccessKeyId={setBedrockAccessKeyId}
                      secretKey={bedrockSecretKey}
                      setSecretKey={setBedrockSecretKey}
                      sessionToken={bedrockSessionToken}
                      setSessionToken={setBedrockSessionToken}
                      model={bedrockModel}
                      setModel={setBedrockModel}
                    />
                  )}

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    {config?.configured && (
                      <button
                        type="button"
                        onClick={() => { setMode('view'); resetForms(); }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function ProviderRadio({ id, label, sublabel, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 transition-all ${
        checked ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checked ? 'border-gray-900' : 'border-gray-300'}`}>
          {checked && <div className="w-2 h-2 rounded-full bg-gray-900" />}
        </div>
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1 ml-6">{sublabel}</div>
    </label>
  );
}

function AnthropicFields({ apiKey, setApiKey, model, setModel }) {
  return (
    <div className="space-y-4">
      <Field
        label="API key"
        hint="Get one at console.anthropic.com → API Keys. Starts with sk-ant-…"
      >
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          className="input-text"
        />
      </Field>
      <Field label="Model" hint="Default: claude-opus-4-7">
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={ANTHROPIC_DEFAULT_MODEL}
          className="input-text"
        />
      </Field>
    </div>
  );
}

function BedrockFields({
  region, setRegion,
  accessKeyId, setAccessKeyId,
  secretKey, setSecretKey,
  sessionToken, setSessionToken,
  model, setModel,
}) {
  return (
    <div className="space-y-4">
      <Field label="AWS region">
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="us-east-1"
          className="input-text"
        />
      </Field>
      <Field label="Access key ID">
        <input
          type="text"
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          placeholder="AKIA…"
          autoComplete="off"
          className="input-text"
        />
      </Field>
      <Field label="Secret access key">
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          autoComplete="off"
          className="input-text"
        />
      </Field>
      <Field label="Session token (optional)" hint="Only if you're using temporary STS credentials.">
        <input
          type="password"
          value={sessionToken}
          onChange={(e) => setSessionToken(e.target.value)}
          autoComplete="off"
          className="input-text"
        />
      </Field>
      <Field label="Model" hint="Default: anthropic.claude-opus-4-v1:0">
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={BEDROCK_DEFAULT_MODEL}
          className="input-text"
        />
      </Field>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
      <style>{`
        .input-text {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
        }
        .input-text:focus {
          outline: none;
          border-color: #111827;
          box-shadow: 0 0 0 1px #111827;
        }
      `}</style>
    </div>
  );
}

function ConfiguredView({ config, onEdit, onTest, onDelete, testing, deleting, testResult, saveSuccess }) {
  const { provider } = config;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {saveSuccess && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Configuration saved.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-900">
          {provider === 'anthropic' ? 'Anthropic API' : 'AWS Bedrock'} configured
        </span>
      </div>

      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
        {provider === 'anthropic' && (
          <>
            <dt className="text-gray-500">Model</dt>
            <dd className="text-gray-900">{config.anthropic?.model}</dd>
            <dt className="text-gray-500">API key</dt>
            <dd className="text-gray-900 font-mono">•••• {config.anthropic?.apiKeyLast4}</dd>
          </>
        )}
        {provider === 'bedrock' && (
          <>
            <dt className="text-gray-500">Region</dt>
            <dd className="text-gray-900">{config.bedrock?.awsRegion}</dd>
            <dt className="text-gray-500">Model</dt>
            <dd className="text-gray-900">{config.bedrock?.model}</dd>
            <dt className="text-gray-500">Access key</dt>
            <dd className="text-gray-900 font-mono">•••• {config.bedrock?.accessKeyLast4}</dd>
            {config.bedrock?.hasSessionToken && (
              <>
                <dt className="text-gray-500">Session token</dt>
                <dd className="text-gray-900">On file</dd>
              </>
            )}
          </>
        )}
      </dl>

      {testResult && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            testResult.ok
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {testResult.ok
            ? `Connection OK — ${testResult.provider} (${testResult.model})`
            : `Test failed: ${testResult.error}`}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
        >
          Edit / replace
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 ml-auto"
        >
          {deleting ? 'Removing…' : 'Remove configuration'}
        </button>
      </div>
    </div>
  );
}

// ─── WhatsApp Notifications section ──────────────────────────────────────────

function WhatsAppSection({ uid }) {
  const { setNeedsPhone } = useAuth();
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [optIn, setOptIn] = useState(true);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          setPhone(data.phoneNumber || '');
          setOptIn(data.whatsAppOptIn !== false);
        }
      } catch (_) {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const handleSave = async () => {
    if (phone && !isValidPhoneNumber(phone)) {
      setError('Enter a valid phone number including country code, or leave blank to remove.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', uid), {
        phoneNumber: phone || null,
        whatsAppOptIn: phone ? optIn : false,
        phoneAddedAt: phone ? new Date().toISOString() : null,
      });
      // Update the needsPhone banner in the header via AuthContext setter
      setNeedsPhone(!phone);
      setMode('view');
    } catch (err) {
      console.error('Failed to update phone number:', err);
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-sm text-gray-500 mb-4">
        Receive event reminders and tree-sharing alerts via WhatsApp.
        Messages are sent only to you and only for events you have access to.
      </p>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : mode === 'view' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
          <div>
            {phone ? (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-900">Notifications active</span>
                </div>
                <p className="text-sm text-gray-500">{phone} · {optIn ? 'Reminders on' : 'Reminders off'}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-sm font-medium text-gray-900">No WhatsApp number set</span>
                </div>
                <p className="text-sm text-gray-500">Add a number to receive event reminders.</p>
              </>
            )}
          </div>
          <button
            onClick={() => setMode('edit')}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 whitespace-nowrap"
          >
            {phone ? 'Edit' : 'Add number'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              WhatsApp Number
            </label>
            <div className={`phone-input-wrapper rounded-lg border ${error ? 'border-red-400' : 'border-gray-300'} focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors`}>
              <PhoneInput
                international
                countryCallingCodeEditable={false}
                defaultCountry="NP"
                value={phone}
                onChange={(val) => { setPhone(val || ''); setError(''); }}
              />
            </div>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <p className="mt-1 text-xs text-gray-400">Leave blank to remove your number.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-green-500 peer-checked:border-green-500 transition-colors flex items-center justify-center">
                {optIn && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-700">Send me WhatsApp reminders for events I've added</span>
          </label>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setMode('view'); setError(''); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
