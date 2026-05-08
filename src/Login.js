// src/Login.js
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  getSignInMethodsForEmail,
  linkEmailCredential,
  auth,
} from './firebase';
import { useLanguage } from './contexts/LanguageContext';

// Map Firebase Auth error codes to user-friendly messages
function authErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/email-already-in-use':
      return 'EMAIL_ALREADY_IN_USE'; // handled specially
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  function redirectAfterSignIn() {
    navigate(from, { replace: true });
  }

  // mode: 'login' | 'signup' | 'reset'
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Account-linking state: when an email/password signup hits an existing Google account
  const [linkingState, setLinkingState] = useState(null); // { email, password }

  function resetForm() {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setInfo('');
    setLinkingState(null);
  }

  function switchMode(next) {
    resetForm();
    setMode(next);
  }

  // ── Google sign-in ─────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // If we were in the middle of a linking flow, link the pending email credential
      if (linkingState) {
        await linkEmailCredential(auth.currentUser, linkingState.email, linkingState.password);
        setLinkingState(null);
      }
      redirectAfterSignIn();
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Email sign-in ──────────────────────────────────────────────────────────
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      redirectAfterSignIn();
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Email sign-up ──────────────────────────────────────────────────────────
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // Proactively check if this email already exists under a different provider
      const methods = await getSignInMethodsForEmail(email);
      if (methods.includes('google.com') && !methods.includes('password')) {
        setLinkingState({ email, password });
        setError('');
        setLoading(false);
        return; // render linking prompt below
      }

      await signUpWithEmail(email, password);
      // Don't redirect into the app yet — send them to the email verification gate
      navigate('/verify-email', { replace: true, state: { from } });
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // Could be an email/password account or a Google account — show linking prompt
        const methods = await getSignInMethodsForEmail(email).catch(() => []);
        if (methods.includes('google.com')) {
          setLinkingState({ email, password });
          setError('');
        } else {
          setError('An account with this email already exists. Sign in instead.');
        }
      } else {
        setError(authErrorMessage(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password reset ─────────────────────────────────────────────────────────
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Enter your email address above.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setInfo(`Password reset email sent to ${email}. Check your inbox.`);
      setMode('login');
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Account-linking prompt ─────────────────────────────────────────────────
  if (linkingState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-8 bg-white rounded-2xl shadow-lg text-center max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-4">Link Your Accounts</h1>
          <p className="text-gray-600 mb-6 text-sm">
            An account with <strong>{linkingState.email}</strong> already exists via Google Sign-In.
            Sign in with Google below to link both login methods under the same account — your
            family tree data will be preserved.
          </p>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-sm transition mb-4"
          >
            <GoogleIcon />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
          <button
            onClick={() => { setLinkingState(null); setError(''); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Main login / signup / reset forms ────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-2xl shadow-lg text-center max-w-sm w-full">
        <h1 className="text-3xl font-bold mb-2">{t('login.welcome')}</h1>
        <p className="text-gray-600 mb-6 text-sm">{t('login.pleaseSignIn')}</p>

        {/* Info / success message */}
        {info && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {info}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Google button — shown in login + signup modes */}
        {mode !== 'reset' && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-sm transition mb-4"
            >
              <GoogleIcon />
              {t('auth.signInWithGoogle')}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <hr className="flex-1 border-gray-300" />
              <span className="text-gray-400 text-xs uppercase tracking-wide">or</span>
              <hr className="flex-1 border-gray-300" />
            </div>
          </>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="flex justify-between text-sm mt-2">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-blue-600 hover:underline"
              >
                Create account
              </button>
            </div>
          </form>
        )}

        {/* ── Sign-up form ── */}
        {mode === 'signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <input
              type="password"
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="text-sm text-gray-500 mt-1">
              After signing up, check your email to verify your address.
            </p>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-sm text-blue-600 hover:underline"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}

        {/* ── Password reset form ── */}
        {mode === 'reset' && (
          <form onSubmit={handlePasswordReset} className="space-y-3">
            <p className="text-sm text-gray-600 mb-2">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
            >
              {loading ? 'Sending…' : 'Send Reset Email'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fillRule="evenodd">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </g>
    </svg>
  );
}
