/**
 * Fix: Upload missing nepaliCalendarYears documents (BS 2081 & 2082) to Firestore.
 *
 * BS 2081: Apr 13, 2024 → Apr 13, 2025
 * BS 2082: Apr 14, 2025 → Apr 13, 2026
 *
 * Run: node tools/fix-missing-calendar-years.js
 */

const admin = require('firebase-admin');

// Uses Application Default Credentials (set by `firebase login` / gcloud auth)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'hamropanchanga',
});

const db = admin.firestore();

const missingYears = [
  {
    bsYear: 2081,
    startAdDate: '2024-04-13',
    daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  },
  {
    bsYear: 2082,
    startAdDate: '2025-04-14',
    daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  },
];

async function run() {
  for (const entry of missingYears) {
    const docRef = db.collection('nepaliCalendarYears').doc(String(entry.bsYear));
    const existing = await docRef.get();
    if (existing.exists) {
      console.log(`BS ${entry.bsYear} already exists — skipping.`);
      continue;
    }
    await docRef.set({
      startAdDate: entry.startAdDate,
      daysInMonths: entry.daysInMonths,
    });
    console.log(`✓ Inserted BS ${entry.bsYear} (startAdDate=${entry.startAdDate})`);
  }
  console.log('Done.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
