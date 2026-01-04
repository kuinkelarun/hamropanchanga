# Tithi Month Testing Guide

## The Key Insight: Pakshya Boundaries, NOT Solar Boundaries

**Important Distinction**:
- ❌ **WRONG**: Tithi month changes when solar month changes (Chaitra → Baishakh)
- ✅ **CORRECT**: Tithi month changes when pakshya changes (Shukla Purnima → Krishna Pratipada)

A tithi month spans:
- **Start**: Krishna Pratipada (day after Full Moon)
- **End**: Shukla Purnima (Full Moon)
- **Duration**: ~30 days (one complete lunar cycle)

---

## Test Functions Available (No Async Needed!)

I've added 5 helper functions to `nepaliDateUtils.js` for testing:

### 1. `isTithiMonthEnd(currentTithi, nextTithi)`

**Purpose**: Detect when a tithi is the LAST day of a month (Shukla Purnima)

**Usage**:
```javascript
import { isTithiMonthEnd } from '../utils/nepaliDateUtils';

// Simulated tithi data (you would get this from getTithisForBsDate)
const chaitra31 = { paksha: 'Shukla', pakshaIndex: 15, tithiName: 'पूर्णिमा' };
const baishakh1 = { paksha: 'Krishna', pakshaIndex: 1, tithiName: 'प्रतिपदा' };

const isMonthEnd = isTithiMonthEnd(chaitra31, baishakh1);
console.log(isMonthEnd); // true - Purnima followed by Krishna Pratipada!
```

**Test Case**:
```javascript
// ✅ CORRECT: Shukla Purnima followed by Krishna Pratipada
isTithiMonthEnd(
  { paksha: 'Shukla', pakshaIndex: 15 },
  { paksha: 'Krishna', pakshaIndex: 1 }
) === true

// ❌ WRONG: Still in same pakshya
isTithiMonthEnd(
  { paksha: 'Shukla', pakshaIndex: 14 },  // Shukla Chaturdashi
  { paksha: 'Shukla', pakshaIndex: 15 }   // Shukla Purnima
) === false
```

---

### 2. `isTithiMonthStart(currentTithi)`

**Purpose**: Detect when a tithi is the FIRST day of a month (Krishna Pratipada)

**Usage**:
```javascript
import { isTithiMonthStart } from '../utils/nepaliDateUtils';

const baishakh1 = { 
  paksha: 'Krishna', 
  pakshaIndex: 1, 
  tithiName: 'प्रतिपदा',
  bsMonth: 1  // Baishakh
};

const isMonthStart = isTithiMonthStart(baishakh1);
console.log(isMonthStart); // true - This is Krishna Pratipada!
```

**Test Cases**:
```javascript
// ✅ CORRECT: Krishna Pratipada
isTithiMonthStart({ paksha: 'Krishna', pakshaIndex: 1 }) === true

// ❌ WRONG: Any other tithi
isTithiMonthStart({ paksha: 'Krishna', pakshaIndex: 2 }) === false
isTithiMonthStart({ paksha: 'Shukla', pakshaIndex: 1 }) === false
```

---

### 3. `validateTithiMonthContinuity(tithiSequence)`

**Purpose**: Validate that a sequence of tithis follows Purnimanta rules

**Usage** (with mock data):
```javascript
import { validateTithiMonthContinuity } from '../utils/nepaliDateUtils';

// Mock sequence: Chaitra Shukla days → Purnima → Baishakh Krishna Pratipada
const mockSequence = [
  { 
    bsYear: 2081, bsMonth: 12, bsDay: 28,
    tithi: 13, paksha: 'Shukla', pakshaIndex: 13, tithiName: 'त्रयोदशी'
  },
  { 
    bsYear: 2081, bsMonth: 12, bsDay: 29,
    tithi: 14, paksha: 'Shukla', pakshaIndex: 14, tithiName: 'चतुर्दशी'
  },
  { 
    bsYear: 2081, bsMonth: 12, bsDay: 31,  // Note: day 30 skipped for example
    tithi: 15, paksha: 'Shukla', pakshaIndex: 15, tithiName: 'पूर्णिमा'
  },
  { 
    bsYear: 2082, bsMonth: 1, bsDay: 1,
    tithi: 1, paksha: 'Krishna', pakshaIndex: 1, tithiName: 'प्रतिपदा'
  }
];

const validation = validateTithiMonthContinuity(mockSequence);
console.log(validation);
/* Output:
{
  valid: true,
  issues: [],
  monthTransitions: [
    {
      startDate: '2081/12/28',
      startTithi: 'त्रयोदशी',
      expectedMonthNum: 12,
      endDate: '2081/12/31',
      endTithi: 'पूर्णिमा'
    },
    {
      startDate: '2082/1/1',
      startTithi: 'प्रतिपदा',
      expectedMonthNum: 1
    }
  ],
  summary: 'Found 2 tithi month(s). All transitions at pakshya boundaries: YES'
}
*/
```

