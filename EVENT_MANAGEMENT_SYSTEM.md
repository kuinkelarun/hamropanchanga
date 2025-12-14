# Comprehensive Event Management System

## Overview
Implemented a full-featured event management system in the Nepali Calendar with support for multiple event types, role-based access control, and customer/family member association.

## Event Types

### 1. Public Events (Admin/SuperUser Only)
- **Badge**: Yellow "Admin" badge
- **Visibility**: Visible to all users
- **Storage**: `calendarEvents` collection
- **Fields**: `title`, `description`, `dateKey`, `isPublic: true`, `createdBy`, `createdByAdmin: true`
- **Access**: Only admins and super users can create

### 2. Personal Events (All Users)
- **Badge**: Blue "Private" badge
- **Visibility**: Only visible to the user who created them
- **Storage**: `calendarEvents` collection
- **Fields**: `title`, `description`, `dateKey`, `isPublic: false`, `createdBy`, `createdByAdmin: false`
- **Access**: All logged-in users can create
- **Display Section**: Appears in "Personal Events" section in day details modal

### 3. Customer Events (All Users)
- **Badge**: Purple gradient "Family" badge
- **Visibility**: Visible to the customer's owner (admin can see all)
- **Storage**: `customers` collection → `events` array
- **Fields**: `title`, `description`, `date`, `personId`, `personName`, `createdAt`
- **Access**: All logged-in users can create
- **Special Features**:
  - Select customer from dropdown
  - Optionally select specific family member
  - If family member selected, event shows their name
  - Events display with purple gradient styling

## Features Implemented

### Add Event Modal
Similar to the Add Tithi modal with:
- **Event Type Selection**: Radio buttons for Public/Private/Customer
  - Public option only visible to admins/super users
  - Private is default selection for regular users
  - Customer option shows additional fields

