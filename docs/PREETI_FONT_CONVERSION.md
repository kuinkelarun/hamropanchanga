# Preeti Font Conversion Integration

## Overview
Automatic Preeti → Unicode conversion has been integrated into the bulk upload pipeline. This allows users to upload Excel files with legacy Preeti font encoding, which will be automatically converted to modern Unicode Devanagari script.

## What is Preeti Font?
Preeti is a legacy ANSI font encoding that was commonly used for Nepali text before Unicode adoption. It maps ASCII characters to Nepali glyphs when rendered with the Preeti font. For example:
- 'k' in Preeti renders as 'क' in Devanagari
- 'Z_e' in Preeti renders as 'े' (vowel sign)

## Implementation

### New Files Created
- **`src/utils/PreetiFontConverter.js`** - Core Preeti→Unicode conversion utility

### Modified Files
- **`src/utils/ExcelParser.js`** - Integrated Preeti conversion into `normalizeData()` function

## How It Works

### Conversion Pipeline
1. **File Upload** → Excel/CSV file is uploaded
2. **Parsing** → File is parsed into rows
3. **Normalization** (NEW: Preeti Detection & Conversion)
   - Each row is scanned for Preeti-encoded text
   - Fields checked: Tree Name, Member Name, Event Name, Event Description, Tithi Month, Tithi, Pakshya
   - Preeti text is automatically converted to Unicode Devanagari
4. **Date Parsing** → Date fields are converted to ISO format
5. **Validation** → Data is validated (including pakshya-aware tithi checks)
6. **Preview** → User sees cleaned/converted data before committing
7. **Commit** → Data is persisted to Firestore

### Key Functions

#### `detectPreeti(text)`
Detects if a string contains Preeti font encoded text by checking for characteristic patterns.

#### `convertPreetiBitStreamToUnicode(preetiBitStream)`
Converts Preeti-encoded text to Unicode Devanagari script using character mapping tables.

#### `smartPreetisOrUnicodeConversion(text)`
Smart wrapper that detects encoding and converts if necessary. Returns text unchanged if already Unicode or English.

#### `convertRowPreetisOrUnicode(row, nepaliFields)`
Converts specific fields in a data row (e.g., Excel row) from Preeti to Unicode.

## Character Mappings
The converter includes comprehensive mappings for:
- **Vowels** (Swar): अ, आ, इ, ई, उ, ऊ, etc.
- **Consonants** (Vyanjana): क, ख, ग, घ, etc.
- **Vowel Signs** (Matra): ा, ि, ी, ु, ू, etc.
- **Special Characters**: Hindi numerals (०-९), punctuation marks (ः, ं, ँ, ्)

## Usage in Bulk Upload

When a user uploads an Excel file with Preeti-encoded Nepali text:

```javascript
// In BulkUploadModal.js (line 108)
const normalizedData = normalizeData(rawData);
// ↓ Now automatically converts Preeti to Unicode ↓
// Example: "efbj" (Preeti) → "नेपाल" (Unicode)
```

## Testing

To test Preeti conversion:

1. Create an Excel file with Preeti-encoded Nepali text in cells
2. Upload via bulk upload modal
3. In the preview, verify that Preeti text appears correctly converted to Unicode Devanagari
4. Proceed with validation and commit

Example test data:
- Preeti: "ck;" → Unicode: "नेपाल" (Nepal)
- Preeti: "d;sxL" → Unicode: "पञ्चमी" (Panchami tithi)

## Limitations & Notes

1. **Detection Heuristics**: The `detectPreeti()` function uses pattern matching. Mixed Preeti/Unicode text may not be detected reliably.
2. **Font Mixing**: If Excel cells mix Preeti and Unicode text, only clearly Preeti sections will be converted.
3. **Already Unicode**: Files already in Unicode format pass through unchanged.
4. **English Text**: English/ASCII text is not affected by the conversion.

## Future Enhancements

- [ ] Add user option to manually specify which fields contain Preeti text
- [ ] Add confidence scoring for Preeti detection
- [ ] Support for other legacy Nepali font encodings (e.g., Manasa, Krutideva)
- [ ] Batch conversion utility for non-upload scenarios
