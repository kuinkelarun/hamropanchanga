// Nepali Calendar utilities
const nepaliMonths = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
];

const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const nepaliWeekdays = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
];

const englishWeekdays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const nepaliNumbers = ["०","१","२","३","४","५","६","७","८","९"];

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
  // NOTE: Adjusted startAdDate by +1 day to align BS 2082 mappings with expected AD dates
  2082: { startAdDate: new Date(2025,3,15), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] },
  2083: { startAdDate: new Date(2026,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2084: { startAdDate: new Date(2027,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2085: { startAdDate: new Date(2028,3,13), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] }
};

const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

export function toNepaliNumber(num) {
  return String(num).split('').map(d => nepaliNumbers[+d] ?? d).join('');
}

export function getNepalDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nptOffset = 5.75 * 3600000;
  return new Date(utc + nptOffset);
}

export function convertAdToBs(year, month, day) {
  // Use Nepal Time (NPT) midnight as the reference for a calendar day.
  // This avoids local timezone differences causing off-by-one errors when callers
  // pass Y/M/D values taken from Nepal time or from local time.
  const nptOffsetMs = 5.75 * 3600000; // 5 hours 45 minutes in ms

  // Compute the UTC-milliseconds instant corresponding to NPT midnight for the given Y/M/D
  const adNptMidnightMs = Date.UTC(year, month, day) - nptOffsetMs;

  let bsYear = null, totalDays = 0;

  // Iterate calendar data and compare using NPT-midnight-based instants
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
    bsYear = minBsYear;
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
  
  // Compute dayOfWeek for the AD date represented by this NPT-midnight instant
  const adUtcMsForThis = adNptMidnightMs + nptOffsetMs; // equals Date.UTC(year, month, day)
  const dayOfWeek = new Date(adUtcMsForThis).getUTCDay();

  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

export function convertBsToAd(year, month, day) {
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;

  // totalDays offset from start of BS year
  let totalDays = 0;
  for (let i = 0; i < month - 1; i++) {
    totalDays += bsCalendarData[year].daysInMonths[i];
  }
  totalDays += day - 1;

  // Use NPT-midnight-based math so the returned AD date corresponds to the calendar day
  // that begins at NPT midnight for that BS date.
  const nptOffsetMs = 5.75 * 3600000;
  const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + (totalDays * 24 * 60 * 60 * 1000);

  // Convert back to a canonical AD Y/M/D by adding the NPT offset to get a UTC midnight instant
  const adUtcMs = targetNptMs + nptOffsetMs; // this equals Date.UTC(adYear, adMonth, adDay)
  const adUtcDate = new Date(adUtcMs);

  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth(), day: adUtcDate.getUTCDate() };
}

export function formatNepaliDate(adDate) {
  const bsDate = convertAdToBs(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  const dayOfWeek = adDate.getDay(); // 0=Sunday, 1=Monday, etc.
  
  return {
    nepali: `${toNepaliNumber(bsDate.year)} ${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.day)}`,
    english: `${bsDate.year} ${nepaliMonths[bsDate.month - 1]} ${bsDate.day}`,
    shortNepali: `${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]}`,
    shortEnglish: `${bsDate.day} ${nepaliMonths[bsDate.month - 1]}`,
    withDayNepali: `${nepaliWeekdays[dayOfWeek]}, ${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.year)}`,
    withDayShortNepali: `${nepaliWeekdays[dayOfWeek]}, ${toNepaliNumber(bsDate.day)} ${nepaliMonths[bsDate.month - 1]}`
  };
}

export function formatEnglishDate(adDate) {
  const dayOfWeek = adDate.getDay();
  return {
    short: adDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    full: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    }),
    withDayShort: `${englishWeekdays[dayOfWeek]}, ${adDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })}`,
    withDayFull: `${englishWeekdays[dayOfWeek]}, ${adDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })}`
  };
}

export function formatGregorianMonthYear(adDate) {
  return {
    full: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long'
    }),
    short: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short'
    })
  };
}

export function formatNepaliMonthYear(adDate) {
  const bsDate = convertAdToBs(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  return {
    nepali: `${nepaliMonths[bsDate.month - 1]} ${toNepaliNumber(bsDate.year)}`,
    english: `${nepaliMonths[bsDate.month - 1]} ${bsDate.year}`
  };
}

export { nepaliMonths, englishMonths, nepaliWeekdays, englishWeekdays };