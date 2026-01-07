// Shared text normalization helpers.
//
// Goal: keep user-visible text as-entered, but provide a consistent,
// punctuation-insensitive form for comparisons/search keys.

export function normalizeForCompare(value) {
  if (value == null) return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u200c\u200d]/g, '') // zero-width joiners
    .toLocaleLowerCase()
    // Replace anything that's not a letter/number (English + Devanagari) with spaces.
    .replace(/[^0-9a-z\u0900-\u097f]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildSearchFields(obj, keys) {
  const out = {};
  (keys || []).forEach((key) => {
    if (!key) return;
    const raw = obj?.[key];
    if (raw == null) return;
    out[`${key}Normalized`] = normalizeForCompare(raw);
  });
  return out;
}
