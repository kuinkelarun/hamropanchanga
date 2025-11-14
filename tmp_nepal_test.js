// Quick test script to reproduce NPT and conversion
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

function getNepalDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nptOffset = 5.75 * 3600000;
  return new Date(utc + nptOffset);
}

function convertAdToBs(year, month, day) {
  const nptOffsetMs = 5.75 * 3600000;
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;

  let bsYear = null, totalDays = 0;
  const keys = Object.keys(bsCalendarData).map(Number).sort((a,b)=>a-b);
  for (const y of keys) {
    const startAd = bsCalendarData[y].startAdDate;
    const startNptMs = Date.UTC(startAd.getFullYear(), startAd.getMonth(), startAd.getDate()) - nptOffsetMs;
    if (adNptMidnightMs >= startNptMs) {
      bsYear = +y;
      const diffMs = adNptMidnightMs - startNptMs;
      totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    } else break;
  }
  if (!bsYear) { bsYear = Math.min(...keys); totalDays = 1 }
  let bsMonth = 1, bsDay = totalDays;
  const months = bsCalendarData[bsYear].daysInMonths;
  for (let i=0;i<months.length;i++){
    if (bsDay <= months[i]) { bsMonth = i+1; break }
    bsDay -= months[i];
  }

  // Determine dayOfWeek relative to the NPT-based ad date
  const adUtcMs = adNptMidnightMs + nptOffsetMs; // equals Date.UTC(year,month,day)
  const dayOfWeek = new Date(adUtcMs).getUTCDay();
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

// Run checks
const now = new Date();
console.log('Local now:', now.toString());
console.log('Local ISO:', now.toISOString());

const nptNow = getNepalDate();
console.log('NPT now (constructed):', nptNow.toString());
console.log('NPT fields: Y M D hour minute sec =>', nptNow.getFullYear(), nptNow.getMonth()+1, nptNow.getDate(), nptNow.getHours(), nptNow.getMinutes(), nptNow.getSeconds());

const bsFromNpt = convertAdToBs(nptNow.getFullYear(), nptNow.getMonth(), nptNow.getDate());
console.log('convertAdToBs(NPT fields):', bsFromNpt);

// Also try using local date's fields
const bsFromLocal = convertAdToBs(now.getFullYear(), now.getMonth(), now.getDate());
console.log('convertAdToBs(local fields):', bsFromLocal);

// Also show convertBsToAd for the bs result
function convertBsToAd(year, month, day){
  const start = bsCalendarData[year]?.startAdDate; if(!start) return null;
  let totalDays = 0; for(let i=0;i<month-1;i++) totalDays += bsCalendarData[year].daysInMonths[i];
  totalDays += day-1;
  const nptOffsetMs = 5.75 * 3600000;
  const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + (totalDays * 24 * 60 * 60 * 1000);
  const adUtcMs = targetNptMs + nptOffsetMs;
  const adUtcDate = new Date(adUtcMs);
  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth()+1, day: adUtcDate.getUTCDate() };
}

console.log('Back convert convertBsToAd(bsFromNpt):', convertBsToAd(bsFromNpt.year, bsFromNpt.month, bsFromNpt.day));
console.log('Back convert convertBsToAd(bsFromLocal):', convertBsToAd(bsFromLocal.year, bsFromLocal.month, bsFromLocal.day));

// Check NPT midnight vs local midnight milliseconds
const nptMidnight = new Date(Date.UTC(nptNow.getUTCFullYear(), nptNow.getUTCMonth(), nptNow.getUTCDate()));
console.log('nptMidnight (UTC constructed):', nptMidnight.toString(), nptMidnight.toISOString());

const localMidnightFromNptFields = new Date(nptNow.getFullYear(), nptNow.getMonth(), nptNow.getDate());
console.log('localMidnightFromNptFields:', localMidnightFromNptFields.toString(), localMidnightFromNptFields.toISOString());

console.log('\nAlso test yesterday and tomorrow NPT fields:');
const yesterdayNpt = new Date(nptNow.getTime()); yesterdayNpt.setDate(yesterdayNpt.getDate()-1);
const tomorrowNpt = new Date(nptNow.getTime()); tomorrowNpt.setDate(tomorrowNpt.getDate()+1);
console.log('yesterdayNpt fields:', yesterdayNpt.getFullYear(), yesterdayNpt.getMonth()+1, yesterdayNpt.getDate());
console.log('convertAdToBs(yesterdayNpt):', convertAdToBs(yesterdayNpt.getFullYear(), yesterdayNpt.getMonth(), yesterdayNpt.getDate()));
console.log('tomorrowNpt fields:', tomorrowNpt.getFullYear(), tomorrowNpt.getMonth()+1, tomorrowNpt.getDate());
console.log('convertAdToBs(tomorrowNpt):', convertAdToBs(tomorrowNpt.getFullYear(), tomorrowNpt.getMonth(), tomorrowNpt.getDate()));
