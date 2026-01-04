# Purnimanta System Implementation Guide

## Overview

This document explains the **Purnimanta lunar month system** and how it has been implemented in the Family Tree application to correctly determine lunar month boundaries and years.

---

## What is the Purnimanta System?

The **Purnimanta system** (also called Purnimant) is the lunar calendar convention used in Nepal. It defines months based on the full moon rather than the new moon.

### Key Principles

| Aspect | Definition |
|--------|-----------|
| **Lunar Month Start** | Krishna Pratipada (1st day of the dark fortnight) |
| **Lunar Month Start Trigger** | Day immediately after Purnima (Full Moon) |
| **Lunar Month End** | Purnima (Full Moon/15th day of bright fortnight) |
| **Days per Month** | ~29.5 days (exact = interval between Full Moons) |
| **Months per Year** | 12 lunar months |

### Lunar Month Structure

```
Lunar Month N:
├─ Day 1-15: Krishna Paksha (Dark Fortnight)
│  ├─ Krishna Pratipada (day 1)
│  ├─ Krishna Dwitiya (day 2)
│  └─ ... up to Krishna Amavasya (day 15 / New Moon)
│
├─ Day 16-30: Shukla Paksha (Bright Fortnight)
│  ├─ Shukla Pratipada (day 1 of bright phase)
│  ├─ Shukla Dwitiya (day 2)
│  └─ ... up to Shukla Purnima (day 15 / Full Moon) ← END OF MONTH
│
└─ Day 31: Next Month's Krishna Pratipada begins (first day after Purnima)
```

---

## Critical Difference: Purnimanta vs Solar Calendar

### Solar Calendar (Bikram Sambat - BS)
- **Fixed months**: Baishakh (1) through Chaitra (12)
- **Predictable boundaries**: Chaitra = fixed 32/33 days
- **Aligned with**: Sun's position (seasons)

### Purnimanta Lunar Calendar
- **Fluid months**: Start at Krishna Pratipada (after Full Moon)
- **Variable boundaries**: Float relative to solar calendar
- **Aligned with**: Moon's phases

### The Boundary Crossing Problem

A single lunar month may **span two solar months**:

```
Example: Lunar Baishakh starting late in solar Chaitra
Solar Month: Chaitra    |  Baishakh
Lunar Month:   Baishakh (starts Chaitra 31) → (ends Baishakh 14)

Result: Same lunar month in TWO different solar months
```

---

## The Year Boundary (Samvatsara)

### When Does the Tithi Year Change?

The **Tithi Year** (also called Samvatsara) changes at **Chaitra Shukla Pratipada**.

```
Timeline:
┌─────────────────────────────────────────────────┐
│ Old Tithi Year 2081                             │
│ ├─ Baishakh 2081 through Chaitra 2081          │
│ └─ Chaitra 2081 ends at Purnima (day 15)       │
├─ Chaitra Shukla Pratipada (Amavasya + 1)      │ ← NEW YEAR BEGINS
│ New Tithi Year 2082                             │
│ ├─ Continues through rest of Chaitra 2081     │ ← Still solar 2081!
│ └─ Labeled as "Tithi Year 2082"               │
└─────────────────────────────────────────────────┘
```

### Key Rule: Label to Next Solar Year

When a lunar month starts in Chaitra (solar month 12), **label it with the NEXT solar year**:

```
Solar Date: Chaitra 31, 2081
Tithi: Chaitra Shukla Pratipada (year changes here!)
Label: Lunar Baishakh 2082  ← Uses next solar year
```

---

## Implementation in Code

### 1. Core Functions (Already Implemented)

Located in: `src/utils/nepaliDateUtils.js`

#### A. `getTithiYearStartBoundary(bsYear, tithiLookupFn)`
**Purpose**: Find when Chaitra Shukla Pratipada occurs in a given solar year

**Status**: Placeholder (requires `getTithisForBsDate()` function)

**What It Should Do**:
```
Input: bsYear = 2081
Process:
  1. Scan Chaitra 1-31, 2081
  2. Find Amavasya (tithi 30)
  3. Next day = Chaitra Shukla Pratipada
Output: { bsYear: 2081, startMonth: 12, startDay: 17 (example) }
```

#### B. `findPurnimaInMonth(bsYear, bsMonth, tithiLookupFn)`
**Purpose**: Locate the Full Moon in a given solar month

**Status**: Placeholder (requires `getTithisForBsDate()` function)

**What It Should Do**:
```
Input: bsYear = 2082, bsMonth = 12 (Chaitra)
Process:
  1. Scan Chaitra 1-32, 2082
  2. Find Shukla Purnima (tithi 15 in Shukla Paksha)
  3. Record that day and the next day
Output: {
  purnimaDay: 14,
  nextDayAdDate: "2025-03-30" (Krishna Pratipada of next month)
}
```