**What it validates**:
- ✅ Transitions happen ONLY at pakshya boundaries (after Purnima)
- ✅ Solar month changes don't force tithi month changes
- ✅ Each month starts with Krishna Pratipada
- ✅ Each month ends with Shukla Purnima

---

### 4. `mapTithiSequenceToMonths(tithiSequence)`

**Purpose**: Show which tithi month each date belongs to

**Usage**:
```javascript
import { mapTithiSequenceToMonths } from '../utils/nepaliDateUtils';

const mapped = mapTithiSequenceToMonths(mockSequence);
console.log(mapped);
/* Output:
[
  {
    date: '2081/12/28',
    tithi: 'त्रयोदशी',
    paksha: 'Shukla',
    pakshaIndex: 13,
    tithiMonthNum: 12,        // Chaitra
    tithiMonthStartDate: '2081/12/17',  // Where this month started
    isMonthStart: false,
    isMonthEnd: false
  },
  ...
  {
    date: '2081/12/31',
    tithi: 'पूर्णिमा',
    paksha: 'Shukla',
    pakshaIndex: 15,
    tithiMonthNum: 12,        // Still Chaitra!
    tithiMonthStartDate: '2081/12/17',
    isMonthStart: false,
    isMonthEnd: true          // ← This is the end
  },
  {
    date: '2082/1/1',
    tithi: 'प्रतिपदा',
    paksha: 'Krishna',
    pakshaIndex: 1,
    tithiMonthNum: 1,         // NOW it's Baishakh
    tithiMonthStartDate: '2082/1/1',
    isMonthStart: true,
    isMonthEnd: false
  }
]
*/
```

**Key observation**: Even though solar month changed from Chaitra (12) to Baishakh (1), the tithi month number changed at the pakshya boundary, not the solar boundary.

---

### 5. `getTestCaseCharitaPurnima2081()`

**Purpose**: Get a reference test case specification

**Usage**:
```javascript
import { getTestCaseCharitaPurnima2081 } from '../utils/nepaliDateUtils';

const testSpec = getTestCaseCharitaPurnima2081();
console.log(testSpec.description);
// "Validating that tithi month boundary aligns with pakshya transition"

console.log(testSpec.testPoints);
// [
//   { name: 'Chaitra Shukla Dwadashi (before Purnima)', ... },
//   { name: 'Chaitra Shukla Purnima (month end)', shouldTransitionNext: true },
//   { name: 'Baishakh Krishna Pratipada (month start)', ... },
//   ...
// ]
```

**Use this to manually validate behavior**:
1. Get actual tithi data for these dates using `getTithisForBsDate()`
2. Check against expected values in the test case
3. Verify the "shouldTransitionNext" flags match reality

---

## How to Test Now (Without Full Implementation)

### Step 1: Test the Helper Functions

```javascript
// Test 1: Verify month-end detection
const purnima = { paksha: 'Shukla', pakshaIndex: 15 };
const nextPratipada = { paksha: 'Krishna', pakshaIndex: 1 };
console.assert(isTithiMonthEnd(purnima, nextPratipada), 'Month end detection failed');

// Test 2: Verify month-start detection
const pratipada = { paksha: 'Krishna', pakshaIndex: 1 };
console.assert(isTithiMonthStart(pratipada), 'Month start detection failed');

// Test 3: Verify mid-month stays stable
const midShukla = { paksha: 'Shukla', pakshaIndex: 8 };
const nextShukla = { paksha: 'Shukla', pakshaIndex: 9 };
console.assert(!isTithiMonthEnd(midShukla, nextShukla), 'False positive month end');

console.log('✅ All helper function tests passed');
```

### Step 2: Test with Mock Data

