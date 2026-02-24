/**
 * calendarConstants.js
 *
 * Single source of truth for all Nepali calendar, month, tithi, and weekday
 * name arrays. Previously these were duplicated across NepaliDatePicker,
 * TithiCalculator, BulkUploadService, and nepaliDateUtils.
 *
 * Import from here instead of re-defining locally.
 */

// ──── Nepali month names (BS calendar, Devanagari) ────
export const NEPALI_MONTHS = [
  "वैशाख", "ज्येष्ठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
  "कार्तिक", "मार्ग", "पौष", "माघ", "फाल्गुन", "चैत्र"
];

// ──── English transliterations of Nepali months ────
export const ENGLISH_NEPALI_MONTHS = [
  "Baishakh", "Jeshtha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Marga", "Poush", "Magh", "Falgun", "Chaitra"
];

// ──── Gregorian month names ────
export const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ──── Nepali weekday names (Devanagari) ────
export const NEPALI_WEEKDAYS = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
];

// ──── English weekday names ────
export const ENGLISH_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

// ──── Nepali numeral characters ────
export const NEPALI_NUMBERS = ["०","१","२","३","४","५","६","७","८","९"];

// ──── Shukla Paksha (waxing moon) tithi names ────
export const SHUKLA_TITHI_NAMES = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"
];

// ──── Krishna Paksha (waning moon) tithi names ────
export const KRISHNA_TITHI_NAMES = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"
];

// ──── English → Nepali tithi name mapping (for bulk upload and data import) ────
export const ENGLISH_TO_NEPALI_TITHI_MAP = {
  'Pratipada': 'प्रतिपदा',
  'Dwitiya': 'द्वितीया',
  'Tritiya': 'तृतीया',
  'Chaturthi': 'चतुर्थी',
  'Panchami': 'पञ्चमी',
  'Shashthi': 'षष्ठी',
  'Saptami': 'सप्तमी',
  'Ashtami': 'अष्टमी',
  'Navami': 'नवमी',
  'Dashami': 'दशमी',
  'Ekadashi': 'एकादशी',
  'Dvadashi': 'द्वादशी',
  'Trayodashi': 'त्रयोदशी',
  'Chaturdashi': 'चतुर्दशी',
  'Purnima': 'पूर्णिमा',
  'Amavasya': 'औंसी',
};

// ──── English → Nepali month name mapping (with common aliases) ────
export const ENGLISH_TO_NEPALI_MONTH_MAP = {
  // Standard names
  'Baishakh': 'वैशाख',
  'Jyeshtha': 'ज्येष्ठ',
  'Ashadh': 'आषाढ',
  'Shravan': 'श्रावण',
  'Bhadra': 'भाद्र',
  'Ashwin': 'आश्विन',
  'Kartik': 'कार्तिक',
  'Mangsir': 'मार्ग',
  'Poush': 'पौष',
  'Magh': 'माघ',
  'Phalgun': 'फाल्गुन',
  'Chaitra': 'चैत्र',
  // Common variations / aliases
  'Baisakh': 'वैशाख',
  'Baisak': 'वैशाख',
  'Baisekh': 'वैशाख',
  'Vaisakh': 'वैशाख',
  'Jyaistha': 'ज्येष्ठ',
  'Jestha': 'ज्येष्ठ',
  'Jeshtha': 'ज्येष्ठ',
  'Asarh': 'आषाढ',
  'Asadh': 'आषाढ',
  'Shrawan': 'श्रावण',
  'Sawan': 'श्रावण',
  'Bhadau': 'भाद्र',
  'Ashoj': 'आश्विन',
  'Asoj': 'आश्विन',
  'Mangseer': 'मार्ग',
  'Mansir': 'मार्ग',
  'Marg': 'मार्ग',
  'Paush': 'पौष',
  'Push': 'पौष',
  'Phagun': 'फाल्गुन',
  'Falgun': 'फाल्गुन',
  'Chait': 'चैत्र',
};
// ──── Gregorian month names in Nepali (Devanagari script) ────
export const ENGLISH_MONTHS_NEPALI = [
  "जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन",
  "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"
];

