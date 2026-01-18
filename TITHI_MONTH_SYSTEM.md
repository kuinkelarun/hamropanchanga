# Tithi Month System Documentation

## Quick Summary
**Tithi Months are lunar cycles, NOT Nepali calendar months.** Each Tithi Month is determined by when the tithi starts, and may span across Nepali calendar month boundaries.

---

## What is a Tithi Month?

### Definition
A **Tithi Month** is a lunar cycle with two phases:
- **कृष्णपक्ष (Krishna Paksha)**: Dark fortnight (days 1-15)
- **शुक्लपक्ष (Shukla Paksha)**: Light/Bright fortnight (days 1-15)

### Tithi Month Structure
Each Tithi Month spans 30 days:
```
Tithi Month N:
├─ कृष्णपक्ष प्रतिपदा (Krishna day 1)  ← START of month
├─ कृष्णपक्ष (Krishna days 2-15)
├─ शुक्लपक्ष (Shukla days 1-15)
└─ शुक्लपक्ष पूर्णिमा (Shukla day 15)  ← END of month
```

### Tithi Year
The Tithi Year starts and ends at specific points:
- **Year Start**: वैशाख कृष्णपक्ष प्रतिपदा (Vaishakh Krishna Pratipada)
- **Year End**: चैत्र शुक्लपक्ष पूर्णिमा (Chaitra Shukla Purnima)
- **Total Months**: 12 Tithi Months in a Tithi Year

---

## How Tithi Month Names Are Determined

### Key Principle
The **Tithi Month name is derived from the Nepali month where the tithi STARTS**, not where it ends.

### Examples

#### Example 1: Tithi Stays Within Calendar Month
```
Nepali Month: आषाढ (Ashar)
Tithi: आषाढ कृष्णपक्ष प्रतिपदा → आषाढ शुक्लपक्ष पूर्णिमा
Tithi Month Name: आषाढ
(Starts in Ashar, ends in Ashar)
```

#### Example 2: Tithi Spans Calendar Months (Boundary Crossing)
```
Nepali Month Boundary: आषाढ ends → श्रावण begins
Tithi: आषाढ शुक्लपक्ष षष्ठी (late Ashar) → श्रावण कृष्णपक्ष (early Saun)
Tithi Month Name: आषाढ
(Starts in Ashar, ends in Saun, but called आषाढ because it STARTS there)
```

### Why This Matters
- Tithi months may **NOT align** with Nepali calendar month boundaries
- A Tithi Month could span into the next calendar month
- The month name depends on **where it starts**, not where it ends

---

## Implementation in Code

### Core Function: `getTithiMonthFromAdDate()`

Located in: `src/utils/nepaliDateUtils.js`

```javascript
/**
 * Determines the Tithi Month for a given AD date
 * @param {string} adDateStr - AD date in YYYY-MM-DD format
 * @returns {Object} { month: 1-12, monthName: string, bsYear: number }
 */
export function getTithiMonthFromAdDate(adDateStr) {
  // 1. Convert AD date to BS (Nepali) date
  const bsDate = convertAdToBs(adYear, adMonth - 1, adDay);
  
  // 2. Extract month number (1-12)
  const month = bsDate.month;
  
  // 3. Look up month name from nepaliMonths array
  const monthName = nepaliMonths[month - 1];
  
  return { month, monthName, bsYear: bsDate.year };
}
```

### Algorithm Flow
```
AD Date (2025-06-23)
    ↓
convertAdToBs() → BS Date (2082-3-9)
    ↓
Extract month number (3)
    ↓
nepaliMonths[3-1] → "आषाढ"
    ↓
Return: { month: 3, monthName: "आषाढ", bsYear: 2082 }
```

### Where It's Used

1. **Auto-Generation** (`generateTithiExcel()`):
   - Called for each tithi when bulk generating
   - Month automatically populated in Excel output
   - User can generate tithis for multiple months at once

2. **Data Export** (`exportData()`):
   - Called for each stored tithi
   - Ensures exported data matches bulk upload template
   - Maintains consistency

3. **Bulk Upload** (`downloadTemplate()`):
   - Reference sheet shows month names
   - Example: "Month Name (Nepali)*" column includes values like "आषाढ", "श्रावण", etc.

---

## Nepali Months Reference

