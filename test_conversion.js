// Test the specific date conversion that's failing

const testBsData = {
  2084: { startAdDate: new Date(2027, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
  2085: { startAdDate: new Date(2028, 3, 13), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] }
};

function convertAdToBs(year, month, day) {
  const nptOffsetMs = 5.75 * 3600000;
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;
  
  console.log(`Converting AD: ${year}-${month+1}-${day}`);
  console.log(`  UTC: ${new Date(Date.UTC(year, month, day)).toISOString()}`);
  console.log(`  NPT midnight MS: ${adNptMidnightMs}`);
  console.log(`  NPT shifted date: ${new Date(adNptMidnightMs).toISOString()}`);

  let bsYear = null, totalDays = 0;
  const keys = Object.keys(testBsData).map(Number).sort((a, b) => a - b);
  
  for (const y of keys) {
    const startAd = testBsData[y].startAdDate;
    const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - nptOffsetMs;
    
    console.log(`  Checking BS ${y}: starts at AD ${startAd.toISOString()}, NPT MS ${startNptMs}`);

    if (adNptMidnightMs >= startNptMs) {
      bsYear = +y;
      const diffMs = adNptMidnightMs - startNptMs;
      totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      console.log(`    ✓ Selected: diffMs=${diffMs}, totalDays=${totalDays}`);
    } else {
      console.log(`    ✗ Not in range`);
      break;
    }
  }
  
  let bsMonth = 1;
  let bsDay = totalDays;
  const months = testBsData[bsYear].daysInMonths;
  
  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { 
      bsMonth = i + 1; 
      break; 
    }
    bsDay -= months[i];
  }
  
  const result = { year: bsYear, month: bsMonth, day: bsDay };
  console.log(`  Result: BS ${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}\n`);
  return result;
}

// Test cases
console.log('=== Testing problematic date ===\n');
convertAdToBs(2084, 11, 30);  // AD 2084-12-30
convertAdToBs(2085, 0, 1);    // AD 2085-01-01
convertAdToBs(2085, 0, 2);    // AD 2085-01-02