// ──── Time-of-day period labels (bilingual) ────
export const TIME_PERIODS = {
  ne: ['बिहान', 'दिउँसो', 'साँझ', 'रात'],
  en: ['Morning', 'Afternoon', 'Evening', 'Night'],
};

// ──── Nepali → English tithi name mapping (reverse of ENGLISH_TO_NEPALI_TITHI_MAP) ────
export const NEPALI_TO_ENGLISH_TITHI_MAP = Object.fromEntries(
  Object.entries(ENGLISH_TO_NEPALI_TITHI_MAP).map(([eng, nep]) => [nep, eng])
);

// ──── Nepali ↔ English paksha (fortnight) name mapping ────
export const PAKSHA_NAMES = {
  SHUKLA_NE: 'शुक्लपक्ष',
  KRISHNA_NE: 'कृष्णपक्ष',
  SHUKLA_EN: 'Shukla',
  KRISHNA_EN: 'Krishna',
};

/** Normalize a paksha value (English or Nepali, partial or full) to canonical Nepali.
 *  Accepts exact matches ('Shukla', 'शुक्लपक्ष') and fuzzy substrings ('shuk', 'suk'). */
export function normalizePakshaToNepali(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (!v) return '';
  const vl = v.toLowerCase();
  if (v === 'शुक्लपक्ष' || v === 'शुक्ल' || vl === 'shukla' || vl.includes('shuk') || vl.includes('suk') || vl.includes('शुक')) return 'शुक्लपक्ष';
  if (v === 'कृष्णपक्ष' || v === 'कृष्ण' || vl === 'krishna' || vl.includes('krish') || vl.includes('कृष्ण')) return 'कृष्णपक्ष';
  return v;
}

/** Normalize a paksha value to canonical English.
 *  Accepts exact matches ('Shukla', 'शुक्लपक्ष') and fuzzy substrings ('shuk', 'suk').
 *  Returns null (not the raw value) when the input is unrecognizable. */
export function normalizePakshaToEnglish(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  const vl = v.toLowerCase();
  if (v === 'शुक्लपक्ष' || v === 'शुक्ल' || vl === 'shukla' || vl.includes('shuk') || vl.includes('suk') || vl.includes('शुक')) return 'Shukla';
  if (v === 'कृष्णपक्ष' || v === 'कृष्ण' || vl === 'krishna' || vl.includes('krish') || vl.includes('कृष्ण')) return 'Krishna';
  return null;
}

// ──── Combined unique tithi names (for dropdowns that need all 16) ────
export const ALL_TITHI_NAMES = [
  ...SHUKLA_TITHI_NAMES.slice(0, -1), // 14 common names (प्रतिपदा … चतुर्दशी)
  'पूर्णिमा',
  'औंसी',
];

// ──── Tithi name → 1-based index within a paksha (1-15) ────
//      Accepts Nepali, English, and common variant spellings.
export const TITHI_NAME_INDEX_MAP = {
  // English
  'Pratipada': 1, 'Dwitiya': 2, 'Tritiya': 3, 'Chaturthi': 4, 'Panchami': 5,
  'Shashthi': 6, 'Saptami': 7, 'Ashtami': 8, 'Navami': 9, 'Dashami': 10,
  'Ekadashi': 11, 'Dvadashi': 12, 'Dwadashi': 12, 'Trayodashi': 13, 'Chaturdashi': 14,
  'Purnima': 15, 'Amavasya': 15, 'Aunsi': 15,
  // Nepali (canonical + known variants)
  'प्रतिपदा': 1, 'द्वितीया': 2, 'तृतीया': 3, 'चतुर्थी': 4,
  'पञ्चमी': 5, 'पंचमी': 5,
  'षष्ठी': 6, 'सप्तमी': 7, 'अष्टमी': 8, 'नवमी': 9, 'दशमी': 10,
  'एकादशी': 11, 'द्वादशी': 12, 'त्रयोदशी': 13, 'चतुर्दशी': 14,
  'पूर्णिमा': 15, 'औंसी': 15, 'अमावस्या': 15,
};