| No. | Month Name (Nepali) | English Name | No. | Month Name (Nepali) | English Name |
|-----|-------------------|--------------|-----|-------------------|--------------|
| 1 | वैशाख | Vaishakh (Mar-Apr) | 7 | कार्तिक | Kartik (Oct-Nov) |
| 2 | ज्जेष्ठ | Jeshta (Apr-May) | 8 | मार्ग | Mangsir (Nov-Dec) |
| 3 | आषाढ | Ashar (May-Jun) | 9 | पौष | Pus (Dec-Jan) |
| 4 | श्रावण | Saun (Jun-Jul) | 10 | माघ | Magh (Jan-Feb) |
| 5 | भाद्र | Bhadau (Jul-Aug) | 11 | फाल्गुन | Phalgun (Feb-Mar) |
| 6 | आश्विन | Asoj (Aug-Sep) | 12 | चैत्र | Chaitra (Mar) |

---

## Tithi Phases Reference

### Shukla Paksha (Bright Fortnight)
- शुक्लपक्ष प्रतिपदा (Pratipada / 1st)
- शुक्लपक्ष द्वितीया (Dwitiya / 2nd)
- शुक्लपक्ष तृतीया (Tritiya / 3rd)
- ... up to ...
- शुक्लपक्ष पूर्णिमा (Purnima / Full Moon, 15th)

### Krishna Paksha (Dark Fortnight)
- कृष्णपक्ष प्रतिपदा (Pratipada / 1st)
- कृष्णपक्ष द्वितीया (Dwitiya / 2nd)
- कृष्णपक्ष तृतीया (Tritiya / 3rd)
- ... up to ...
- कृष्णपक्ष औंसी (Amavasya / New Moon, 15th)

---

## Important Notes

### ⚠️ Tithi Month ≠ Nepali Calendar Month
- **Tithi Month**: Lunar cycle (कृष्णपक्ष → शुक्लपक्ष)
- **Nepali Calendar Month**: Fixed calendar boundaries
- They may not align perfectly

### ✅ Month Determination Rules
1. **Always extract from START date** - not end date
2. **Use the Nepali month** where the tithi starts
3. **Convert AD → BS first** using `convertAdToBs()`
4. **Look up month name** using `nepaliMonths[bsMonth - 1]`

### 📝 For Developers
- Never hardcode months based on pakshya/tithi numbers alone
- Always use the date-based calculation
- Include comments explaining that "Tithi Months" are being used
- Remember: Tithi months may span calendar month boundaries

---

## Example Usage

### Scenario: Bulk Generating Tithis for 2082 (July - September)

**Input**: User selects date range 2025-06-01 to 2025-08-31 (AD dates)

**Processing**:
```javascript
// For each calculated tithi:
const adDateStr = '2025-06-23'; // Tithi start date
const tithiMonth = getTithiMonthFromAdDate(adDateStr);
// Returns: { month: 3, monthName: 'आषाढ', bsYear: 2082 }

// Excel row output:
[
  'एकादशी',        // Tithi name
  'कृष्णपक्ष',      // Pakshya
  'आषाढ',           // Tithi Month Name (AUTO-POPULATED)
  '२०८२-०३-०९',    // Start date (Nepali)
  '06:30',          // Start time
  '२०८२-०३-०१०',   // End date (Nepali)
  '07:15',          // End time
  'ADD',            // Action
  ''                // Category (optional)
]
```

**Result**: User gets Excel file with all tithis properly assigned to their Tithi Months without manual selection.

---

## FAQ

### Q: Why do tithis need "months" at all?
**A**: Tithis are organized into monthly groups for:
- User convenience (searching/filtering by month)
- Calendar UI display
- Event categorization
- Ritual planning

### Q: Can a tithi belong to two different months?
**A**: No. A tithi is assigned to exactly one Tithi Month based on its start date.

### Q: What if my AD date conversion is wrong?
**A**: Use `convertAdToBs()` with the exact format: `convertAdToBs(adYear, adMonth-1, adDay)` where month is 0-indexed for the function input.

### Q: How do I validate if a month name is correct?
**A**: Check against `nepaliMonths` array:
```javascript
const validMonths = nepaliMonths;
const isValid = validMonths.includes(monthName);
```

---

## Related Files

- **Core Utility**: `src/utils/nepaliDateUtils.js` - Contains `getTithiMonthFromAdDate()`
- **Admin Component**: `src/components/AdminManagement.js` - Uses function in `generateTithiExcel()` and `exportData()`
- **Constants**: `src/constants/tithiConstants.js` - Contains `nepaliMonths` array
- **Tests**: `src/test/` - Test files for month-related functions

---

## Version History

| Date | Change | Impact |
|------|--------|--------|
| 2025-01 | Initial Tithi Month System | Basic month extraction from date |
| 2025-02 | Clarified Tithi Month Definition | Emphasized lunar cycles vs calendar months |
| 2025-03 | Added Boundary Crossing Documentation | Explained why months may span calendar lines |

---

*Last Updated: 2025 Phase 3*
*Maintains consistency with Tithi Calendar Implementation*
