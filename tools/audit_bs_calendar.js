const fs = require('fs');
const vm = require('vm');
const path = require('path');

const utilsPath = path.resolve(__dirname, '..', 'src', 'utils', 'nepaliDateUtils.js');
const utilsSource = fs.readFileSync(utilsPath, 'utf8');

// Extract bsCalendarData object text via balanced-brace scan
const marker = 'const bsCalendarData';
const idx = utilsSource.indexOf(marker);
if (idx === -1) {
  console.error('Failed to find bsCalendarData in', utilsPath);
  process.exit(2);
}
const startBrace = utilsSource.indexOf('{', idx);
if (startBrace === -1) { console.error('No opening brace found'); process.exit(2); }
let depth = 0; let endIndex = -1;
for (let i = startBrace; i < utilsSource.length; i++) {
  const ch = utilsSource[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { endIndex = i; break; }
  }
}
if (endIndex === -1) { console.error('Could not find matching closing brace for bsCalendarData'); process.exit(2); }
const bsText = utilsSource.slice(startBrace, endIndex + 1);

// Evaluate bsCalendarData in a sandbox (Date is available)
const sandbox = { Date, console };
vm.createContext(sandbox);
const scriptText = 'bsCalendarData = ' + bsText + ';';
try {
  vm.runInContext(scriptText, sandbox);
} catch (e) {
  console.error('Failed to eval bsCalendarData:', e);
  process.exit(2);
}
const bsCalendarData = sandbox.bsCalendarData;

// Conversion functions (mirroring src/utils/nepaliDateUtils.js logic using NPT-midnight math)
function convertBsToAd(year, month, day) {
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;
  let totalDays = 0;
  for (let i = 0; i < month - 1; i++) {
    totalDays += bsCalendarData[year].daysInMonths[i];
  }
  totalDays += day - 1;
  const nptOffsetMs = 5.75 * 3600000;
  const startNptMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - nptOffsetMs;
  const targetNptMs = startNptMs + (totalDays * 24 * 60 * 60 * 1000);
  const adUtcMs = targetNptMs + nptOffsetMs; // equals Date.UTC(adYear, adMonth, adDay)
  const adUtcDate = new Date(adUtcMs);
  return { year: adUtcDate.getUTCFullYear(), month: adUtcDate.getUTCMonth(), day: adUtcDate.getUTCDate() };
}

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
    bsYear = Math.min(...keys);
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
  const adUtcMsForThis = adNptMidnightMs + nptOffsetMs;
  const dayOfWeek = new Date(adUtcMsForThis).getUTCDay();
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek };
}

// Audit: iterate every BS date defined by bsCalendarData and check round-trip
const report = {
  totalChecked: 0,
  mismatches: [],
  continuityIssues: []
};

const years = Object.keys(bsCalendarData).map(Number).sort((a,b)=>a-b);
for (const y of years) {
  const months = bsCalendarData[y].daysInMonths;
  for (let m = 1; m <= months.length; m++) {
    const daysInM = months[m-1];
    for (let d = 1; d <= daysInM; d++) {
      report.totalChecked++;
      const ad = convertBsToAd(y, m, d);
      if (!ad) { report.mismatches.push({ bs: {y,m,d}, reason: 'no-ad' }); continue; }
      const bs2 = convertAdToBs(ad.year, ad.month, ad.day);
      // convertAdToBs returns month as 1-based bsMonth, bsYear as year
      if (!(bs2.year === y && bs2.month === m && bs2.day === d)) {
        report.mismatches.push({ bs: {y,m,d}, ad, roundtrip: bs2 });
      }
    }
  }
}

// Continuity check: ensure AD date increments by 1 between consecutive BS days
function nextBs(y,m,d) {
  const months = bsCalendarData[y].daysInMonths;
  if (d < months[m-1]) return {y,m,d:d+1};
  // roll to next month
  if (m < months.length) return {y,m:m+1,d:1};
  // roll to next year
  const idx = years.indexOf(y);
  const nextYear = years[idx+1];
  if (!nextYear) return null;
  return { y: nextYear, m:1, d:1 };
}

for (const y of years) {
  const months = bsCalendarData[y].daysInMonths;
  for (let m = 1; m <= months.length; m++) {
    for (let d = 1; d <= months[m-1]; d++) {
      const ad = convertBsToAd(y,m,d);
      const nx = nextBs(y,m,d);
      if (!nx) continue;
      const adNext = convertBsToAd(nx.y, nx.m, nx.d);
      const adDate = Date.UTC(ad.year, ad.month, ad.day);
      const adNextDate = Date.UTC(adNext.year, adNext.month, adNext.day);
      if (adNextDate - adDate !== 24*3600*1000) {
        report.continuityIssues.push({ bs: {y,m,d}, ad, nextBs: nx, adNext, diff: (adNextDate - adDate)/(24*3600*1000) });
      }
    }
  }
}

// Print summary
console.log('BS calendar audit report');
console.log('Total BS dates checked:', report.totalChecked);
console.log('Round-trip mismatches:', report.mismatches.length);
if (report.mismatches.length) console.log('Sample mismatches (first 20):', report.mismatches.slice(0,20));
console.log('Continuity issues:', report.continuityIssues.length);
if (report.continuityIssues.length) console.log('Sample continuity issues (first 20):', report.continuityIssues.slice(0,20));

// Exit with non-zero if issues found
if (report.mismatches.length || report.continuityIssues.length) process.exit(1);
console.log('No issues found.');
process.exit(0);
