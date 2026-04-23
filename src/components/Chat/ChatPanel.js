import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessage from './ChatMessage';
import UnconfiguredPrompt from './UnconfiguredPrompt';

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
    error,
    configStatus,
    isOpen,
    sendMessage,
    clearChat,
    checkConfig,
  } = useChat();

  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    if (configStatus === 'unknown') {
      checkConfig();
    }
  }, [user, configStatus, checkConfig]);

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
    if (!input.trim() || isSending) return;
    const text = input;
    setInput('');
    sendMessage(text);
  };

  const handleStarter = (prompt) => {
    if (isSending) return;
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
          <Header variant={variant} onClose={onClose} onExpand={onExpand} onClear={clearChat} />
        )}
        <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-600 text-center">
          Sign in to start chatting with your HamroPanchanga assistant.
        </div>
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
          disabledClear={messages.length === 0}
        />
      )}

      {configStatus === 'unconfigured' ? (
        <UnconfiguredPrompt onAfterNavigate={onClose} />
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
            {isSending && <TypingBubble />}
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100">
              {error}
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
              placeholder="Ask about tithis, events, family trees…"
              className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-32"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
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

function Header({ variant, onClose, onExpand, onClear, disabledClear }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white rounded-t-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-semibold text-gray-900">Panchanga AI</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onClear}
          disabled={disabledClear}
          title="Clear conversation"
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V3a1 1 0 011-1h4a1 1 0 011 1v4" />
          </svg>
        </button>
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
            title="Close"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
      <div className="w-12 h-12 mb-3 rounded-full bg-purple-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        How can I help today?
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Ask about tithis, festivals, your family trees, or upcoming events.
      </p>
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
