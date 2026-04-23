import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import ChatPanel from './ChatPanel';

export default function FloatingChat() {
  const { user } = useAuth();
  const { isOpen, openChat, closeChat } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;
  if (location.pathname.startsWith('/chat')) return null;

  const handleExpand = () => {
    closeChat();
    navigate('/chat');
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={openChat}
          aria-label="Open chat assistant"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-xl text-white flex items-center justify-center transition-all hover:scale-105"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-96 h-[min(600px,calc(100vh-6rem))] max-h-[90vh]"
        >
          <ChatPanel
            variant="floating"
            onClose={closeChat}
            onExpand={handleExpand}
          />
        </div>
      )}
    </>
  );
}
