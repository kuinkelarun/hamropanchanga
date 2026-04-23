import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  ChatBackendError,
  getLlmConfig,
  sendChatMessage,
} from '../services/chatBackendService';

const ChatContext = createContext(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatProvider({ children }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  // LLM config state: 'unknown' (never checked), 'configured', 'unconfigured', 'error'
  const [configStatus, setConfigStatus] = useState('unknown');
  const [configInfo, setConfigInfo] = useState(null);

  const abortRef = useRef(null);

  const checkConfig = useCallback(async () => {
    if (!user) {
      setConfigStatus('unknown');
      setConfigInfo(null);
      return null;
    }
    try {
      const info = await getLlmConfig();
      setConfigInfo(info);
      setConfigStatus(info?.configured ? 'configured' : 'unconfigured');
      return info;
    } catch (err) {
      setConfigStatus('error');
      setConfigInfo(null);
      setError(err.message || 'Failed to load LLM config');
      return null;
    }
  }, [user]);

  const refreshConfig = checkConfig;

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || isSending) return;

    const userMsg = { id: makeId(), role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsSending(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(payload, { signal: controller.signal });

      const assistantMsg = {
        id: makeId(),
        role: 'assistant',
        content: response?.reply ?? response?.content ?? '',
        toolCalls: response?.toolCalls || response?.tool_calls || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err instanceof ChatBackendError && err.code === 'llm_not_configured') {
        setConfigStatus('unconfigured');
        setError('Configure your AI provider to start chatting.');
      } else {
        setError(err.message || 'Chat request failed');
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }, [messages, isSending]);

  const cancelSend = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo(() => ({
    messages,
    isSending,
    error,
    configStatus,
    configInfo,
    isOpen,
    openChat,
    closeChat,
    toggleChat,
    sendMessage,
    cancelSend,
    clearChat,
    checkConfig,
    refreshConfig,
  }), [
    messages, isSending, error, configStatus, configInfo, isOpen,
    openChat, closeChat, toggleChat, sendMessage, cancelSend, clearChat,
    checkConfig, refreshConfig,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export default ChatContext;
