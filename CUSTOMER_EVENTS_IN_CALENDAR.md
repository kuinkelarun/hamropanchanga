# Customer Events in Nepali Calendar - Implementation Summary

## Overview
Implemented client-side display of customer/family member events in the Nepali Calendar. Events stored in the `customers` collection are now visible directly in calendar day cards and the details modal.

## Implementation Details

### 1. State Management
**File:** `src/components/NepaliCalendar.js`

- Added `customerEvents` state array to store events from customers collection
- Created Firebase listener that:
  - Loads events for authenticated users (their own customers only)
  - Loads all customer events for admin users
  - Extracts events from `customers.events` array
  - Tracks event metadata (customerId, customerName, customerUserId)

### 2. Data Processing
**File:** `src/components/NepaliCalendar.js`

- Created `customerEventsByDate` useMemo hook to aggregate events by date (YYYY-MM-DD)
- Added `findCustomerEventsForAdDate` helper function for date-based lookup
- Follows same pattern as existing tithis and calendar events

### 3. Calendar Display (Day Cards)
**Files:** 
- `src/components/NepaliCalendar.js`
- `src/components/NepaliCalendar.css`

**Changes:**
- Added customer events to all three tile types:
  - Previous month tiles
  - Current month tiles
  - Next month tiles
- Customer events display below regular events with purple gradient styling
- Shows event titles concatenated with `|` separator

**CSS Styling:**
```css
.nt-summary-item.customer-event {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 600;
    margin-top: 2px;
}
```

### 4. Details Modal
**File:** `src/components/NepaliCalendar.js`

**New Section: "Customer Events"**
- Added dedicated section after regular Events section
- Only appears when customer events exist for the selected date
- Displays:
  - Section header with "Family" badge
  - Event title
  - Customer name badge (purple background)
  - Description (if available)
  - Person ID (if linked to family member)

**Modal Item Styling:**
```css
.nc-item.customer-event-item {
    border: 2px solid transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}
```

## Privacy & Permissions

### User Visibility
- **Regular Users:** See only their own customer events (filtered by `userId` in query)
- **Admin Users:** See ALL customer events across all users
- **Guest Users:** Cannot see any customer events (requires authentication)

### Implementation
```javascript
const q = isAdmin 
  ? query(customersCollection) // Admins see all
  : query(customersCollection, where('userId', '==', user.uid)); // Users see own
```

## Data Structure

### Expected Event Format in Firestore
```javascript
// customers/{customerId}/events array
{
  date: "2025-01-15",           // Required: YYYY-MM-DD format
  title: "Birthday",             // Required: Event title
  description: "John's birthday", // Optional
  personId: "person_123"         // Optional: Links to family member
}
```

### Processed Event Object
```javascript
{
  date: "2025-01-15",
  title: "Birthday",
  description: "John's birthday",
  personId: "person_123",
  customerId: "cust_abc",
  customerName: "Smith Family",
  customerUserId: "user_xyz"     // Owner of customer record
}
```

## Design Decisions

### ✅ Client-Side Approach
**Pros:**
- No backend changes required
- Real-time updates via Firebase listener
- Simpler architecture
- Faster to implement and test
- Direct access to customer data

**Cons:**
- More data fetched on client (entire customers collection)
- Filtering happens in browser
- Slightly higher memory usage

### 🎨 Visual Differentiation
- **Purple gradient** theme matches overall app design
- Clear separation from regular calendar events (red)
- Distinct "Family" badge for easy identification
- Purple gradient border on modal items

### 🔒 Security
- Firebase security rules should enforce:
  - Users can only read their own customer records
  - Admins can read all customer records
- Client-side filtering is backed by Firestore query permissions

## Testing Checklist

- [ ] Regular user can see their own customer events
- [ ] Admin can see all customer events
- [ ] Guest users don't see customer events
- [ ] Events display correctly in day cards
- [ ] Events display correctly in details modal
- [ ] Purple styling applied correctly
- [ ] Customer name badge shows correct data
- [ ] Person ID displayed when available
- [ ] Multiple events on same date display properly
- [ ] Events across months (prev/next) work correctly

## Future Enhancements

### Possible Improvements
1. **Click-to-Navigate:** Click customer event to open CustomerDetail page
2. **Inline Editing:** Edit customer events directly from calendar
3. **Filtering:** Toggle customer events visibility on/off
4. **Color Coding:** Different colors per customer/family
5. **Event Categories:** Birthday, anniversary, death anniversary icons
6. **Quick Add:** Add customer events directly from calendar modal
7. **Reminders:** Notification system for upcoming events

## Drawbacks & Considerations

### Performance
- **Small datasets (<100 customers):** No noticeable impact
- **Large datasets (>500 customers):** Consider:
  - Pagination or lazy loading
  - Date-range based queries
  - Caching strategy
  - Virtual scrolling for long event lists

### Data Transfer
- Entire customers collection loaded on calendar mount
- For large databases, consider:
  - Query by date range only
  - Load on-demand when month changes
  - Cloud Function to pre-aggregate events

### Maintenance
- Two event systems to maintain (calendarEvents + customerEvents)
- Must keep both systems in sync if shared features added
- Consider unified event interface in future

## Related Files Modified

1. `src/components/NepaliCalendar.js` - Main logic
2. `src/components/NepaliCalendar.css` - Styling
3. `CUSTOMER_EVENTS_IN_CALENDAR.md` - This documentation

## Migration Notes

No data migration required. Implementation works with existing customer data structure.

Events are read from: `customers/{customerId}.events[]` where each event has:
- `date` (YYYY-MM-DD)
- `title`
- Optional: `description`, `personId`

---

**Implemented:** January 2025  
**Version:** 1.0  
**Status:** ✅ Complete & Ready for Testing
