import React, { useState } from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const hasTools = Array.isArray(message.toolCalls) && message.toolCalls.length > 0;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      {hasTools && !isUser && <ToolCallBadges calls={message.toolCalls} />}
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap leading-relaxed',
          isUser
            ? 'bg-purple-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm',
        ].join(' ')}
      >
        {message.content || (isUser ? '' : <span className="text-gray-400">(no reply)</span>)}
      </div>
    </div>
  );
}

function ToolCallBadges({ calls }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-[85%] space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 group"
      >
        {/* MCP plug icon */}
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="font-medium">{calls.length} MCP tool{calls.length === 1 ? '' : 's'} used</span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 space-y-2">
          {calls.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <span className="text-xs font-semibold text-purple-800 font-mono">{c.name}</span>
              </div>
              {c.input && Object.keys(c.input).length > 0 && (
                <div className="ml-3 text-xs text-purple-600 font-mono break-all">
                  {JSON.stringify(c.input)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
