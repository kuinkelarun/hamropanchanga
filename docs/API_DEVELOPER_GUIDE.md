# HamroPanchanga API — Developer Guide

> **Base URL:** `https://us-central1-hamropanchanga.cloudfunctions.net/api`

The HamroPanchanga public API gives developers access to Nepali (Bikram Sambat) calendar data, tithi (lunar day) information, and public calendar events.

---

## Getting an API Key

1. Sign in at [hamropanchanga.com](https://hamropanchanga.com) with your Google account.
2. Open the **Settings** menu (top-right avatar) and click **Developer API**.
3. Fill in the request form describing your use case and click **Submit Request**.
4. Once your request is approved (typically within 24 hours), return to the Developer API page to **copy your key** — it is shown only once.
5. Store the key securely (e.g. as an environment variable). It cannot be retrieved again after you acknowledge it.

---

## Authentication

Pass your API key in the `X-API-Key` request header:

```bash
curl "https://us-central1-hamropanchanga.cloudfunctions.net/api/v1/tithi/today" \
  -H "X-API-Key: npcal_your_key_here"
```

Keys are prefixed with `npcal_`. Never commit keys to source control.

---

## Rate Limits

| Plan  | Requests / day | Price        |
|-------|----------------|--------------|
| Free  | 1,000          | Free forever |

The daily counter resets at **00:00 UTC**. For higher limits, contact [admin@hamropanchanga.com](mailto:admin@hamropanchanga.com).

---

## Endpoints

### `GET /v1/health` — Health Check

No authentication required.

**Response**

```json
{
  "status": "ok",
  "version": "v1",
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

---

### `GET /v1/tithi/today` — Current Tithi

Returns the tithi active at the current server time (UTC).

**Headers:** `X-API-Key: npcal_...`

**Response**

```json
{
  "date": "2026-02-23",
  "sunLon": 310.42,
  "moonLon": 47.18,
  "tithi": 10,
  "paksha": "Shukla",
  "tithiName": "Dashami",
  "tithiStart": "2026-02-22T18:30:00.000Z",
  "tithiEnd": "2026-02-23T20:15:00.000Z"
}
```

| Field       | Type   | Description                                      |
|-------------|--------|--------------------------------------------------|
| `date`      | string | Server date in `YYYY-MM-DD` (AD)                |
| `sunLon`    | number | Sun's geocentric ecliptic longitude (degrees)   |
| `moonLon`   | number | Moon's geocentric ecliptic longitude (degrees)  |
| `tithi`     | number | Tithi index 1–30                                |
| `paksha`    | string | `"Shukla"` (bright) or `"Krishna"` (dark)       |
| `tithiName` | string | English name (e.g. `"Dashami"`)                 |
| `tithiStart`| string | ISO 8601 UTC start of the tithi                 |
| `tithiEnd`  | string | ISO 8601 UTC end of the tithi                   |

---

### `GET /v1/calendar/:bsYear/:bsMonth` — Calendar Month

Returns full Nepali calendar data for a given Bikram Sambat year and month.

**Parameters**

| Parameter | Type    | Range        |
|-----------|---------|--------------|
| `bsYear`  | integer | 2080 – 2085 |
| `bsMonth` | integer | 1 – 12       |

**Example**

```bash
curl "https://us-central1-hamropanchanga.cloudfunctions.net/api/v1/calendar/2082/11" \
  -H "X-API-Key: npcal_..."
```

**Response**

```json
{
  "bsYear": 2082,
  "bsMonth": 11,
  "days": [
    {
      "bsDay": 1,
      "adDate": "2026-02-13",
      "tithiIndex": 1,
      "tithiName": "Pratipada",
      "paksha": "Shukla"
    }
  ],
  "metadata": {
    "monthName": "Falgun",
    "monthNameNe": "फाल्गुन",
    "daysInMonth": 30
  }
}
```

---

### `GET /v1/tithis` — List Tithis by Date Range

Returns all stored tithi records within an AD date range.

**Query Parameters**

| Parameter   | Required | Format       | Description          |
|-------------|----------|--------------|----------------------|
| `startDate` | Yes      | `YYYY-MM-DD` | Range start (AD)     |
| `endDate`   | Yes      | `YYYY-MM-DD` | Range end (AD)       |

Maximum range: **366 days**.

**Example**

```bash
curl "https://us-central1-hamropanchanga.cloudfunctions.net/api/v1/tithis?startDate=2026-01-01&endDate=2026-03-31" \
  -H "X-API-Key: npcal_..."
```

**Response**

```json
{
  "count": 60,
  "tithis": [
    {
      "id": "abc123",
      "bsDate": "2082-09-18",
      "adDate": "2026-01-01",
      "tithi": 7,
      "tithiName": "Saptami",
      "paksha": "Shukla",
      "startDate": "2025-12-31T18:30:00.000Z",
      "endDate": "2026-01-01T19:45:00.000Z"
    }
  ]
}
```

---

### `GET /v1/events` — List Public Events by Date Range

Returns public calendar events within an AD date range.

**Query Parameters** — same as `/v1/tithis`.

Maximum range: **366 days**.

**Example**

```bash
curl "https://us-central1-hamropanchanga.cloudfunctions.net/api/v1/events?startDate=2026-01-01&endDate=2026-12-31" \
  -H "X-API-Key: npcal_..."
```

**Response**

```json
{
  "count": 12,
  "events": [
    {
      "id": "xyz789",
      "title": "Dashain",
      "titleNe": "दशैं",
      "dateKey": "2082-06-01",
      "adDate": "2025-10-17",
      "isPublic": true,
      "repetition": "yearly",
      "description": "Major Hindu festival"
    }
  ]
}
```

---

## Error Codes

| HTTP Code | Meaning                                                  |
|-----------|----------------------------------------------------------|
| `200`     | Success                                                  |
| `400`     | Bad request — check parameters                          |
| `401`     | Unauthorized — missing or invalid `X-API-Key`           |
| `404`     | Endpoint not found                                       |
| `429`     | Rate limit exceeded — resets at 00:00 UTC               |
| `500`     | Internal server error                                    |

**401 response body:**

```json
{ "error": "Unauthorized", "message": "Invalid or revoked API key" }
```

**429 response body:**

```json
{ "error": "Rate limit exceeded", "message": "1000 requests/day limit reached. Resets at midnight UTC." }
```

---

## Code Examples

### JavaScript / Fetch

```javascript
const API_KEY = process.env.NPCAL_API_KEY;
const BASE_URL = 'https://us-central1-hamropanchanga.cloudfunctions.net/api';

async function getTodayTithi() {
  const res = await fetch(`${BASE_URL}/v1/tithi/today`, {
    headers: { 'X-API-Key': API_KEY }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getCalendarMonth(bsYear, bsMonth) {
  const res = await fetch(`${BASE_URL}/v1/calendar/${bsYear}/${bsMonth}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return res.json();
}
```

### Python

```python
import os, requests

API_KEY = os.environ['NPCAL_API_KEY']
BASE_URL = 'https://us-central1-hamropanchanga.cloudfunctions.net/api'
HEADERS = {'X-API-Key': API_KEY}

def get_today_tithi():
    r = requests.get(f'{BASE_URL}/v1/tithi/today', headers=HEADERS)
    r.raise_for_status()
    return r.json()

def get_events(start_date, end_date):
    r = requests.get(
        f'{BASE_URL}/v1/events',
        params={'startDate': start_date, 'endDate': end_date},
        headers=HEADERS
    )
    r.raise_for_status()
    return r.json()
```

### PHP

```php
<?php
$apiKey = getenv('NPCAL_API_KEY');
$baseUrl = 'https://us-central1-hamropanchanga.cloudfunctions.net/api';

function apiGet(string $path, string $apiKey, string $baseUrl): array {
    $ch = curl_init("$baseUrl$path");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: $apiKey"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $body = curl_exec($ch);
    curl_close($ch);
    return json_decode($body, true);
}

$tithi = apiGet('/v1/tithi/today', $apiKey, $baseUrl);
echo $tithi['tithiName']; // e.g. "Dashami"
```

---

## FAQ

**Do I need an account to use the API?**  
Yes. You must sign in with Google at hamropanchanga.com and request a key via the Developer API page.

**Is the free plan permanent?**  
Yes — the free tier (1,000 req/day) is free forever.

**Can I use this commercially?**  
The free plan is available for personal and commercial projects. Please attribute "Powered by HamroPanchanga API" in your app.

**What calendar system is used?**  
Bikram Sambat (BS), Nepal's official calendar. AD dates are also returned alongside BS dates in all responses.

**What timezone are dates in?**  
Tithi start/end times are ISO 8601 UTC. Date strings (`YYYY-MM-DD`) represent Nepal Standard Time (UTC+5:45) unless otherwise noted.

---

## Support

- Email: [admin@hamropanchanga.com](mailto:admin@hamropanchanga.com)
- Issues or feature requests: use the Developer API request form on the site.
