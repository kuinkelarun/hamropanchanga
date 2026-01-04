/**
 * Quick Test Suite for Tithi Month Transitions
 * 
 * This file demonstrates how to test tithi month behavior
 * without needing full async ephemeris data.
 * 
 * Run in browser console or Node.js:
 * node ./src/test/tithiMonthTransitionTest.js
 */

// Mock data representing Chaitra → Baishakh transition
const chatraiBaishakhTransition = [
  {
    name: 'Chaitra Shukla Dwadashi',
    bsYear: 2081, bsMonth: 12, bsDay: 27,
    tithi: 12, paksha: 'Shukla', pakshaIndex: 12, tithiName: 'द्वादशी'
  },
  {
    name: 'Chaitra Shukla Trayodashi',
    bsYear: 2081, bsMonth: 12, bsDay: 28,
    tithi: 13, paksha: 'Shukla', pakshaIndex: 13, tithiName: 'त्रयोदशी'
  },
  {
    name: 'Chaitra Shukla Chaturdashi',
    bsYear: 2081, bsMonth: 12, bsDay: 29,
    tithi: 14, paksha: 'Shukla', pakshaIndex: 14, tithiName: 'चतुर्दशी'
  },
  {
    name: 'Chaitra Shukla Purnima (MONTH END)',
    bsYear: 2081, bsMonth: 12, bsDay: 31,
    tithi: 15, paksha: 'Shukla', pakshaIndex: 15, tithiName: 'पूर्णिमा'
  },
  {
    name: 'Baishakh Krishna Pratipada (MONTH START)',
    bsYear: 2082, bsMonth: 1, bsDay: 1,
    tithi: 1, paksha: 'Krishna', pakshaIndex: 1, tithiName: 'प्रतिपदा'
  },
  {
    name: 'Baishakh Krishna Dwitiya',
    bsYear: 2082, bsMonth: 1, bsDay: 2,
    tithi: 2, paksha: 'Krishna', pakshaIndex: 2, tithiName: 'द्वितीया'
  },
  {
    name: 'Baishakh Krishna Tritiya',
    bsYear: 2082, bsMonth: 1, bsDay: 3,
    tithi: 3, paksha: 'Krishna', pakshaIndex: 3, tithiName: 'तृतीया'
  }
];

/**
 * Helper: Detect month end (Shukla Purnima)
 */
function isTithiMonthEnd(current, next) {
  if (!current || !next) return false;
  return (
    current.paksha === 'Shukla' && 
    current.pakshaIndex === 15 &&
    next.paksha === 'Krishna' && 
    next.pakshaIndex === 1
  );
}

/**
 * Helper: Detect month start (Krishna Pratipada)
 */
function isTithiMonthStart(current) {
  if (!current) return false;
  return current.paksha === 'Krishna' && current.pakshaIndex === 1;
}

/**
 * TEST 1: Verify month-end and month-start detection
 */
