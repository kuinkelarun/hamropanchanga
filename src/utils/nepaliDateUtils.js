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
  2082: { startAdDate: new Date(2025,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] },
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
  const adDate = new Date(year, month, day);
  let bsYear = null, totalDays = 0;
  
  for (const y of Object.keys(bsCalendarData).sort()) {
    const startAd = bsCalendarData[y].startAdDate;
    if (adDate >= startAd) {
      bsYear = +y;
      totalDays = Math.floor((adDate - startAd) / (1000*60*60*24)) + 1;
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
  
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek: adDate.getDay() };
}

export function convertBsToAd(year, month, day) {
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;
  
  let totalDays = 0;
  for (let i = 0; i < month - 1; i++) {
    totalDays += bsCalendarData[year].daysInMonths[i];
  }
  totalDays += day - 1;
  
  const adDate = new Date(start);
  adDate.setDate(start.getDate() + totalDays);
  
  return { year: adDate.getFullYear(), month: adDate.getMonth(), day: adDate.getDate() };
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
  return {
    short: adDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    full: adDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
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