- **Customer Selection** (for Customer Events):
  - Dropdown showing all customers (user's own or all if admin)
  - Resets family member selection when changed

- **Family Member Selection** (for Customer Events):
  - Optional dropdown that appears when customer is selected
  - Shows all family members from selected customer
  - Event will be associated with selected person

- **Event Details**:
  - Title field (required)
  - Description field (optional)
  - Date picker using NepaliDatePicker component

- **Validation**:
  - Title required
  - Date required
  - Customer required for Customer Events
  - User must be logged in

### Display Sections in Day Details Modal

The modal now shows events in four distinct sections:

1. **Tithis Section**
   - Shows lunar calendar tithis
   - Format: Pakshya and Tithi name with date/time range

2. **Public Events Section**
   - Shows public events created by admins
   - Admin events have yellow "Admin" badge
   - Title and description displayed

3. **Personal Events Section** (NEW)
   - Shows user's own private events
   - Blue "Private" badge
   - Only visible to the user who created them
   - Title and description displayed

4. **Customer Events Section**
   - Shows family member events
   - Purple gradient "Family" badge
   - Format: "PersonName: EventTitle"
   - Below: "Customer: CustomerName" (grayed out)
   - Description if available

### Add Event Button
- Replaces old inline form
- Opens dedicated Add Event modal
- Available to all logged-in users
- Located in day details modal actions

## Technical Implementation

### State Management
```javascript
// Modal state
const [addEventModalOpen, setAddEventModalOpen] = useState(false);

// Event form fields
const [eventTitle, setEventTitle] = useState('');
const [eventDescription, setEventDescription] = useState('');
const [eventDate, setEventDate] = useState('');
const [eventType, setEventType] = useState('private'); // 'public', 'private', 'customer'

// Customer/Person selection
const [selectedCustomerId, setSelectedCustomerId] = useState('');
const [selectedPersonId, setSelectedPersonId] = useState('');
const [customers, setCustomers] = useState([]); // Loaded with Firebase listener

// Form status
const [eventValidation, setEventValidation] = useState('');
const [isAddingEvent, setIsAddingEvent] = useState(false);
```

### Data Flow

#### Opening Modal
```javascript
function openAddEventModalForDate(adYear, adMonthZeroBased, adDay) {
  // Set active date
  // Reset form fields
  // Set default event type to 'private'
  // Close details modal
  // Open event modal
}
```

#### Submitting Event
```javascript
async function submitAddEvent() {
  // Validate inputs
  // Check event type
  
  if (eventType === 'customer') {
    // Add to customers.events array
    // Include personId and personName if person selected
  } else {
    // Add to calendarEvents collection
    // Set isPublic based on eventType
    // Set createdByAdmin flag
  }
  
  // Close modal and reset form
}
```

### Firebase Listeners

#### Customers Listener
```javascript
useEffect(() => {
  if (!user || !addEventModalOpen) return;
  
  let q;
  if (isAdmin || isSuperUser) {
    // Load all customers for admin
    q = query(collection(db, 'customers'), orderBy('name'));
  } else {
    // Load only user's customers
    q = query(
      collection(db, 'customers'),
      where('userId', '==', user.uid),
      orderBy('name')
    );
  }
  
  const unsubscribe = onSnapshot(q, snapshot => {
    setCustomers(snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })));
  });
  
  return unsubscribe;
}, [user, addEventModalOpen, isAdmin, isSuperUser]);
```

### Event Filtering

#### Public Events
```javascript
const modalEvents = useMemo(() => {
  if (!activeDate || !calendarEvents.length) return [];
  return calendarEvents.filter(event => 
    event.dateKey === activeDate && 
    (event.isPublic || event.createdByAdmin)
  );
}, [activeDate, calendarEvents]);
```

#### Personal Events
```javascript
const modalPersonalEvents = useMemo(() => {
  if (!activeDate || !calendarEvents.length || !user) return [];
  return calendarEvents.filter(event => 
    event.dateKey === activeDate && 
    !event.isPublic && 
    !event.createdByAdmin &&
    event.createdBy === user.uid
  );
}, [activeDate, calendarEvents, user]);
```

#### Customer Events
```javascript
const modalCustomerEvents = useMemo(() => {
  if (!activeDate) return [];
  const parts = activeDate.split('-').map(p=>+p);
  const adYear = parts[0];
  const adMonthZeroBased = parts[1]-1;
  const adDay = parts[2];
  return findCustomerEventsForAdDate(adYear, adMonthZeroBased, adDay) || [];
}, [activeDate, findCustomerEventsForAdDate]);
```

## Styling

### Customer Event Styling (Purple Gradient)
```css
/* In day card summary */
.nt-summary-item.customer-event {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* In modal item */
.nc-item.customer-event-item {
  border: 2px solid transparent;
  background-image: 
    linear-gradient(white, white),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
```

## User Experience

### For Regular Users
1. Click any day to open details modal
2. Click "Add Event" button
3. Select event type:
   - **Personal Event**: For private reminders, tasks, etc.
   - **Customer Event**: For family member events like birthdays, anniversaries
4. Fill in event details
5. For Customer Events: Select customer and optionally family member
6. Click "Add Event" to save

### For Admins/Super Users
- Same as regular users, plus:
- Can select "Public Event" to create events visible to all users
- Can see all customers when creating Customer Events
- Can see all customer events in calendar

## File Changes

### Modified Files
1. **src/components/NepaliCalendar.js**
   - Added event modal state management
   - Added customers Firebase listener
   - Created `openAddEventModalForDate()` function
   - Created `submitAddEvent()` function
   - Added event type filtering (public, personal, customer)
   - Created Personal Events section in modal
   - Created Add Event modal UI
   - Replaced inline Add Event form with modal button
   - Updated Firebase imports (getDoc, updateDoc, serverTimestamp)

2. **src/components/NepaliCalendar.css**
   - Already includes customer event styling from previous implementation

### Data Models

#### calendarEvents Collection
```javascript
{
  id: string,
  title: string,
  description: string,
  dateKey: string, // YYYY-MM-DD
  isPublic: boolean,
  createdBy: string, // user.uid
  createdByAdmin: boolean,
  createdAt: Timestamp
}
```

#### customers.events Array
```javascript
{
  title: string,
  description: string,
  date: string, // YYYY-MM-DD
  personId: string, // optional
  personName: string, // optional
  createdAt: Timestamp
}
```

## Testing Checklist

- [ ] Regular users can create Personal Events
- [ ] Regular users can create Customer Events
- [ ] Personal Events only visible to creator
- [ ] Customer Events visible to owner (and admins)
- [ ] Admins can create Public Events
- [ ] Public Events visible to all users
- [ ] Customer dropdown shows correct customers based on role
- [ ] Family member dropdown appears only when customer selected
- [ ] Family member dropdown shows correct members for selected customer
- [ ] Customer Events properly saved to customers.events array
- [ ] Public/Personal Events properly saved to calendarEvents collection
- [ ] Events display in correct sections of modal
- [ ] Event badges show correct colors and labels
- [ ] Date picker works correctly with Nepali calendar
- [ ] Modal closes and resets form on cancel
- [ ] Validation messages display for missing fields
- [ ] Loading state shows while submitting

## Future Enhancements

### Potential Features
1. **Edit Events**: Allow users to edit their own events
2. **Delete Events**: Allow users to delete their own events
3. **Event Reminders**: Email/notification reminders before event date
4. **Recurring Events**: Support for yearly recurring events (birthdays, anniversaries)
5. **Event Categories**: Color-coded categories for different event types
6. **Event Search**: Search/filter events across calendar
7. **Event Export**: Export events to iCal format
8. **Event Attachments**: Attach images or documents to events
9. **Event Privacy Levels**: More granular privacy settings
10. **Bulk Event Import**: CSV import for multiple events

## Notes

- Date format is consistently YYYY-MM-DD (zero-padded) across all event types
- All dates use Gregorian (AD) format internally, displayed as Nepali (BS) in UI
- NepaliDatePicker component handles BS/AD conversion automatically
- Customer events support both 'title' and 'name' fields for backward compatibility
- Event creation requires authentication (user must be logged in)
- Personal Events introduced separate from Public Events for better organization
- Modal structure follows same pattern as Add Tithi modal for consistency
