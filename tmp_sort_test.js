const tithis = [
  {
    id: 't1',
    name: 'कृष्णपक्ष प्रतिपदा',
    startDate: '2025-11-19',
    startTime: '01:34',
    endDate: '2025-11-20',
    endTime: '20:28'
  },
  {
    id: 't2',
    name: 'कृष्णपक्ष तृतीया',
    startDate: '2025-11-20',
    startTime: '15:06',
    endDate: '2025-11-21',
    endTime: '12:24'
  },
  {
    id: 't3',
    name: 'कृष्णपक्ष द्वितीया',
    startDate: '2025-11-20',
    startTime: '20:28',
    endDate: '2025-11-20',
    endTime: '15:06'
  }
];

function getTithiStartMillis(tithi){
  if (!tithi) return Infinity;
  if (tithi.startDate && tithi.startTime) return new Date(`${tithi.startDate}T${tithi.startTime}:00`).getTime();
  if (tithi.startDate) return new Date(`${tithi.startDate}T00:00:00`).getTime();
  return Infinity;
}

function getTithiEndMillis(tithi){
  if (!tithi) return Infinity;
  if (tithi.endDate && tithi.endTime) return new Date(`${tithi.endDate}T${tithi.endTime}:00`).getTime();
  if (tithi.endDate) return new Date(`${tithi.endDate}T23:59:59`).getTime();
  return Infinity;
}

function compareTithisByStart(a,b){
  const sa = getTithiStartMillis(a);
  const sb = getTithiStartMillis(b);
  if (sa !== sb) return sa - sb;
  const ea = getTithiEndMillis(a);
  const eb = getTithiEndMillis(b);
  if (ea !== eb) return ea - eb;
  return (a.name || '').localeCompare(b.name || '');
}

console.log('Original (string-based) order:');
console.log(tithis.slice().sort((a,b)=> (a.startTime||'').localeCompare(b.startTime||'')).map(t => `${t.name} | ${t.startDate} ${t.startTime}`));

console.log('\nTimestamp-based comparator order:');
console.log(tithis.slice().sort(compareTithisByStart).map(t => `${t.name} | ${t.startDate} ${t.startTime}`));

console.log('\nStart millis values:');
for (const t of tithis){
  console.log(`${t.name} -> ${getTithiStartMillis(t)} (${new Date(getTithiStartMillis(t)).toISOString()})`);
}

console.log('\nEnd millis values:');
for (const t of tithis){
  console.log(`${t.name} -> ${getTithiEndMillis(t)} (${new Date(getTithiEndMillis(t)).toISOString()})`);
}
