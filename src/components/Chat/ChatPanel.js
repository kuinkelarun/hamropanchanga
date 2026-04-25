import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessage from './ChatMessage';
import UnconfiguredPrompt from './UnconfiguredPrompt';
import { signInWithGoogle } from '../../firebase';

const STARTER_PROMPTS = [
  "What's today's tithi?",
  "Show me this week's events",
  'List my family trees',
  'What festivals are coming up?',
];

export default function ChatPanel({
  variant = 'floating',
  onClose,
  onExpand,
  showHeader = true,
}) {
  const { user } = useAuth();
  const {
    messages,
    isSending,
    liveTools,
    error,
    configStatus,
    isOpen,
    sendMessage,
    clearChat,
    checkConfig,
  } = useChat();

  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-expand textarea up to 7 lines, then enable subtle scroll
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxHeight = lineHeight * 7 + paddingY;
    if (ta.scrollHeight <= maxHeight) {
      ta.style.height = `${ta.scrollHeight}px`;
      ta.style.overflowY = 'hidden';
    } else {
      ta.style.height = `${maxHeight}px`;
      ta.style.overflowY = 'auto';
    }
  }, [input]);

  // ChatProvider also triggers a check on user-available, but keep this as a
  // safety net in case the panel is mounted in an edge-case where configStatus
  // is still 'unknown'.
  useEffect(() => {
    if (!user) return;
    if (configStatus === 'unknown') {
      checkConfig();
    }
  }, [user, configStatus, checkConfig]);

  const isReady = configStatus === 'configured';
  const goToSettings = () => {
    if (onClose) onClose();
    navigate('/settings/llm');
  };

  useEffect(() => {
    if (variant === 'floating' && !isOpen) return;
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending, isOpen, variant]);

  useEffect(() => {
    if (variant === 'floating' && isOpen) {
      inputRef.current?.focus();
    } else if (variant === 'page') {
      inputRef.current?.focus();
    }
  }, [isOpen, variant]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isSending || !isReady) return;
    const text = input;
    setInput('');
    sendMessage(text);
  };

  const handleStarter = (prompt) => {
    if (isSending || !isReady) return;
    setInput('');
    sendMessage(prompt);
  };

  const containerClass =
    variant === 'page'
      ? 'flex flex-col h-full bg-white'
      : 'flex flex-col h-full bg-white rounded-lg shadow-2xl border border-gray-200';

  if (!user) {
    return (
      <div className={containerClass}>
        {showHeader && (
          <Header variant={variant} onClose={onClose} onExpand={onExpand} onClear={null} />
        )}
        <GuestPrompt onSignIn={signInWithGoogle} />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {showHeader && (
        <Header
          variant={variant}
          onClose={onClose}
          onExpand={onExpand}
          onClear={clearChat}
          onNewConvo={clearChat}
          disabledClear={messages.length === 0}
          configStatus={configStatus}
        />
      )}

      {configStatus === 'unknown' ? (
        <CheckingState />
      ) : configStatus === 'unconfigured' ? (
        <UnconfiguredPrompt onAfterNavigate={onClose} />
      ) : configStatus === 'error' ? (
        <ConfigErrorState onRetry={checkConfig} onGoToSettings={goToSettings} message={error} />
      ) : (
        <>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && !isSending ? (
              <EmptyState onPick={handleStarter} />
            ) : (
              messages.map((m) => <ChatMessage key={m.id} message={m} />)
            )}
            {isSending && <ThinkingBubble liveTools={liveTools} />}
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100 flex items-start justify-between gap-3">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={goToSettings}
                className="shrink-0 underline font-medium hover:text-red-900"
              >
                Check AI settings
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-3 flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder={isReady ? 'Ask about tithis, events, family trees…' : 'Set up your AI provider to start chatting…'}
              className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              disabled={isSending || !isReady}
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending || !isReady}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function Header({ variant, onClose, onExpand, onClear, onNewConvo, disabledClear, configStatus }) {
  const dot = (() => {
    switch (configStatus) {
      case 'configured': return { color: 'bg-green-500', label: 'AI ready' };
      case 'unconfigured': return { color: 'bg-amber-500', label: 'AI not configured' };
      case 'error': return { color: 'bg-red-500', label: 'AI check failed' };
      default: return { color: 'bg-gray-300 animate-pulse', label: 'Checking AI…' };
    }
  })();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white rounded-t-lg">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dot.color}`} title={dot.label} />
        <span className="text-sm font-semibold text-gray-900">Panchanga AI</span>
      </div>
      <div className="flex items-center gap-1">
        {onNewConvo && (
          <button
            type="button"
            onClick={onNewConvo}
            disabled={disabledClear}
            title="New conversation"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabledClear}
            title="Delete conversation"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V3a1 1 0 011-1h4a1 1 0 011 1v4" />
            </svg>
          </button>
        )}
        {variant === 'floating' && onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Open in full page"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        )}
        {variant === 'floating' && onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Minimize"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function GuestPrompt({ onSignIn }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await onSignIn();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center shadow-sm">
        <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Sign in to use HamroPanchanga AI</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          The MCP assistant can access your calendars, family trees, and tithi data — but only for signed-in users.
        </p>
      </div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </div>
  );
}

function EmptyState({ onPick }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
      <div className="w-14 h-14 mb-3 rounded-2xl bg-purple-100 flex items-center justify-center shadow-sm">
        <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Connected to HamroPanchanga MCP
      </h3>
      <p className="text-xs text-gray-500 mb-1">
        Your AI assistant can read your calendars, tithis, and family trees in real time.
      </p>
      <div className="flex items-center gap-1.5 text-xs text-purple-500 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        <span>MCP · live data · tools available</span>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="text-left text-xs px-3 py-2 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 text-gray-700 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckingState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
        <p className="text-sm text-gray-600">Checking your AI configuration…</p>
      </div>
    </div>
  );
}

function ConfigErrorState({ onRetry, onGoToSettings, message }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Couldn't reach the AI service
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {message || "We couldn't check your AI configuration. This is usually a temporary network issue."}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-full transition-colors"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onGoToSettings}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-full transition-colors"
          >
            Open settings
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble({ liveTools = [] }) {
  const lastTool = liveTools[liveTools.length - 1];

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 shrink-0">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {lastTool ? (
            <span className="text-xs text-purple-600 font-mono truncate">
              Calling <span className="font-semibold">{lastTool.name}</span>…
            </span>
          ) : (
            <span className="text-xs text-gray-500">Thinking…</span>
          )}
        </div>
        {liveTools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {liveTools.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-mono"
              >
                <span className="w-1 h-1 rounded-full bg-purple-400" />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
