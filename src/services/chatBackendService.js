import { auth } from '../firebase';

const BACKEND_URL = (
  process.env.REACT_APP_CHAT_BACKEND_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

class ChatBackendError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ChatBackendError';
    this.status = status;
    this.code = code;
  }
}

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new ChatBackendError('Not signed in', { code: 'not_signed_in' });
  return user.getIdToken();
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = await getIdToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const code = data?.error || data?.code || `http_${res.status}`;
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    throw new ChatBackendError(message, { status: res.status, code });
  }

  return data;
}

export function getLlmConfig() {
  return request('/api/llm-config');
}

export function saveLlmConfig(config) {
  return request('/api/llm-config', { method: 'PUT', body: config });
}

export function deleteLlmConfig() {
  return request('/api/llm-config', { method: 'DELETE' });
}

export function testLlmConfig() {
  return request('/api/llm-config/test', { method: 'POST' });
}

export function sendChatMessage(messages, { signal } = {}) {
  return request('/api/chat', { method: 'POST', body: { messages }, signal });
}

export { ChatBackendError, BACKEND_URL };