#### C. `getTithiMonthBoundaries(lunarMonthNumber, bsYear, tithiLookupFn)`
**Purpose**: Get the start and end dates of a lunar month (Purnimanta system)

**Status**: Placeholder (requires tithi lookup)

**What It Should Return**:
```javascript
{
  lunarMonthNumber: 1,     // 1=Baishakh through 12=Chaitra
  monthName: "बैशाख",      // Nepali month name
  bsYear: 2082,            // Solar year
  startBsDate: { year: 2081, month: 12, day: 31 },  // Date of Krishna Pratipada
  endBsDate: { year: 2082, month: 1, day: 14 },     // Date of Purnima
  startAdDate: "2025-03-18",
  endAdDate: "2025-04-01"
}
```

#### D. `getTithiYearFromAdDate(adDateStr, tithiLookupFn)`
**Purpose**: Determine which Tithi Year an AD date belongs to

**Status**: Partially implemented with approximation

**How It Works**:
```javascript
getTithiYearFromAdDate('2025-03-18')
// Converts to BS: 2082/12/18 (Chaitra 18)
// Result: { 
//   tithiYear: 2082,        // Year after Chaitra S. Pratipada
//   inCharitra: true,
//   beforeNewYear: false,
//   needsAccurateCalculation: true
// }

getTithiYearFromAdDate('2025-03-05')
// Converts to BS: 2082/12/5 (Chaitra 5)
// Result: {
//   tithiYear: 2081,        // Year before Chaitra S. Pratipada
//   inCharitra: true,
//   beforeNewYear: true,
//   needsAccurateCalculation: true
// }
```

---

## What's Missing: The `getTithisForBsDate()` Function

All of the above functions are **placeholders/partial** because they depend on a critical missing piece:

### Required Function Signature
```javascript
/**
 * Look up the tithi that occurs on a given Bikram Sambat date
 * @param {number} bsYear - BS year
 * @param {number} bsMonth - BS month (1-12)
 * @param {number} bsDay - BS day (1-32)
 * @returns {Object} {
 *   pakshya: 'शुक्लपक्ष' | 'कृष्णपक्ष',
 *   tithiNumber: 1-15,
 *   tithiName: string (Nepali),
 *   startTime: HH:MM,
 *   endTime: HH:MM
 * }
 */
export function getTithisForBsDate(bsYear, bsMonth, bsDay) {
  // This function would use the ephemeris data and moon/sun calculations
  // to determine what tithi falls on a given BS date
  // Implementation would leverage: computeTithiFromLongitudes + getEphemerisData
}
```

### How to Implement It

1. **Locate**: Check `src/utils/ephemeris.js` for existing functions
2. **Create**: A wrapper that:
   - Takes a BS date
   - Converts to AD date using `convertBsToAd()`
   - Calculates moon/sun longitudes for that date
   - Uses `computeTithiFromLongitudes()` to determine tithi
   - Returns the result in structured format

3. **Use**: Pass this function to all the boundary finder functions

---

## Step-by-Step: Complete the Purnimanta System

### Phase 1: Implement `getTithisForBsDate()` ✅ TODO

**File**: `src/utils/nepaliDateUtils.js`

**Pseudo-code**:
```javascript
export function getTithisForBsDate(bsYear, bsMonth, bsDay) {
  // 1. Convert BS date to AD date
  const adDate = convertBsToAd(bsYear, bsMonth, bsDay);
  
  // 2. Get ephemeris data for that AD date at noon
  const ephemerisData = getEphemerisData(adDate.year, adDate.month, adDate.day);
  
  // 3. Calculate tithi from moon/sun longitudes
  const tithiInfo = computeTithiFromLongitudes(
    ephemerisData.moonLongitude,
    ephemerisData.sunLongitude
  );
  
  // 4. Return formatted result
  return {
    pakshya: tithiInfo.pakshya,
    tithiNumber: tithiInfo.tithi,
    tithiName: getTithiName(tithiInfo.pakshya, tithiInfo.tithi),
    bsYear, bsMonth, bsDay,
    adDate: adDate
  };
}
```

### Phase 2: Implement Boundary Finder Functions ✅ TODO

**File**: `src/utils/nepaliDateUtils.js`

Once `getTithisForBsDate()` exists:

1. Update `getTithiYearStartBoundary()` to scan for Amavasya
2. Update `findPurnimaInMonth()` to scan for Shukla Purnima
3. Update `getTithiMonthBoundaries()` to use both scanners
4. Verify `getTithiYearFromAdDate()` against accurate data

### Phase 3: Integration ✅ TODO

