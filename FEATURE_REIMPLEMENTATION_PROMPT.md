# Feature Re-implementation Prompt

Use this prompt with an AI coding agent on a clean codebase to re-implement exactly these features.

---

## Context

This is a React + Firebase family tree app with a Nepali calendar. The codebase has:

- `src/components/AdminManagement.js` — admin CRUD for tithis and calendar events
- `src/components/NepaliCalendar.js` — main calendar rendering
- `src/hooks/useTithisData.js` — Firestore listener that builds a `{ dateKey: tithi[] }` map
- `src/components/TreeBuilder/TreeSelectionPage.js` — page listing user's family trees
- `src/components/calendar/AddEventModal.js` — modal for creating/editing calendar events
- `src/components/AddEventForm.js` — form for adding events from tree detail page
- `src/components/TreeBuilder/TreeDetailPage.js` — tree detail page that hosts AddEventForm
- `src/services/CalendarEventService.js` — Firestore write service for calendar events
- `src/components/EventsPage.js` — events listing page (already has SearchBar, keep as-is)

Tithis in Firestore have these fields: `id`, `name` (e.g. "ज्येष्ठ कृष्णपक्ष द्वितीया"), `pakshya`, `tithiName`, `tithiMonth`, `tithiYear`, `startDate` (AD YYYY-MM-DD), `startTime`, `endDate`, `endTime`.

---

## Feature 1: Indicator columns in AdminManagement tithis table

Two optional fields `indicatorNepali` and `indicatorEnglish` on tithi Firestore documents mark special tithis (e.g. Adhika/अधिक month tithis). Add these to the admin tithis table.

### Changes to `src/components/AdminManagement.js`

**1a. Table headers** — in the tithis `<thead>` section, add two `<th>` headers between "Tithi Month" and "Start Date":
```jsx
<th>Indicator (नेपाली)</th>
<th>Indicator (English)</th>
```
The full header order becomes: Tithi | Pakshya | Tithi Month | Indicator (नेपाली) | Indicator (English) | Start Date | Start Time | End Date | End Time | Actions — 10 columns total. Update any `colSpan` attributes that reference the old 8-column count to 10.

**1b. Edit mode row cells** — after the `tithiMonth` computed-field cell and before the `startDate` NepaliDatePicker cell, add:
```jsx
<td>
  <input
    type="text"
    value={editingData.indicatorNepali || ''}
    onChange={(e) => updateEditField('indicatorNepali', e.target.value)}
    className="edit-input"
    placeholder="अधिक"
  />
</td>
<td>
  <input
    type="text"
    value={editingData.indicatorEnglish || ''}
    onChange={(e) => updateEditField('indicatorEnglish', e.target.value)}
    className="edit-input"
    placeholder="Adhik"
  />
</td>
```

**1c. View mode row cells** — after the `tithiMonth` display cell and before `startDate`, add:
```jsx
<td>{tithi.indicatorNepali || ''}</td>
<td>{tithi.indicatorEnglish || ''}</td>
```

---

## Feature 2: Pass indicator fields through useTithisData

`src/hooks/useTithisData.js` builds a `{ dateKey: tithi[] }` map by iterating Firestore docs. In both the date-range push path and the legacy `dateKey` push path, include the two indicator fields alongside the existing fields:

```js
indicatorNepali: tithi.indicatorNepali || null,
indicatorEnglish: tithi.indicatorEnglish || null,
```

These fields are already on the Firestore document; this just ensures they flow through to the calendar components.

---

## Feature 3: Adhika guard + indicator prefix + tithiMonth from stored field in NepaliCalendar

### 3a. Adhika Maas suppression guard (event filtering)

In `src/components/NepaliCalendar.js`, inside the tithi-based recurrence check (`targetTithis.some(t => { ... })`), add this block **before** the paksha/name matching:

```js
// Adhika Maas suppression: skip Adhika tithis unless the event explicitly opts in
const isAdhika = t.indicatorNepali === 'अधिक' ||
  (t.indicatorEnglish && t.indicatorEnglish.toLowerCase().startsWith('adhik'));
if (isAdhika && event.showInAdhika !== true) return false;
if (!isAdhika && event.showInAdhika === true) return false;
```

This prevents regular recurring events from firing on Adhika (extra/intercalary) month tithis, and prevents Adhika-specific events from firing on regular month tithis.

### 3b. tithiMonth from stored field (yearly recurrence)

In the same `targetTithis.some()` block, in the `event.repetition === 'yearly'` branch, replace any logic that computes the month from `dateKey` with logic that reads from the tithi's own stored `tithiMonth` field:

