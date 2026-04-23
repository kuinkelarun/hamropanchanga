import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UnconfiguredPrompt({ onAfterNavigate }) {
  const navigate = useNavigate();

  const goToSettings = () => {
    if (onAfterNavigate) onAfterNavigate();
    navigate('/settings/llm');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Configure your AI assistant
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your Anthropic API key or AWS Bedrock credentials before you start chatting.
        </p>
        <button
          type="button"
          onClick={goToSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-full transition-colors"
        >
          Configure now
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