**Files to Update**:
- `src/components/AdminManagement.js` - Use accurate boundaries in `generateTithiExcel()`
- `src/components/TithiCalculator.js` - Display Tithi Year alongside month
- Test cases - Validate 2081→2082 boundary

---

## Test Case: Chaitra 2081 → Baishakh 2082

Use this to validate your implementation:

```
Test Dates (AD):
─────────────────────────────────────────

AD: 2025-03-05 → BS: 2082/12/5 (Early Chaitra)
Expected: 
  ✓ Tithi Year: 2081
  ✓ Solar Year: 2082
  ✓ Before Chaitra Shukla Pratipada

AD: 2025-03-18 → BS: 2082/12/18 (Late Chaitra)
Expected:
  ✓ Tithi Year: 2082  (New year started!)
  ✓ Solar Year: 2082
  ✓ On/after Chaitra Shukla Pratipada

AD: 2025-03-30 → BS: 2082/1/1 (Baishakh 1st)
Expected:
  ✓ Tithi Year: 2082
  ✓ Solar Year: 2082 (but previous month was Chaitra 2081!)
  ✓ Lunar month "Baishakh" started in Chaitra, labeled "2082"
```

---

## Current State & Next Steps

### ✅ Already Implemented
- `getTithiMonthFromAdDate()` - Basic solar month extraction
- `getTithiMonthFromTithi()` - Semantic wrapper
- Conversion functions: `convertAdToBs()` & `convertBsToAd()`
- Ephemeris calculation: `computeTithiFromLongitudes()` & `getEphemerisData()`

### 🔄 Partially Implemented (Placeholders)
- `getTithiYearStartBoundary()` - Needs tithi lookup
- `findPurnimaInMonth()` - Needs tithi lookup
- `getTithiMonthBoundaries()` - Needs tithi lookup
- `getTithiYearFromAdDate()` - Uses approximation, needs accuracy

### ⏳ TODO - High Priority
1. **Implement `getTithisForBsDate()`** - The foundation for all boundary finding
2. **Enhance boundary finder functions** - Make them use actual tithi data
3. **Update `getTithiYearFromAdDate()`** - Remove approximation logic
4. **Add validation tests** - Verify 2081→2082 boundary and month transitions

### ⏳ TODO - Integration
1. Update `generateTithiExcel()` to use accurate Tithi Year
2. Display Tithi Year in UI components
3. Update bulk upload to handle year transitions

---

## References

### Files
- **Core Implementation**: `src/utils/nepaliDateUtils.js`
- **Ephemeris Calculations**: `src/utils/ephemeris.js`
- **Tithi UI**: `src/components/TithiCalculator.js`
- **Admin Functions**: `src/components/AdminManagement.js`

### Constants
- **Nepali Months**: `nepaliMonths` array (12 month names)
- **Lunar Months**: `lunarMonthNames` array (in `getTithiMonthBoundaries()`)
- **Tithi Names**: `shuklaNames` & `krishnaNames` arrays

### External Functions Used
- `convertAdToBs(year, month, day)` - AD to BS conversion
- `convertBsToAd(year, month, day)` - BS to AD conversion
- `computeTithiFromLongitudes(moonLon, sunLon)` - Tithi calculation
- `getEphemerisData(year, month, day)` - Lunar/solar positions

---

## Version History

| Date | Change | Status |
|------|--------|--------|
| 2026-01 | Added Purnimanta function placeholders | ✅ Complete |
| 2026-01 | Created implementation guide | ✅ Complete |
| TBD | Implement getTithisForBsDate() | ⏳ TODO |
| TBD | Enhance boundary finder functions | ⏳ TODO |
| TBD | Integration with UI/Admin | ⏳ TODO |

---

## Questions & Clarifications

**Q: Why can't we just use solar month boundaries?**  
A: Lunar months float relative to solar months. A lunar month may start in Chaitra and end in Baishakh. Using solar boundaries would be inaccurate.

**Q: What if Chaitra Shukla Pratipada occurs on Baishakh 1st instead of Chaitra?**  
A: This doesn't happen in the Purnimanta system. Chaitra Shukla Pratipada always occurs within Chaitra (month 12) because it's defined as the day after Chaitra Amavasya.

**Q: How do we handle leap years or missing days?**  
A: The lunar calendar automatically adjusts through the floating boundaries. BS calendar has variable month lengths (32-33 days), handled by `convertAdToBs()`.

**Q: Should we store both Solar and Lunar years in the database?**  
A: Recommendation: Store AD dates + calculate both on-demand. This keeps data clean and avoids sync issues.

---

*Last Updated: January 3, 2026*  
*Purnimanta System Foundation Complete - Awaiting Tithi Lookup Implementation*