```js
// Use the tithi's stored lunar month — NOT the BS calendar month of the current day.
// Tithis routinely cross BS month boundaries (e.g. Jeshtha Krishna Pratipada can
// appear on BS Baishakh 19). The tithi's own month is the correct key.
if (t.tithiMonth) {
  return t.tithiMonth === eventMonthName;
}
// Fallback for legacy tithis without a stored month: compute from the tithi's own startDate
const computedMonth = getTithiLunarMonthName(event.tithi.paksha, eventTithiIndex, t.startDate);
return computedMonth === eventMonthName;
```

### 3c. Indicator prefix in `getTithiDisplayName`

`getTithiDisplayName` is a helper function inside `NepaliCalendar` that builds the full display name of a tithi (e.g. "ज्येष्ठ कृष्णपक्ष द्वितीया"). Add an indicator prefix:

```js
const getTithiDisplayName = (tithi) => {
  const { tithiMonth: parsedMonth, pakshya, tithi: tithiName } = parseTithiName(tithi.name);
  const indicator = isNepali ? (tithi.indicatorNepali || '') : (tithi.indicatorEnglish || '');
  const indicatorPrefix = indicator ? `${indicator} ` : '';

  if (!tithi.startDate) {
    return `${indicatorPrefix}${tithi.name}`;
  }

  // Prefer stored tithiMonth, then parsed from name, then compute
  let lunarMonth = tithi.tithiMonth || parsedMonth || '';
  if (!lunarMonth) {
    const pakshaNormalized = normalizePakshaToEnglish(pakshya);
    const tithiIndex = getTithiIndexByName(tithiName);
    if (tithiIndex) {
      lunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, tithi.startDate);
    }
  }

  if (lunarMonth) {
    const monthIndex = nepaliMonths.indexOf(lunarMonth);
    const monthDisplay = monthIndex !== -1
      ? (isNepali ? nepaliMonths[monthIndex] : englishNepaliMonths[monthIndex])
      : lunarMonth;
    const pakshyaDisplay = isNepali ? pakshya : getEnglishPakshyaName(pakshya);
    const tithiDisplay = isNepali ? tithiName : getEnglishTithiName(tithiName);
    return `${indicatorPrefix}${monthDisplay} ${pakshyaDisplay} ${tithiDisplay}`;
  }

  return `${indicatorPrefix}${tithi.name}`;
};
```

### 3d. Indicator prefix in `formatTithiForDayCard`

`formatTithiForDayCard` receives `sortedParsedTithis` (array of parsed tithi objects with `.pakshya`, `.tithi`, `.indicatorNepali`, `.indicatorEnglish`). Add a `getIndicator` helper and an `anyHasIndicator` branch at the top of the function:

```js
const formatTithiForDayCard = (sortedParsedTithis) => {
  if (sortedParsedTithis.length === 0) return '';

  // Helper: indicator prefix for one tithi
  const getIndicator = (t) => {
    const ind = isNepali ? (t.indicatorNepali || '') : (t.indicatorEnglish || '');
    return ind ? `${ind} ` : '';
  };

  // If any tithi has an indicator, render each individually (no grouping)
  const anyHasIndicator = sortedParsedTithis.some(t =>
    isNepali ? t.indicatorNepali : t.indicatorEnglish
  );

  if (anyHasIndicator) {
    return sortedParsedTithis
      .map(t => {
        const pakshyaDisplay = isNepali ? t.pakshya : getEnglishPakshyaName(t.pakshya);
        const tithiDisplay = isNepali ? t.tithi : getEnglishTithiName(t.tithi);
        return `${getIndicator(t)}${pakshyaDisplay} ${tithiDisplay}`;
      })
      .join(' / ');
  }

  // ... existing logic for 1 tithi or multiple tithis without indicators unchanged
};
```

---

## Feature 4: showInAdhika field for calendar events

Events created when `showInAdhika = true` should only fire on Adhika tithis (handled by the guard in Feature 3a). The field needs to be stored in Firestore and threaded through the UI.

### 4a. `src/services/CalendarEventService.js`

In `buildEventDocument` (used by `createEvent`) and `updateEvent`, include:
```js
showInAdhika: !!showInAdhika,
```
alongside the other event fields. The function signatures already accept an options/data object; add `showInAdhika` as a destructured field.

### 4b. `src/components/calendar/AddEventModal.js`

Add state:
```js
const [showInAdhika, setShowInAdhika] = useState(false);
```

Reset it to `false` in both `useEffect` paths that reset the form (both the "editing existing event" path and the "new event" path).

