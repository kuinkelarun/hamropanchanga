// src/VerifyEmailPage.js
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendEmailVerification, reload } from 'firebase/auth';
import { auth } from './firebase';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent | error
  const [checkStatus, setCheckStatus] = useState('idle');  // idle | checking | error

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setResendStatus('sending');
    try {
      await sendEmailVerification(auth.currentUser);
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  const handleContinue = async () => {
    if (!auth.currentUser) return;
    setCheckStatus('checking');
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        navigate(from, { replace: true });
      } else {
        setCheckStatus('error');
      }
    } catch {
      setCheckStatus('error');
    }
  };

  const email = auth.currentUser?.email ?? '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your inbox</h1>
        <p className="text-sm text-gray-500 mb-1">
          We sent a verification link to
        </p>
        <p className="text-sm font-medium text-gray-800 mb-6">{email}</p>

        <p className="text-sm text-gray-500 mb-6">
          Click the link in that email to verify your address, then come back here and click <strong>I've verified</strong>.
        </p>

        {/* I've verified button */}
        <button
          onClick={handleContinue}
          disabled={checkStatus === 'checking'}
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 mb-3"
        >
          {checkStatus === 'checking' ? 'Checking…' : "I've verified my email"}
        </button>
        {checkStatus === 'error' && (
          <p className="text-xs text-red-600 mb-3">
            Email not verified yet. Click the link in your inbox first, then try again.
          </p>
        )}

        {/* Resend button */}
        <button
          onClick={handleResend}
          disabled={resendStatus === 'sending' || resendStatus === 'sent'}
          className="text-sm text-blue-600 hover:text-blue-700 underline disabled:opacity-50 disabled:no-underline"
        >
          {resendStatus === 'sent'
            ? 'Email sent!'
            : resendStatus === 'sending'
            ? 'Sending…'
            : 'Resend verification email'}
        </button>
        {resendStatus === 'error' && (
          <p className="text-xs text-red-600 mt-1">Could not send. Please try again later.</p>
        )}

        <hr className="my-5 border-gray-100" />
        <p className="text-xs text-gray-400">
          Wrong email?{' '}
          <button
            onClick={() => { auth.signOut(); navigate('/login'); }}
            className="underline hover:text-gray-600"
          >
            Sign out and start over
          </button>
        </p>
      </div>
    </div>
  );
}
