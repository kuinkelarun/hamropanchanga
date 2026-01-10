// Quick debug script to test the date conversion issue
// Check what happens when AD date 2085-01-01 is converted to BS

// Simulating the functions from nepaliDateUtils.js
const bsCalendarData = {
  2084: { startAdDate: new Date(2027, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] },
  2085: { startAdDate: new Date(2028, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }
};

function convertAdToBs(year, month, day) {
  const nptOffsetMs = 5.75 * 3600000;
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;

  let bsYear = null, totalDays = 0;
  const keys = Object.keys(bsCalendarData).map(Number).sort((a, b) => a - b);
  
  for (const y of keys) {
    const startAd = bsCalendarData[y].startAdDate;
    const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - nptOffsetMs;

    if (adNptMidnightMs >= startNptMs) {
      bsYear = +y;
      const diffMs = adNptMidnightMs - startNptMs;
      totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    } else break;
  }
  
  if (!bsYear) {
    bsYear = 2084; // minBsYear
    totalDays = 1;
  }
  
  let bsMonth = 1;
  let bsDay = totalDays;
  const months = bsCalendarData[bsYear].daysInMonths;
  
  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { 
      bsMonth = i + 1; 
      break; 
    }
    bsDay -= months[i];
  }
  
  return { year: bsYear, month: bsMonth, day: bsDay };
}

function formatAdDateToNepaliString(adDateStr) {
  if (!adDateStr) return '';
  const [year, month, day] = adDateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  
  const bs = convertAdToBs(year, month - 1, day);
  return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

// Test the problem case
console.log('\n=== Testing year rollover ===');
console.log('AD 2084-12-30 converts to BS:', formatAdDateToNepaliString('2084-12-30'));
console.log('AD 2085-01-01 converts to BS:', formatAdDateToNepaliString('2085-01-01'));
console.log('AD 2085-01-02 converts to BS:', formatAdDateToNepaliString('2085-01-02'));

// The issue: formatAdDateToNepaliString is using 0-indexed months!
// When AD date is 2084-12-30, month=12, but convertAdToBs expects 0-11, so month-1=11
// That's correct. But let's trace through an actual example
console.log('\n=== Detailed trace for AD 2085-01-01 ===');
const [year, month, day] = '2085-01-01'.split('-').map(Number);
console.log('Parsed AD date: year=' + year + ', month=' + month + ', day=' + day);
console.log('Month passed to convertAdToBs: ' + (month - 1) + ' (0-indexed)');
console.log('Result:', convertAdToBs(year, month - 1, day));