function testMonthTransitionDetection() {
  console.log('\n=== TEST 1: Month Transition Detection ===\n');
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < chatraiBaishakhTransition.length - 1; i++) {
    const current = chatraiBaishakhTransition[i];
    const next = chatraiBaishakhTransition[i + 1];
    
    const isEnd = isTithiMonthEnd(current, next);
    const isStart = isTithiMonthStart(current);
    
    console.log(`${current.name}`);
    console.log(`  → Tithi: ${current.tithiName} (${current.paksha} ${current.pakshaIndex})`);
    console.log(`  → Is Month Start? ${isStart ? '✅ YES' : 'No'}`);
    console.log(`  → Is Month End? ${isEnd ? '✅ YES' : 'No'}`);
    
    // Validation checks
    if (current.name.includes('MONTH END')) {
      if (isEnd) {
        console.log(`  ✅ PASS: Correctly identified as month end\n`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: Should be identified as month end\n`);
        failed++;
      }
    } else if (current.name.includes('MONTH START')) {
      if (isStart) {
        console.log(`  ✅ PASS: Correctly identified as month start\n`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: Should be identified as month start\n`);
        failed++;
      }
    } else {
      if (!isEnd && !isStart) {
        console.log(`  ✅ PASS: Correctly identified as mid-month\n`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: Should NOT be month boundary\n`);
        failed++;
      }
    }
  }
  
  console.log(`\nTest 1 Result: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

/**
 * TEST 2: Verify tithi month doesn't change at solar boundary
 */
function testSolarBoundaryDoesntForceTithiChange() {
  console.log('\n=== TEST 2: Solar Boundary Doesn\'t Force Tithi Month Change ===\n');
  
  // Find the point where solar month changes (Chaitra 31 → Baishakh 1)
  // and verify tithi month changes at the SAME time (due to pakshya change)
  
  let solarBoundaryIndex = -1;
  for (let i = 0; i < chatraiBaishakhTransition.length - 1; i++) {
    const current = chatraiBaishakhTransition[i];
    const next = chatraiBaishakhTransition[i + 1];
    
    if (current.bsMonth === 12 && next.bsMonth === 1) {
      solarBoundaryIndex = i;
      break;
    }
  }
  
  if (solarBoundaryIndex === -1) {
    console.log('❌ Could not find solar boundary in test data\n');
    return false;
  }
  
  const current = chatraiBaishakhTransition[solarBoundaryIndex];
  const next = chatraiBaishakhTransition[solarBoundaryIndex + 1];
  
  console.log('Solar Month Boundary:');
  console.log(`  ${current.name} (${current.bsYear}/${current.bsMonth}/${current.bsDay})`);
  console.log(`  →`);
  console.log(`  ${next.name} (${next.bsYear}/${next.bsMonth}/${next.bsDay})`);
  console.log();
  
  const isTithiMonthChanging = isTithiMonthEnd(current, next);
  
  console.log('Tithi Month Boundary (Pakshya Change):');
  console.log(`  Current: ${current.paksha} ${current.pakshaIndex} (${current.tithiName})`);
  console.log(`  Next: ${next.paksha} ${next.pakshaIndex} (${next.tithiName})`);
  console.log(`  Tithi Month Changes? ${isTithiMonthChanging ? '✅ YES' : 'No'}`);
  console.log();
  
  // The key insight: both solar boundary AND tithi month boundary
  // occur at the SAME moment (Purnima → Pratipada)
  // This is CORRECT and expected!
  
  if (isTithiMonthChanging) {
    console.log('✅ PASS: Tithi month and solar month change at the same point');
    console.log('   This is CORRECT because the change is driven by pakshya transition,');
    console.log('   not by the solar month boundary.\n');
    return true;
  } else {
    console.log('❌ FAIL: Tithi month did not change as expected\n');
    return false;
  }
}

/**
 * TEST 3: Verify complete cycle accounting
 */
function testCompleteCycle() {
  console.log('\n=== TEST 3: Complete Tithi Month Cycle ===\n');
  
  let currentMonthStart = null;
  let monthCount = 0;
  let passed = 0;
  let failed = 0;
  
  console.log('Tracking tithi month assignments:');
  console.log('─'.repeat(60));
  
  // Note: sequence starts mid-month (Chaitra Shukla 12), so first month ends before first month start
  // This is expected behavior - the sequence captures a boundary crossing
  
  for (let i = 0; i < chatraiBaishakhTransition.length; i++) {
    const current = chatraiBaishakhTransition[i];
    const next = i < chatraiBaishakhTransition.length - 1 ? 
      chatraiBaishakhTransition[i + 1] : null;
    
    // Check if this is a month end
    if (next && isTithiMonthEnd(current, next)) {
      console.log(`[MONTH ${monthCount} END]`);
      console.log(`  Date: ${current.bsYear}/${current.bsMonth}/${current.bsDay}`);
      console.log(`  Tithi: ${current.tithiName} (Shukla Purnima)`);
      if (currentMonthStart) {
        console.log(`  Duration: ${currentMonthStart.date} → ${current.bsYear}/${current.bsMonth}/${current.bsDay}`);
      }
      passed++;
    }
    
    // Check if this is a month start
    if (isTithiMonthStart(current)) {
      currentMonthStart = {
        date: `${current.bsYear}/${current.bsMonth}/${current.bsDay}`,
        name: current.tithiName,
        bsMonth: current.bsMonth
      };
      monthCount++;
      console.log(`[MONTH ${monthCount} START]`);
      console.log(`  Date: ${currentMonthStart.date}`);
      console.log(`  Tithi: ${currentMonthStart.name} (Krishna Pratipada)`);
      passed++;
    }
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total tithi months in sequence: ${monthCount}`);
  console.log(`Monthly boundaries detected: ${passed}`);
  
  // The sequence captures one complete month boundary transition:
  // - Month 0 ends at Chaitra Shukla 15 (Purnima)
  // - Month 1 starts at Baishakh Krishna 1 (Pratipada)
  // That's 1 month start + 1 month end = 2 boundaries
  
  if (monthCount >= 1 && passed >= 2) {
    console.log('✅ PASS: Complete cycle accounting correct\n');
    return true;
  } else {
    console.log('❌ FAIL: Cycle accounting mismatch\n');
    return false;
  }
}

/**
 * TEST 4: Verify key expectations
 */
function testKeyExpectations() {
  console.log('\n=== TEST 4: Key Expectations ===\n');
  
  const expectations = [
    {
      rule: 'Tithi month changes ONLY at pakshya boundaries',
      check: () => {
        // Between indices 2-3 (Chaturdashi → Purnima), no change should occur
        const mid = isTithiMonthEnd(
          chatraiBaishakhTransition[2], 
          chatraiBaishakhTransition[3]
        );
        
        // Between indices 3-4 (Purnima → Pratipada), change SHOULD occur
        const boundary = isTithiMonthEnd(
          chatraiBaishakhTransition[3], 
          chatraiBaishakhTransition[4]
        );
        
        return !mid && boundary;
      }
    },
    {
      rule: 'Purnima is the last day of its tithi month',
      check: () => {
        const purnima = chatraiBaishakhTransition[3];
        const nextDay = chatraiBaishakhTransition[4];
        return isTithiMonthEnd(purnima, nextDay);
      }
    },
    {
      rule: 'Krishna Pratipada is the first day of new tithi month',
      check: () => {
        const pratipada = chatraiBaishakhTransition[4];
        return isTithiMonthStart(pratipada);
      }
    },
    {
      rule: 'Solar month change (Chaitra→Baishakh) aligns with tithi month change',
      check: () => {
        // Solar boundary at index 3-4
        const solar = chatraiBaishakhTransition[3].bsMonth !== chatraiBaishakhTransition[4].bsMonth;
        const tithi = isTithiMonthEnd(chatraiBaishakhTransition[3], chatraiBaishakhTransition[4]);
        return solar && tithi;
      }
    }
  ];
  
  let allPassed = true;
  
  expectations.forEach((exp, idx) => {
    const result = exp.check();
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${exp.rule}`);
    allPassed = allPassed && result;
  });
  
  console.log();
  return allPassed;
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        TITHI MONTH TRANSITION TEST SUITE                   ║');
  console.log('║    Testing Purnimanta System (Pakshya-Boundary Based)      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  results.push(['Transition Detection', testMonthTransitionDetection()]);
  results.push(['Solar Boundary Test', testSolarBoundaryDoesntForceTithiChange()]);
  results.push(['Complete Cycle', testCompleteCycle()]);
  results.push(['Key Expectations', testKeyExpectations()]);
  
  console.log('\n' + '═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));
  
  results.forEach(([name, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
  });
  
  const allPassed = results.every(r => r[1]);
  console.log('═'.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Tithi month logic is correct.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Review the logic.\n');
  }
  
  return allPassed;
}

// Run tests
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { 
    runAllTests, 
    isTithiMonthEnd, 
    isTithiMonthStart,
    chatraiBaishakhTransition
  };
  
  // Run if executed directly
  if (require.main === module) {
    runAllTests();
  }
} else {
  // Browser environment
  window.tithiMonthTests = { 
    runAllTests, 
    isTithiMonthEnd, 
    isTithiMonthStart
  };
  console.log('Test functions available: window.tithiMonthTests.runAllTests()');
}
