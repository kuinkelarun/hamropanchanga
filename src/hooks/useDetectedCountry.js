import { useState, useEffect } from 'react';

async function fetchCountryFromIp() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.country_code || null;
  } catch {
    return null;
  }
}

function guessCountryFromLocale() {
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ne')) return 'NP';
  if (lang.startsWith('hi')) return 'IN';
  return 'NP';
}

let cachedCountry = null;
let pendingPromise = null;

// Shared promise so multiple callers on the same page only make one IP request
function getDetectedCountry() {
  if (cachedCountry) return Promise.resolve(cachedCountry);
  if (!pendingPromise) {
    pendingPromise = fetchCountryFromIp().then((code) => {
      cachedCountry = code || guessCountryFromLocale();
      return cachedCountry;
    });
  }
  return pendingPromise;
}

export function useDetectedCountry() {
  const [country, setCountry] = useState(cachedCountry || 'NP');
  const [detecting, setDetecting] = useState(!cachedCountry);

  useEffect(() => {
    if (cachedCountry) return;
    let cancelled = false;
    getDetectedCountry().then((code) => {
      if (!cancelled) {
        setCountry(code);
        setDetecting(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { country, detecting };
}
