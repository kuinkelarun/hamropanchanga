// Preeti conversion support removed. This module provides no-op stubs
// so any residual imports will not break the application.

export const detectPreeti = (text) => false;
export const smartPreetisOrUnicodeConversion = (text) => String(text || '');
export const convertRowPreetisOrUnicode = (row, nepaliFields = null) => ({});
export const canonicalizePakshya = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s.includes('shuk') || s.includes('शुक') || s.includes('suk')) return 'Shukla';
  if (s.includes('krish') || s.includes('कृष्ण') || s.includes('krishna')) return 'Krishna';
  return null;
};

export default { detectPreeti, smartPreetisOrUnicodeConversion, convertRowPreetisOrUnicode, canonicalizePakshya };
