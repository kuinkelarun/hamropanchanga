# Quick Reference: Tithi Month Testing

## The Core Concept

**Tithi months change when PAKSHYA changes, NOT when calendar months change.**

```
Shukla Purnima (day 15 of Shukla)
        ↓
        MONTH ENDS
        ↓
Krishna Pratipada (day 1 of Krishna) ← NEW MONTH STARTS
```

---

## Quick Test (Copy & Paste)

### Test 1: Month-End Detection

```javascript
// Import from nepaliDateUtils.js
import { isTithiMonthEnd } from './src/utils/nepaliDateUtils';

// Shukla Purnima followed by Krishna Pratipada = MONTH END
const result = isTithiMonthEnd(
  { paksha: 'Shukla', pakshaIndex: 15 },
  { paksha: 'Krishna', pakshaIndex: 1 }
);

console.log(result); // Should be: true ✅
```

### Test 2: Month-Start Detection

```javascript
import { isTithiMonthStart } from './src/utils/nepaliDateUtils';

// Krishna Pratipada = MONTH START
const result = isTithiMonthStart(
  { paksha: 'Krishna', pakshaIndex: 1 }
);

console.log(result); // Should be: true ✅
```

### Test 3: Full Test Suite

```javascript
// Run the complete test suite
import { runAllTests } from './src/test/tithiMonthTransitionTest';

runAllTests();

// Output should show: 🎉 ALL TESTS PASSED!
```

---

## What Each Helper Function Does

| Function | Takes | Returns | Purpose |
|----------|-------|---------|---------|
| `isTithiMonthEnd()` | current tithi + next tithi | true/false | Is this the end of the month? (Purnima) |
| `isTithiMonthStart()` | current tithi | true/false | Is this the start of the month? (Pratipada) |
| `validateTithiMonthContinuity()` | array of tithis | validation report | Check a sequence follows rules |
| `mapTithiSequenceToMonths()` | array of tithis | mapped array | Show which month each date belongs to |
| `getTestCaseCharitaPurnima2081()` | none | test spec | Get expected behavior for 2081→2082 |

---

## Expected Behavior (2081→2082)

```
═════════════════════════════════════════════════════════════════
Date              Tithi          Paksha   Month  Start?  End?
═════════════════════════════════════════════════════════════════
Chaitra 27        Shukla 12      Shukla   12      -      -
Chaitra 28        Shukla 13      Shukla   12      -      -
Chaitra 29        Shukla 14      Shukla   12      -      -
Chaitra 31        Shukla 15*     Shukla   12      -     ✅YES  ← MONTH ENDS
                  Purnima

Baishakh 1        Krishna 1**    Krishna  1      ✅YES   -     ← MONTH STARTS
                  Pratipada
Baishakh 2        Krishna 2      Krishna  1      -      -
Baishakh 3        Krishna 3      Krishna  1      -      -
═════════════════════════════════════════════════════════════════

*Purnima = last day of current tithi month
**Pratipada = first day of next tithi month
```

---

## Key Insights

✅ **Correct Behavior**:
- Tithi month = 30-day lunar cycle (Krishna 1 → Shukla 15)
- Month changes at pakshya boundary (after Purnima)
- Solar month boundary doesn't force tithi month change
- A tithi month may span TWO solar months

❌ **Wrong Behavior**:
- Tithi month changes when solar month changes
- Month boundaries follow calendar dates
- Tithi month must stay within one solar month

---

## How to Validate Real Tithi Data

Once `getTithisForBsDate()` is fully integrated:

```javascript
// Get 30 consecutive days of tithi data
const tithiSequence = [];
for (let day = 17; day <= 32; day++) {
  const tithi = await getTithisForBsDate(2081, 12, day);
  tithiSequence.push(tithi);
}
for (let day = 1; day <= 17; day++) {
  const tithi = await getTithisForBsDate(2082, 1, day);
  tithiSequence.push(tithi);
}

// Validate continuity
const validation = validateTithiMonthContinuity(tithiSequence);
console.log(validation);

// Check month assignments
const mapping = mapTithiSequenceToMonths(tithiSequence);
console.log(mapping);
```

---

## Files Added

1. **`nepaliDateUtils.js`** - New helper functions:
   - `isTithiMonthEnd()`
   - `isTithiMonthStart()`
   - `validateTithiMonthContinuity()`
   - `mapTithiSequenceToMonths()`
   - `getTestCaseCharitaPurnima2081()`

2. **`TITHI_MONTH_TESTING_GUIDE.md`** - Detailed testing guide

3. **`src/test/tithiMonthTransitionTest.js`** - Runnable test suite with:
   - Mock data for testing
   - 4 complete test cases
   - Can run in Node.js or browser

---

## TL;DR

**To test now**: Run `src/test/tithiMonthTransitionTest.js`  
**To validate logic**: Use `isTithiMonthEnd()` and `isTithiMonthStart()`  
**When full data ready**: Use `validateTithiMonthContinuity()` with real tithis
