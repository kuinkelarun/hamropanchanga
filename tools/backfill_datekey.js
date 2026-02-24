/**
 * backfill_datekey.js
 *
 * One-time script to backfill the `dateKey` field on calendarEvents documents
 * that have tithi data but are missing the `dateKey` field.
 *
 * Background:
 *   Firestore's orderBy('dateKey') silently excludes documents where dateKey
 *   doesn't exist. During bulk upload, tithi-only events (where no matching
 *   tithi was found at upload time) were saved without a `dateKey` field,
 *   making ~75% of events invisible on the calendar.
 *
 *   The main fix (removing orderBy from queries) is in NepaliCalendar.js.
 *   This backfill sets dateKey = '' on affected documents as defense-in-depth.
 *
 * Usage:
 *   SERVICE_ACCOUNT=path/to/key.json node tools/backfill_datekey.js [--commit]
 *
 *   Without --commit the script runs in dry-run mode and only reports what
 *   would change. With --commit it writes the updates to Firestore.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function main() {
  const keyPath = process.env.SERVICE_ACCOUNT || process.argv.find(a => a.endsWith('.json') && !a.startsWith('-'));
  if (!keyPath) {
    console.error('Provide service account JSON path in SERVICE_ACCOUNT env or as a positional arg');
    process.exit(1);
  }
  if (!fs.existsSync(keyPath)) {
    console.error('Service account file not found:', keyPath);
    process.exit(1);
  }

  const commit = process.argv.includes('--commit');

  admin.initializeApp({
    credential: admin.credential.cert(require(path.resolve(keyPath)))
  });
  const db = admin.firestore();
  // Use the named database
  db.settings({ databaseId: 'hamropanchanga-db' });

  console.log(`\n=== Backfill dateKey on calendarEvents (commit=${commit}) ===\n`);

  const snapshot = await db.collection('calendarEvents').get();
  console.log(`Total calendarEvents documents: ${snapshot.size}`);

  let missingDateKey = 0;
  let missingEntryMode = 0;
  let updated = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    // Fix 1: dateKey missing — set to empty string sentinel
    if (data.dateKey === undefined || data.dateKey === null) {
      updates.dateKey = '';
      missingDateKey++;
    }

    // Fix 2: entryMode missing on tithi events — set it based on available info
    if (data.entryMode === undefined || data.entryMode === null) {
      if (data.tithi) {
        updates.entryMode = 'tithi';
      } else if (data.dateKey || data.date) {
        updates.entryMode = 'date';
      }
      if (updates.entryMode) missingEntryMode++;
    }

    if (Object.keys(updates).length > 0) {
      if (commit) {
        batch.update(doc.ref, updates);
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          updated += batchCount;
          console.log(`  Committed batch of ${batchCount} (total so far: ${updated})`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      if (!commit || missingDateKey <= 10) {
        console.log(`  ${commit ? 'Updating' : 'Would update'} ${doc.id}: ${JSON.stringify(updates)}` +
          (data.tithi ? ` [tithi: ${data.tithi.month} ${data.tithi.paksha} ${data.tithi.name}]` : ''));
      }
    }
  }

  // Commit remaining
  if (commit && batchCount > 0) {
    await batch.commit();
    updated += batchCount;
    console.log(`  Committed final batch of ${batchCount} (total: ${updated})`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Documents missing dateKey:   ${missingDateKey}`);
  console.log(`  Documents missing entryMode: ${missingEntryMode}`);
  if (commit) {
    console.log(`  Documents updated:           ${updated}`);
  } else {
    console.log(`  (Dry-run mode — no changes written. Use --commit to apply.)`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
