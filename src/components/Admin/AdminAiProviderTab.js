import React, { useCallback, useEffect, useState } from 'react';
import {
  ChatBackendError,
  deleteAdminLlmConfig,
  getAdminLlmConfig,
  saveAdminLlmConfig,
  testAdminLlmConfig,
  toggleAdminLlmConfig,
} from '../../services/chatBackendService';

const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-7';
const BEDROCK_DEFAULT_MODEL = 'anthropic.claude-opus-4-v1:0';

export default function AdminAiProviderTab() {
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
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminLlmConfig();
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
    loadConfig();
  }, [loadConfig]);

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
      body = { provider: 'anthropic', anthropic: { apiKey: anthropicKey, model: anthropicModel || ANTHROPIC_DEFAULT_MODEL } };
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
      const updated = await saveAdminLlmConfig(body);
      // Auto-enable after save so the key is immediately active
      if (!updated.enabled) {
        await toggleAdminLlmConfig(true);
        updated.enabled = true;
      }
      setConfig(updated);
      setSaveSuccess(true);
      setMode('view');
      resetForms();
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
      const result = await testAdminLlmConfig();
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove the shared AI provider configuration? All users relying on it will lose chat access until you reconfigure.')) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAdminLlmConfig();
      setConfig({ configured: false });
      setMode('edit');
      resetForms();
    } catch (err) {
      setError(err.message || 'Failed to delete configuration');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    if (!config?.configured) return;
    const newEnabled = !config.enabled;
    setToggling(true);
    setError(null);
    try {
      await toggleAdminLlmConfig(newEnabled);
      setConfig((prev) => ({ ...prev, enabled: newEnabled }));
    } catch (err) {
      setError(err.message || 'Failed to toggle shared AI');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500 py-6">Loading configuration…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Shared AI Provider</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure an AI key on behalf of all users. Users with their own key always use their own — this is a fallback for everyone else.
        </p>
      </div>

      {/* Enable / Disable banner */}
      {config?.configured && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
            config.enabled
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div>
            {config.enabled ? (
              <p className="text-sm font-medium text-green-800">
                Shared AI is <strong>active</strong> — all users without their own key can chat now.
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-700">
                Shared AI is <strong>disabled</strong> — only users with their own key can chat.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">Users with their own API key always use their own.</p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className={`ml-4 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              config.enabled
                ? 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                : 'border-green-400 text-green-700 bg-white hover:bg-green-50'
            }`}
          >
            {toggling ? '…' : config.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {config?.configured && mode === 'view' && (
        <AdminConfiguredView
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
                id="admin-anthropic"
                label="Anthropic API"
                sublabel="Use your Anthropic API key directly"
                checked={provider === 'anthropic'}
                onChange={() => setProvider('anthropic')}
              />
              <ProviderRadio
                id="admin-bedrock"
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
    </div>
  );
}

function AdminConfiguredView({ config, onEdit, onTest, onDelete, testing, deleting, testResult, saveSuccess }) {
  const { provider } = config;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {saveSuccess && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Configuration saved.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
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
          type="button"
          onClick={onTest}
          disabled={testing}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Change key
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
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
      <input id={id} type="radio" checked={checked} onChange={onChange} className="sr-only" />
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
      <Field label="API key" hint="Get one at console.anthropic.com → API Keys. Starts with sk-ant-…">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          className="input-text-admin"
        />
      </Field>
      <Field label="Model" hint={`Default: ${ANTHROPIC_DEFAULT_MODEL}`}>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={ANTHROPIC_DEFAULT_MODEL}
          className="input-text-admin"
        />
      </Field>
    </div>
  );
}

function BedrockFields({ region, setRegion, accessKeyId, setAccessKeyId, secretKey, setSecretKey, sessionToken, setSessionToken, model, setModel }) {
  return (
    <div className="space-y-4">
      <Field label="AWS region">
        <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1" className="input-text-admin" />
      </Field>
      <Field label="Access key ID">
        <input type="text" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="AKIA…" autoComplete="off" className="input-text-admin" />
      </Field>
      <Field label="Secret access key">
        <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} autoComplete="off" className="input-text-admin" />
      </Field>
      <Field label="Session token (optional)" hint="Only if you're using temporary STS credentials.">
        <input type="password" value={sessionToken} onChange={(e) => setSessionToken(e.target.value)} autoComplete="off" className="input-text-admin" />
      </Field>
      <Field label="Model" hint={`Default: ${BEDROCK_DEFAULT_MODEL}`}>
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder={BEDROCK_DEFAULT_MODEL} className="input-text-admin" />
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
        .input-text-admin {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
        }
        .input-text-admin:focus {
          outline: none;
          border-color: #111827;
          box-shadow: 0 0 0 1px #111827;
        }
      `}</style>
    </div>
  );
}
