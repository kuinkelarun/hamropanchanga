/**
 * Nepali Calendar Public API — route handlers
 *
 * Endpoints
 * ---------
 * GET /v1/calendar/:bsYear/:bsMonth        Full BS month with AD dates + tithis
 * GET /v1/tithis?startDate=&endDate=       Tithi windows in an AD date range
 * GET /v1/events?startDate=&endDate=       Public calendar events in an AD date range
 * GET /v1/tithi/today                      Active tithi(s) at the current NPT moment
 */

const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

// ─── Shared constants ─────────────────────────────────────────────────────────

const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra', 'Ashwin', 'Kartik', 'Mangsir',
  'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const NEPALI_MONTHS_NP = [
  'वैशाख', 'ज्येष्ठ', 'आषाढ', 'श्रावण',
  'भाद्र', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष',
  'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load nepaliCalendarYears data for a given BS year from Firestore.
 * Admin SDK bypasses security rules — nepaliCalendarYears is admin-locked for clients.
 */
async function getCalendarYear(bsYear) {
  const doc = await admin.firestore()
    .collection('nepaliCalendarYears')
    .doc(String(bsYear))
    .get();
  if (!doc.exists) return null;
  const data = doc.data();
  // startAdDate may be a Timestamp, Date, or string
  let startAdDate = data.startAdDate;
  if (startAdDate && typeof startAdDate.toDate === 'function') {
    startAdDate = startAdDate.toDate().toISOString().slice(0, 10);
  } else if (startAdDate instanceof Date) {
    startAdDate = startAdDate.toISOString().slice(0, 10);
  }
  return { startAdDate: String(startAdDate), daysInMonths: data.daysInMonths || [] };
}

/**
 * Add `days` calendar days to a YYYY-MM-DD string.
 */
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Day-of-week name for a YYYY-MM-DD (UTC).
 */
function weekDayName(dateStr) {
  return WEEK_DAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/**
 * Given calendar year data, return the AD date of BS day 1 of `bsMonth` (1-based).
 */
function adDateOfBsMonthStart(calYear, bsMonth) {
  let offset = 0;
  for (let m = 1; m < bsMonth; m++) {
    offset += calYear.daysInMonths[m - 1] || 0;
  }
  return addDays(calYear.startAdDate, offset);
}

/**
 * Parse and validate a YYYY-MM-DD date string.
 */
function parseDate(val, name, res) {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    res.status(400).json({ error: 'Bad Request', message: `${name} must be YYYY-MM-DD format.` });
    return null;
  }
  return val;
}

/**
 * Attach tithi array to each day entry in the days list.
 * `tithiDocs` is an array of Firestore DocumentData objects.
 */
function attachTithisTodays(days, tithiDocs) {
  const byDate = {};
  for (const ti of tithiDocs) {
    const start = ti.startDate || ti.dateKey || '';
    const end = ti.endDate || start;
    if (!start) continue;
    // Walk from startDate to endDate inclusive
    let cur = start;
    while (cur <= end) {
      if (!byDate[cur]) byDate[cur] = [];
      // Parse name: handles both 3-part "month pakshya tithi" and 2-part "pakshya tithi"
      const parsed = parseTithiNameApi(ti.name || '');
      byDate[cur].push({
        name: ti.name || '',
        tithiMonth: ti.tithiMonth || parsed.tithiMonth || '',
        paksha: normalizePaksha(parsed.pakshya),
        tithiName: parsed.tithi || ti.name || '',
        startDate: ti.startDate || ti.dateKey || '',
        startTime: ti.startTime || '',
        endDate: ti.endDate || ti.startDate || ti.dateKey || '',
        endTime: ti.endTime || '',
        category: ti.category || ''
      });
      cur = addDays(cur, 1);
      if (cur > end) break;
    }
  }
  return days.map(day => ({ ...day, tithis: byDate[day.adDate] || [] }));
}

function normalizePaksha(nepaliPaksha) {
  if (nepaliPaksha === 'शुक्लपक्ष') return 'Shukla';
  if (nepaliPaksha === 'कृष्णपक्ष') return 'Krishna';
  return nepaliPaksha;
}

