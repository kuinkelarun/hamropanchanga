import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { signInWithGoogle } from '../../firebase';
import { useChat } from '../../contexts/ChatContext';
import ChatPanel from './ChatPanel';

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clearChat, messages, openChat } = useChat();

  const handlePopOut = () => {
    openChat();
    navigate(-1);
  };

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Sign in to chat
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            The Panchanga AI assistant works against your family trees and events, so you need to be signed in.
          </p>
          <button
            type="button"
            onClick={() => { signInWithGoogle().catch(() => {}); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50">
      <div className="max-w-3xl mx-auto h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Panchanga AI</h1>
            <p className="text-xs text-gray-500">
              Ask about tithis, festivals, your family trees, or upcoming events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePopOut}
              title="Back to floating chat"
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 15v4.5M9 15H4.5M15 9h4.5M15 9V4.5M15 15h4.5M15 15v4.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={clearChat}
              disabled={messages.length === 0}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            >
              New conversation
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel variant="page" showHeader={false} />
        </div>
      </div>
    </div>
  );
}
