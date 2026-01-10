// Minimal test to understand the year rollover issue

// Simple conversion (mimics formatNepaliDateTime behavior)
function testNptShift(utcIsoStr) {
  const utcDate = new Date(utcIsoStr);
  const nptOffsetMs = 5.75 * 3600000;  // 5 hours 45 minutes
  const nptShifted = new Date(utcDate.getTime() + nptOffsetMs);
  
  const adDateIso = nptShifted.toISOString().split('T')[0];
  
  console.log(`UTC: ${utcIsoStr}`);
  console.log(`NPT offset: ${nptOffsetMs / 3600000} hours`);
  console.log(`NPT shifted (raw date object): ${nptShifted.toISOString()}`);
  console.log(`AD Date Iso (from NPT shifted): ${adDateIso}`);
  console.log();
  
  return adDateIso;
}

console.log('=== Testing year rollover scenarios ===\n');

// These are times where a tithi might end
testNptShift('2084-12-30T14:17:00Z');  // Mid-day Dec 30
testNptShift('2084-12-31T02:15:00Z');  // Early Jan 1 UTC = Late Dec 31 NPT
testNptShift('2085-01-01T02:15:00Z');  // Early Jan 1 UTC = Late Dec 31 NPT... wait that's past year boundary!

console.log('Testing problematic boundary:\n');
testNptShift('2084-12-31T18:15:00Z');  // Should be Jan 1 in NPT
testNptShift('2085-01-01T02:45:00Z');  // Should be Jan 1 later in NPT

