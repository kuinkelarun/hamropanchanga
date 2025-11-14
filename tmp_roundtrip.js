const bsCalendarData = {
  2070: { startAdDate: new Date(2013,3,14), daysInMonths:[31,31,32,31,30,30,30,29,29,29,30,31] },
  2071: { startAdDate: new Date(2014,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] },
  2072: { startAdDate: new Date(2015,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2073: { startAdDate: new Date(2016,3,13), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2074: { startAdDate: new Date(2017,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2075: { startAdDate: new Date(2018,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2076: { startAdDate: new Date(2019,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2077: { startAdDate: new Date(2020,3,13), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2078: { startAdDate: new Date(2021,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2079: { startAdDate: new Date(2022,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2080: { startAdDate: new Date(2023,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2081: { startAdDate: new Date(2024,3,13), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2082: { startAdDate: new Date(2025,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] },
  2083: { startAdDate: new Date(2026,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2084: { startAdDate: new Date(2027,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2085: { startAdDate: new Date(2028,3,13), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] }
};

function convertAdToBs(year, month, day) {
  const nptOffsetMs = 5.75 * 3600000;
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;
  const keys = Object.keys(bsCalendarData).map(Number).sort((a,b)=>a-b);
  let bsYear = null; let totalDays = 0;
  for(const y of keys){
    const start = bsCalendarData[y].startAdDate; const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
    if(adNptMidnightMs >= startNptMs){ bsYear = +y; totalDays = Math.floor((adNptMidnightMs - startNptMs)/(24*3600*1000)) + 1; } else break;
  }
  if(!bsYear){ bsYear = Math.min(...keys); totalDays =1 }
  let bsMonth=1, bsDay = totalDays; const months = bsCalendarData[bsYear].daysInMonths;
  for(let i=0;i<months.length;i++){ if(bsDay<=months[i]){ bsMonth=i+1; break } bsDay -= months[i]; }
  const adUtcMsForThis = adNptMidnightMs + nptOffsetMs; const dayOfWeek = new Date(adUtcMsForThis).getUTCDay();
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

function convertBsToAd(year, month, day){
  const start = bsCalendarData[year].startAdDate; let total=0; for(let i=0;i<month-1;i++) total+=bsCalendarData[year].daysInMonths[i]; total+=day-1;
  const nptOffsetMs = 5.75*3600000; const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + total*24*3600*1000; const adUtcMs = targetNptMs + nptOffsetMs; const adUtcDate = new Date(adUtcMs);
  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth(), day: adUtcDate.getUTCDate() };
}

console.log('Roundtrip test for AD 2025-11-03:');
const ad = {y:2025, m:10, d:3};
const bs = convertAdToBs(ad.y, ad.m, ad.d); console.log('AD->BS', ad, '->', bs);
const back = convertBsToAd(bs.year, bs.month, bs.day); console.log('Back BS->AD', back);

console.log('\nRoundtrip for AD 2025-11-02');
const ad2={y:2025,m:10,d:2}; const bs2=convertAdToBs(ad2.y,ad2.m,ad2.d); console.log('AD->BS',ad2,'->',bs2); const back2=convertBsToAd(bs2.year,bs2.month,bs2.day); console.log('Back', back2);

// check mapping for BS 2082-7-17
console.log('\nDirect BS->AD for 2082-7-17:', convertBsToAd(2082,7,17));
console.log('AD fields expected by user: 2025-11-03');
