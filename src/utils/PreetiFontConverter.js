// Preeti conversion support removed. This module provides no-op stubs
// so any residual imports will not break the application.

import { normalizePakshaToEnglish } from '../constants/calendarConstants';

export const detectPreeti = (text) => false;
export const smartPreetisOrUnicodeConversion = (text) => String(text || '');
export const convertRowPreetisOrUnicode = (row, nepaliFields = null) => ({});
/** @deprecated Use normalizePakshaToEnglish from calendarConstants directly. */
export const canonicalizePakshya = normalizePakshaToEnglish;

export default { detectPreeti, smartPreetisOrUnicodeConversion, convertRowPreetisOrUnicode, canonicalizePakshya };