/**
 * Parse tithi name — handles both 2-part and 3-part formats.
 * Server-side counterpart of the client-side parseTithiName.
 */
function parseTithiNameApi(fullName) {
  if (!fullName) return { tithiMonth: '', pakshya: '', tithi: '' };
  const parts = fullName.split(' ');
  const NEPALI_MONTHS = [
    "वैशाख", "ज्येष्ठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
    "कार्तिक", "मार्ग", "पौष", "माघ", "फाल्गुन", "चैत्र"
  ];
  if (parts.length >= 3 && NEPALI_MONTHS.includes(parts[0])) {
    return { tithiMonth: parts[0], pakshya: parts[1], tithi: parts.slice(2).join(' ') };
  }
  if (parts.length >= 2) {
    return { tithiMonth: '', pakshya: parts[0], tithi: parts.slice(1).join(' ') };
  }
  return { tithiMonth: '', pakshya: '', tithi: fullName };
}

function formatTithiDoc(doc) {
  const data = doc.data ? doc.data() : doc;
  const parsed = parseTithiNameApi(data.name || '');
  return {
    id: doc.id || undefined,
    name: data.name || '',
    tithiMonth: data.tithiMonth || parsed.tithiMonth || '',
    paksha: normalizePaksha(parsed.pakshya),
    tithiName: parsed.tithi || data.name || '',
    startDate: data.startDate || data.dateKey || '',
    startTime: data.startTime || '',
    endDate: data.endDate || data.startDate || data.dateKey || '',
    endTime: data.endTime || '',
    category: data.category || ''
  };
}

function formatEventDoc(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || undefined,
    title: data.title || '',
    description: data.description || '',
    dateKey: data.dateKey || '',
    repetition: data.repetition || 'none',
    isPublic: data.isPublic || false,
    personName: data.associatedPerson || '',
    ...(data.tithi ? { tithi: data.tithi } : {})
  };
}

// ─── GET /v1/calendar/:bsYear/:bsMonth ───────────────────────────────────────