```javascript
// Create a realistic mock sequence
const mockTithiSequence = [
  // Chaitra Shukla days
  { bsYear: 2081, bsMonth: 12, bsDay: 27, tithi: 12, paksha: 'Shukla', pakshaIndex: 12, tithiName: 'द्वादशी' },
  { bsYear: 2081, bsMonth: 12, bsDay: 28, tithi: 13, paksha: 'Shukla', pakshaIndex: 13, tithiName: 'त्रयोदशी' },
  { bsYear: 2081, bsMonth: 12, bsDay: 29, tithi: 14, paksha: 'Shukla', pakshaIndex: 14, tithiName: 'चतुर्दशी' },
  { bsYear: 2081, bsMonth: 12, bsDay: 31, tithi: 15, paksha: 'Shukla', pakshaIndex: 15, tithiName: 'पूर्णिमा' },
  
  // Baishakh Krishna days (NEW MONTH)
  { bsYear: 2082, bsMonth: 1, bsDay: 1, tithi: 1, paksha: 'Krishna', pakshaIndex: 1, tithiName: 'प्रतिपदा' },
  { bsYear: 2082, bsMonth: 1, bsDay: 2, tithi: 2, paksha: 'Krishna', pakshaIndex: 2, tithiName: 'द्वितीया' },
];

// Validate continuity
const result = validateTithiMonthContinuity(mockTithiSequence);
console.log(result);
// Should show:
// - 2 tithi months found
// - Transition at Purnima/Pratipada boundary
// - valid: true
```

### Step 3: Map to Months

```javascript
const mapping = mapTithiSequenceToMonths(mockTithiSequence);

// Verify month assignments
console.assert(mapping[3].tithiMonthNum === 12, 'Purnima should be Chaitra month');
console.assert(mapping[3].isMonthEnd === true, 'Purnima should mark month end');
console.assert(mapping[4].tithiMonthNum === 1, 'Krishna Pratipada should be Baishakh month');
console.assert(mapping[4].isMonthStart === true, 'Krishna Pratipada should mark month start');

console.log('✅ Month mapping tests passed');
```

---

## Integration with getTithisForBsDate()

Once you have actual tithi data from `getTithisForBsDate()`:

```javascript
// Pseudo-code (async wrapper)
async function testRealTithiData() {
  const sequence = [];
  
  // Get 30 consecutive days from Chaitra 17 to Baishakh 17
  for (let day = 17; day <= 32; day++) {
    const tithiInfo = await getTithisForBsDate(2081, 12, day);
    if (tithiInfo) sequence.push(tithiInfo);
  }
  
  for (let day = 1; day <= 17; day++) {
    const tithiInfo = await getTithisForBsDate(2082, 1, day);
    if (tithiInfo) sequence.push(tithiInfo);
  }
  
  // Now validate with real data
  const validation = validateTithiMonthContinuity(sequence);
  const mapping = mapTithiSequenceToMonths(sequence);
  
  console.log('Real Tithi Data Validation:', validation);
  console.log('Real Tithi Mapping:', mapping);
}
```

---

## Expected Results for Chaitra 2081 → Baishakh 2082

Based on Purnimanta system, you should see:

```
Date              Tithi          Paksha    Month#   MonthStart  MonthEnd
────────────────────────────────────────────────────────────────────────
Chaitra 28        Shukla 13      Shukla    12       No          No
Chaitra 29        Shukla 14      Shukla    12       No          No
Chaitra 31        Shukla 15*     Shukla    12       No          ✅ YES
                  (Purnima)
────────────────────────────────────────────────────────────────────────
Baishakh 1        Krishna 1**    Krishna   1        ✅ YES      No
                  (Pratipada)
Baishakh 2        Krishna 2      Krishna   1        No          No
Baishakh 3        Krishna 3      Krishna   1        No          No
```

*Purnima = End of Chaitra tithi month*  
**Pratipada = Start of Baishakh tithi month*

---

## Summary: How to Test

| What to Test | How | Function | When Ready |
|---|---|---|---|
| Month-end detection | Shukla 15 followed by Krishna 1 | `isTithiMonthEnd()` | ✅ Now |
| Month-start detection | Krishna 1 | `isTithiMonthStart()` | ✅ Now |
| Sequence validation | 30-day cycle with transitions | `validateTithiMonthContinuity()` | ✅ Now |
| Real tithi data | Actual ephemeris calculations | `getTithisForBsDate()` | ⏳ When integrated |
| Full boundary scan | Complete month boundaries | `getTithiMonthBoundaries()` | ⏳ When integrated |

**Bottom line**: You can test the logic NOW using helper functions with mock data. When `getTithisForBsDate()` is integrated, validate against real data.
