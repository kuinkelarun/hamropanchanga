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

/**
 * Streams chat over SSE. Calls onToolCall({ name, input }) for each live
 * tool_call event, then resolves with the final { reply, toolCalls, provider, model }.
 */
export async function streamChatMessage(messages, { signal, onToolCall } = {}) {
  const token = await getIdToken();
  const res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    const code = data?.error || `http_${res.status}`;
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    throw new ChatBackendError(message, { status: res.status, code });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames from buffer
    const frames = buffer.split('\n\n');
    buffer = frames.pop(); // keep incomplete trailing frame

    for (const frame of frames) {
      let eventType = 'message';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
      }
      if (!dataLine) continue;
      let payload;
      try { payload = JSON.parse(dataLine); } catch { continue; }

      if (eventType === 'tool_call' && onToolCall) {
        onToolCall(payload);
      } else if (eventType === 'done') {
        return payload;
      } else if (eventType === 'error') {
        throw new ChatBackendError(payload.message || 'Stream error', { code: 'stream_error' });
      }
    }
  }

  throw new ChatBackendError('Stream ended without a done event', { code: 'stream_incomplete' });
}

export { ChatBackendError, BACKEND_URL };
