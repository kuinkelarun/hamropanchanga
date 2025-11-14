// Use the updated BS 2082 start date (adjusted to 2025-04-15) for verification
const baseStart = new Date(2025,3,15);
function testOffset(offsetDays){
  const start = new Date(baseStart); start.setDate(start.getDate()+offsetDays);
  const startISO = start.toISOString();
  // compute AD for BS 2082-7-17 using this start
  const bsCalendarData = {2082:{startAdDate:start, daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31]}};
  function convertBsToAd(year, month, day){
    const start = bsCalendarData[year].startAdDate; let total=0; for(let i=0;i<month-1;i++) total+=bsCalendarData[year].daysInMonths[i]; total+=day-1;
    const nptOffsetMs = 5.75*3600000; const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs; const targetNptMs = startNptMs + total*24*3600*1000; const adUtcMs = targetNptMs + nptOffsetMs; const d = new Date(adUtcMs);
    return { iso: d.toISOString(), y:d.getUTCFullYear(), m:d.getUTCMonth()+1, day:d.getUTCDate() };
  }
  console.log('StartAdDate offset', offsetDays, startISO, '-> BS2082-7-17 maps to', convertBsToAd(2082,7,17));
}
for(let off=-2; off<=2; off++) testOffset(off);
