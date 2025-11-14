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

function convertBsToAd(year, month, day){
  const start = bsCalendarData[year]?.startAdDate; if(!start) return null;
  let totalDays = 0; for(let i=0;i<month-1;i++) totalDays += bsCalendarData[year].daysInMonths[i];
  totalDays += day-1;
  const nptOffsetMs = 5.75 * 3600000;
  const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + (totalDays * 24 * 60 * 60 * 1000);
  const adUtcMs = targetNptMs + nptOffsetMs;
  const adUtcDate = new Date(adUtcMs);
  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth(), day: adUtcDate.getUTCDate() };
}

const bsYear = 2082, bsMonth = 7, bsDay = 17;
console.log('BS', bsYear, bsMonth, bsDay, '->', convertBsToAd(bsYear, bsMonth, bsDay));

// Also test other nearby values
for (let d=15; d<=19; d++){
  console.log('BS 2082-7-'+d, '->', convertBsToAd(2082,7,d));
}

// Also compute NPT midnight for target
function adForBs(year, month, day){
  const start = bsCalendarData[year].startAdDate; let total=0; for(let i=0;i<month-1;i++) total+=bsCalendarData[year].daysInMonths[i]; total+=day-1;
  const nptOffsetMs = 5.75*3600000; const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs; const targetNptMs = startNptMs + total*24*60*60*1000; const adUtcMs = targetNptMs + nptOffsetMs; const adUtcDate = new Date(adUtcMs);
  console.log('Computed AD date (UTC fields):', adUtcDate.toISOString(), 'UTC YMD:', adUtcDate.getUTCFullYear(), adUtcDate.getUTCMonth()+1, adUtcDate.getUTCDate());
}
adForBs(2082,7,17);
