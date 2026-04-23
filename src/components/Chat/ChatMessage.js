import React, { useState } from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const hasTools = Array.isArray(message.toolCalls) && message.toolCalls.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap leading-relaxed',
          isUser
            ? 'bg-purple-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm',
        ].join(' ')}
      >
        {message.content || (isUser ? '' : <span className="text-gray-400">(no reply)</span>)}
        {hasTools && !isUser && <ToolCallList calls={message.toolCalls} />}
      </div>
    </div>
  );
}

function ToolCallList({ calls }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg
          className={`w-3 h-3 transform transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {calls.length} tool call{calls.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {calls.map((c, i) => (
            <li key={i} className="text-xs font-mono text-gray-600">
              <span className="text-gray-900">{c.name}</span>
              {c.input && (
                <span className="text-gray-500"> · {JSON.stringify(c.input)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
