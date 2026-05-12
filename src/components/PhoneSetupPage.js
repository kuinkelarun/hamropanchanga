// src/components/PhoneSetupPage.js
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// Detect user's country code via free IP geolocation (no key required)
async function detectCountry() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.country_code || null; // e.g. "NP", "US", "GB"
  } catch {
    return null;
  }
}

// Fallback: guess from browser language ("ne" → NP, "hi" → IN, etc.)
function guessCountryFromLocale() {
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ne')) return 'NP';
  if (lang.startsWith('hi')) return 'IN';
  return 'NP'; // default for this app
}

export default function PhoneSetupPage() {
  const { user, setNeedsPhone, setSkipPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('NP');
  const [optIn, setOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectCountry();
      if (!cancelled) {
        setCountry(detected || guessCountryFromLocale());
        setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Please enter a valid phone number including country code.');
      return;
    }
    if (!user) return;

    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: phone,           // E.164 format e.g. +9779800000000
        whatsAppOptIn: optIn,
        phoneAddedAt: new Date().toISOString(),
      });
      setNeedsPhone(false);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Failed to save phone number:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setSkipPhone(true);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
        {/* Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">
          Get WhatsApp Notifications
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Add your WhatsApp number to receive reminders for events you've added —
          one week before and on the day of the event.
        </p>

        {/* Phone Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            WhatsApp Number
          </label>
          <div className={`phone-input-wrapper rounded-lg border ${error ? 'border-red-400' : 'border-gray-300'} focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors`}>
            {detecting ? (
              <div className="px-3 py-2.5 text-sm text-gray-400">Detecting your country…</div>
            ) : (
              <PhoneInput
                international
                countryCallingCodeEditable={false}
                defaultCountry={country}
                value={phone}
                onChange={(val) => { setPhone(val || ''); setError(''); }}
                className="w-full"
              />
            )}
          </div>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          <p className="mt-1.5 text-xs text-gray-400">
            Enter the number you use on WhatsApp. Only you will receive these messages.
          </p>
        </div>

        {/* Opt-in checkbox */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer group">
          <div className="mt-0.5 relative flex-shrink-0">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-green-500 peer-checked:border-green-500 transition-colors flex items-center justify-center">
              {optIn && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
            Send me WhatsApp reminders for events I've added to my calendar
          </span>
        </label>

        {/* Actions */}
        <button
          onClick={handleSave}
          disabled={saving || detecting}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mb-3"
        >
          {saving ? 'Saving…' : 'Save & Enable Notifications'}
        </button>
        <button
          onClick={handleSkip}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
