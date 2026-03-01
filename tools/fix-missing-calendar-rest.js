/**
 * Sync nepaliCalendarYears Firestore collection from the canonical bsCalendarData.js source.
 *
 * The React frontend uses src/data/bsCalendarData.js (bundled, always complete).
 * The Cloud Functions API reads from Firestore — which must be populated separately.
 * This script upserts ALL years defined in the local data file so both sources stay in sync.
 *
 * Run:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\firebase\kuinkelarun_gmail_com_application_default_credentials.json"
 *   node tools/fix-missing-calendar-rest.js
 *
 * Options (edit below):
 *   UPSERT_ALL = true   → overwrite every year in Firestore from the local source (safe, idempotent)
 *   UPSERT_ALL = false  → only insert years that are missing (skip existing docs)
 */

const https = require("https");
const fs = require("fs");

const PROJECT_ID = "hamropanchanga";
const DB_ID = "hamropanchanga-db";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB_ID}/documents`;

// ── Canonical calendar data sourced from src/data/bsCalendarData.js ──────────
// Each entry: [startAdDate (YYYY-MM-DD), daysInMonths (12 values)]
// AD months in JS Date are 0-indexed, so new Date(2024, 3, 13) = April 13 2024.
const ALL_YEARS = {
  2079: { startAdDate: "2022-04-14", daysInMonths: [31,31,32,31,31,31,30,29,30,29,30,30] },
  2080: { startAdDate: "2023-04-14", daysInMonths: [31,32,31,32,31,30,30,30,29,29,30,30] },
  2081: { startAdDate: "2024-04-13", daysInMonths: [31,32,31,32,31,30,30,30,29,30,29,31] },
  2082: { startAdDate: "2025-04-14", daysInMonths: [31,31,32,31,31,31,30,29,30,29,30,30] },
  2083: { startAdDate: "2026-04-14", daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,31] },
  2084: { startAdDate: "2027-04-14", daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
  2085: { startAdDate: "2028-04-13", daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
  2086: { startAdDate: "2029-04-14", daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
  2087: { startAdDate: "2030-04-14", daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
  2088: { startAdDate: "2031-04-15", daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
  2089: { startAdDate: "2032-04-14", daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
  2090: { startAdDate: "2033-04-14", daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
};

// Set to true to overwrite existing Firestore docs, false to only fill gaps
const UPSERT_ALL = false;

function httpsRequest(method, urlStr, bodyStr, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const hasBody = bodyStr && bodyStr.length > 0;
    const req = https.request({
      method, hostname: url.hostname, path: url.pathname + url.search,
      headers: {
        ...(hasBody ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        ...headers
      }
    }, res => {
      let out = "";
      res.on("data", c => out += c);
      res.on("end", () => resolve({ status: res.statusCode, body: out }));
    });
    req.on("error", reject);
    if (hasBody) req.write(bodyStr);
    req.end();
  });
}

async function getAccessToken() {
  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credFile) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set");
  const creds = JSON.parse(fs.readFileSync(credFile, "utf8"));
  const params = `client_id=${encodeURIComponent(creds.client_id)}&client_secret=${encodeURIComponent(creds.client_secret)}&refresh_token=${encodeURIComponent(creds.refresh_token)}&grant_type=refresh_token`;
  const res = await httpsRequest("POST", "https://oauth2.googleapis.com/token", params, { "Content-Type": "application/x-www-form-urlencoded" });
  if (res.status !== 200) throw new Error("Token exchange failed: " + res.body);
  return JSON.parse(res.body).access_token;
}

async function run() {
  const token = await getAccessToken();
  console.log("Access token obtained.\n");

  let inserted = 0, skipped = 0, failed = 0;

  for (const [bsYear, entry] of Object.entries(ALL_YEARS).sort((a, b) => a[0] - b[0])) {
    const url = `${FIRESTORE_BASE}/nepaliCalendarYears/${bsYear}`;

    // If not force-upserting, check whether the doc already exists
    if (!UPSERT_ALL) {
      const check = await httpsRequest("GET", url, "", { "Authorization": `Bearer ${token}` });
      if (check.status === 200) {
        console.log(`  skip  BS ${bsYear} (already in Firestore)`);
        skipped++;
        continue;
      }
    }

    const docBody = JSON.stringify({ fields: {
      year: { integerValue: String(bsYear) },
      startAdDate: { stringValue: entry.startAdDate },
      daysInMonths: { arrayValue: { values: entry.daysInMonths.map(n => ({ integerValue: String(n) })) } }
    }});
    const result = await httpsRequest("PATCH", url, docBody, { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" });
    if (result.status === 200) {
      console.log(`  ✓ ${UPSERT_ALL ? "upserted" : "inserted"} BS ${bsYear} (${entry.startAdDate})`);
      inserted++;
    } else {
      console.error(`  ✗ BS ${bsYear}: HTTP ${result.status} -- ${result.body}`);
      failed++;
    }
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