router.get('/calendar/:bsYear/:bsMonth', async (req, res) => {
  const bsYear  = parseInt(req.params.bsYear, 10);
  const bsMonth = parseInt(req.params.bsMonth, 10);

  if (isNaN(bsYear) || bsYear < 2000 || bsYear > 2200) {
    return res.status(400).json({ error: 'Bad Request', message: 'bsYear must be between 2000 and 2200.' });
  }
  if (isNaN(bsMonth) || bsMonth < 1 || bsMonth > 12) {
    return res.status(400).json({ error: 'Bad Request', message: 'bsMonth must be between 1 and 12.' });
  }

  try {
    const calYear = await getCalendarYear(bsYear);
    if (!calYear) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Calendar data for BS year ${bsYear} is not available.`
      });
    }

    const totalDays = calYear.daysInMonths[bsMonth - 1];
    if (!totalDays) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Month data for BS ${bsYear}/${bsMonth} is not available.`
      });
    }

    const monthStartAD = adDateOfBsMonthStart(calYear, bsMonth);
    const monthEndAD   = addDays(monthStartAD, totalDays - 1);

    // Build day entries
    const days = [];
    for (let d = 0; d < totalDays; d++) {
      const adDate = addDays(monthStartAD, d);
      days.push({ bsDay: d + 1, adDate, dayOfWeek: weekDayName(adDate) });
    }

    // Fetch tithis that could overlap this month (start within ±2 days of range)
    const queryStart = addDays(monthStartAD, -2);
    const queryEnd   = addDays(monthEndAD, 2);
    const tithiSnap = await admin.firestore()
      .collection('tithis')
      .where('startDate', '>=', queryStart)
      .where('startDate', '<=', queryEnd)
      .get();

    const tithiDocs = tithiSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const daysWithTithis = attachTithisTodays(days, tithiDocs);

    return res.json({
      bsYear,
      bsMonth,
      monthName: NEPALI_MONTHS[bsMonth - 1],
      monthNameNepali: NEPALI_MONTHS_NP[bsMonth - 1],
      totalDays,
      startAdDate: monthStartAD,
      endAdDate: monthEndAD,
      days: daysWithTithis
    });
  } catch (err) {
    console.error('/v1/calendar error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ─── GET /v1/tithis?startDate=&endDate= ──────────────────────────────────────

router.get('/tithis', async (req, res) => {
  const startDate = parseDate(req.query.startDate, 'startDate', res);
  if (!startDate) return;
  const endDate = parseDate(req.query.endDate, 'endDate', res);
  if (!endDate) return;

  if (startDate > endDate) {
    return res.status(400).json({ error: 'Bad Request', message: 'startDate must be before or equal to endDate.' });
  }

  // Limit range to 1 year to prevent abuse
  const msInYear = 366 * 24 * 60 * 60 * 1000;
  if (new Date(endDate) - new Date(startDate) > msInYear) {
    return res.status(400).json({ error: 'Bad Request', message: 'Date range must not exceed 366 days.' });
  }

  try {
    // orderBy('startDate') only — avoids needing composite index while it builds.
    // Sort by startTime in JS after fetch (dataset is small per date range).
    const snap = await admin.firestore()
      .collection('tithis')
      .where('startDate', '>=', startDate)
      .where('startDate', '<=', endDate)
      .orderBy('startDate')
      .get();

    const tithis = snap.docs
      .map(formatTithiDoc)
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    return res.json({ count: tithis.length, startDate, endDate, tithis });
  } catch (err) {
    console.error('/v1/tithis error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ─── GET /v1/events?startDate=&endDate= ──────────────────────────────────────

router.get('/events', async (req, res) => {
  const startDate = parseDate(req.query.startDate, 'startDate', res);
  if (!startDate) return;
  const endDate = parseDate(req.query.endDate, 'endDate', res);
  if (!endDate) return;

  if (startDate > endDate) {
    return res.status(400).json({ error: 'Bad Request', message: 'startDate must be before or equal to endDate.' });
  }

  const msInYear = 366 * 24 * 60 * 60 * 1000;
  if (new Date(endDate) - new Date(startDate) > msInYear) {
    return res.status(400).json({ error: 'Bad Request', message: 'Date range must not exceed 366 days.' });
  }

  try {
    const snap = await admin.firestore()
      .collection('calendarEvents')
      .where('isPublic', '==', true)
      .where('dateKey', '>=', startDate)
      .where('dateKey', '<=', endDate)
      .orderBy('dateKey')
      .get();

    const events = snap.docs.map(formatEventDoc);
    return res.json({ count: events.length, startDate, endDate, events });
  } catch (err) {
    console.error('/v1/events error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ─── GET /v1/tithi/today ──────────────────────────────────────────────────────

router.get('/tithi/today', async (req, res) => {
  // Current date in NPT (UTC+05:45)
  const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
  const nowNPT = new Date(Date.now() + nptOffsetMs);
  const todayNPT = nowNPT.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // A tithi active today has startDate <= today AND endDate >= today
    // Firestore can only filter on one inequality at a time, so query startDate <= today
    // then filter endDate >= today client-side (tithis span at most 2 days so range is tiny)
    const snap = await admin.firestore()
      .collection('tithis')
      .where('startDate', '<=', todayNPT)
      .where('startDate', '>=', addDays(todayNPT, -2))
      .get();

    const active = snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .filter(ti => {
        const end = ti.endDate || ti.startDate || ti.dateKey || '';
        return end >= todayNPT;
      })
      .map(ti => ({
        id: ti.id,
        name: ti.name || '',
        paksha: normalizePaksha((ti.name || '').split(' ')[0]),
        tithiName: (ti.name || '').split(' ').slice(1).join(' '),
        startDate: ti.startDate || ti.dateKey || '',
        startTime: ti.startTime || '',
        endDate: ti.endDate || ti.startDate || ti.dateKey || '',
        endTime: ti.endTime || '',
        category: ti.category || ''
      }));

    return res.json({ dateNPT: todayNPT, count: active.length, tithis: active });
  } catch (err) {
    console.error('/v1/tithi/today error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;