Pass it to `createEvent()`:
```js
showInAdhika,
```

Add checkbox UI — visible only when `eventAssociateMode === 'tithi'`:
```jsx
{eventAssociateMode === 'tithi' && (
  <div className="ddm-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <input
      type="checkbox"
      id="showInAdhika-modal"
      checked={showInAdhika}
      onChange={(e) => {
        if (e.target.checked) {
          const confirmed = window.confirm(
            isNepali
              ? 'के यो कार्यक्रम मल मास (अधिक मास) मा देखाउने हो? यो निकै बिरलै हुन्छ।'
              : 'Are you sure you want to show this event on Mal Maas (Adhika month)? This is very rare.'
          );
          if (confirmed) setShowInAdhika(true);
        } else {
          setShowInAdhika(false);
        }
      }}
      style={{ cursor: 'pointer', flexShrink: 0 }}
    />
    <label htmlFor="showInAdhika-modal" style={{ fontSize: '0.875rem', cursor: 'default', userSelect: 'none' }}>
      {isNepali ? 'मल मास मा पर्ने (अधिक मास)' : 'Falls on Mal Maas (Adhika - not on regular month)'}
    </label>
  </div>
)}
```

### 4c. `src/components/AddEventForm.js`

Same pattern as 4b: add `const [showInAdhika, setShowInAdhika] = useState(false);`, show checkbox when tithi mode is active, pass `showInAdhika` to `onAdd()`.

### 4d. `src/components/TreeBuilder/TreeDetailPage.js`

In `handleAddEvent` and `handleUpdateEvent`, destructure `showInAdhika` from the event data passed in and forward it to the service call.

### 4e. `src/components/TreeBuilder/TreeSelectionPage.js`

In `handleAddEventFromModal`, destructure and pass `showInAdhika` when calling the event creation service.

---

## Feature 5: SearchBar shared component + Trees page search

### 5a. Create `src/components/common/SearchBar.js`

```jsx
import React from 'react';
import './SearchBar.css';

export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`sb-wrap${className ? ' ' + className : ''}`}>
      <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        className="sb-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className="sb-clear" onClick={() => onChange('')} aria-label="Clear search">×</button>
      )}
    </div>
  );
}
```

### 5b. Create `src/components/common/SearchBar.css`

```css
.sb-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 0.4rem 0.75rem;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sb-wrap:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}
.sb-icon { flex-shrink: 0; color: #a0aec0; }
.sb-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
  color: #2d3748;
  background: transparent;
  min-width: 0;
}
.sb-input::placeholder { color: #cbd5e0; }
.sb-clear {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #a0aec0;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.15rem;
  border-radius: 4px;
}
.sb-clear:hover { color: #4a5568; background: #f7fafc; }

/* Trees page toolbar context — fixed width so it sits next to action buttons */
.sb-wrap.tsp-search {
  width: 13rem;
  flex-shrink: 0;
}
```

### 5c. Use SearchBar in `src/components/TreeBuilder/TreeSelectionPage.js`

Add import:
```js
import SearchBar from '../common/SearchBar';
```

Add state:
```js
const [searchQuery, setSearchQuery] = useState('');
```

In the "My Trees" section toolbar (the `div` containing the "Build New Tree" button), add SearchBar before the button:
```jsx
<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search trees..."
  className="tsp-search"
/>
```

In the `myTrees.map(...)` call, add a `.filter()` before it:
```js
myTrees.filter(tree => {
  if (!searchQuery) return true;
  const s = searchQuery.toLowerCase();
  return (
    (tree.title || '').toLowerCase().includes(s) ||
    (tree.id || '').toLowerCase().includes(s) ||
    (tree.primaryMemberName || '').toLowerCase().includes(s) ||
    (tree.contact || '').toLowerCase().includes(s) ||
    (tree.location || '').toLowerCase().includes(s)
  );
}).map(tree => ( ... ))
```

Apply the same filter to the `sharedTrees.map(...)` call (search by title, id, contact, location).

---

## Implementation notes

- Do NOT change `getTithiLunarMonthName` in `nepaliDateUtils.js`. The existing 3-parameter Amavasya-based formula is correct.
- Do NOT add a `recomputeTithiMonths` function or any bulk Firestore write utility.
- In `saveEdit` (AdminManagement.js), only compute `tithiMonth` when the field is blank — do not always overwrite it.
- The `indicatorNepali`/`indicatorEnglish` fields are optional on Firestore docs. All reads should use `|| null` or `|| ''` defaults.
- `showInAdhika` is stored as a boolean on the calendarEvent Firestore doc. Default is `false` (undefined/missing = regular month).
