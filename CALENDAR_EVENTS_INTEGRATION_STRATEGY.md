# Calendar Events Integration Strategy

## Overview
Strategy for displaying customer/family events in the main Nepali Calendar.

## Current Architecture

### Data Structure
**Customer Events** (in Firestore `customers` collection):
```javascript
{
  id: "customer-id",
  name: "Customer Name",
  familyMembers: {
    "member-id": {
      id: "member-id",
      name: "Member Name",
      relation: "Son"
    }
  },
  events: [
    {
      id: "event-id",
      name: "Birthday",
      date: "2025-12-25", // ISO format
      personId: "member-id",
      personName: "Member Name",
      personRelation: "Son",
      type: "birthday" // or anniversary, death-anniversary, etc.
    }
  ]
}
```

**Calendar Events** (in Firestore `calendarEvents` collection):
```javascript
{
  id: "event-id",
  name: "Event Name",
  dateKey: "YYYY-MM-DD",
  type: "personal", // or public, religious
  userId: "user-id" // for filtering
}
```

## Implementation Strategy

### Option 1: Real-time Event Synchronization (Recommended)

#### Step 1: Create Cloud Function to Sync Events
```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.syncCustomerEventsToCalendar = functions.firestore
  .document('customers/{customerId}')
  .onWrite(async (change, context) => {
    const customerId = context.params.customerId;
    const db = admin.firestore();
    
    // Get the new data
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;
    
    if (!newData) {
      // Customer deleted - remove all associated events
      const eventsToDelete = await db.collection('calendarEvents')
        .where('customerId', '==', customerId)
        .get();
      
      const batch = db.batch();
      eventsToDelete.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return;
    }
    
    const userId = newData.userId;
    const newEvents = newData.events || [];
    const oldEvents = oldData?.events || [];
    
    // Sync each event
    const batch = db.batch();
    
    // Add/Update events
    for (const event of newEvents) {
      const calendarEventRef = db.collection('calendarEvents').doc(`customer-${customerId}-${event.id}`);
      batch.set(calendarEventRef, {
        id: `customer-${customerId}-${event.id}`,
        name: `${event.name} - ${event.personName} (${event.personRelation})`,
        dateKey: event.date,
        type: 'personal',
        eventType: event.type || 'custom',
        userId: userId,
        customerId: customerId,
        customerName: newData.name,
        personId: event.personId,
        personName: event.personName,
        personRelation: event.personRelation,
        source: 'customer-event',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    // Delete removed events
    const newEventIds = new Set(newEvents.map(e => e.id));
    const removedEvents = oldEvents.filter(e => !newEventIds.has(e.id));
    
    for (const event of removedEvents) {
      const calendarEventRef = db.collection('calendarEvents').doc(`customer-${customerId}-${event.id}`);
      batch.delete(calendarEventRef);
    }
    
    await batch.commit();
  });
```

#### Step 2: Update Calendar Component to Display Customer Events
```javascript
// src/components/NepaliCalendar.js

useEffect(() => {
  if (!user) return;
  
  // Fetch calendar events for this user
  const eventsQuery = query(
    collection(db, 'calendarEvents'),
    where('userId', '==', user.uid)
  );
  
  const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
    const events = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const dateKey = data.dateKey;
      
      if (!events[dateKey]) {
        events[dateKey] = [];
      }
      
      events[dateKey].push({
        id: doc.id,
        name: data.name,
        type: data.type,
        eventType: data.eventType,
        source: data.source,
        customerId: data.customerId,
        customerName: data.customerName,
        personName: data.personName,
        personRelation: data.personRelation
      });
    });
    
    setCalendarEvents(events);
  });
  
  return () => unsubscribe();
}, [user]);
```

#### Step 3: Display Events in Calendar Cell
```javascript
// In calendar cell rendering
{calendarEvents[dateKey]?.map(event => (
  <div 
    key={event.id} 
    className={`event-item ${event.source === 'customer-event' ? 'customer-event' : ''}`}
    style={{
      background: event.source === 'customer-event' 
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : '#f59e0b',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      marginBottom: '2px'
    }}
  >
    <div className="event-name">{event.name}</div>
    {event.personName && (
      <div className="event-person" style={{ fontSize: '0.7rem', opacity: 0.9 }}>
        {event.personName} ({event.personRelation})
      </div>
    )}
  </div>
))}
```

### Option 2: Client-side Aggregation (Simpler, No Cloud Functions)

#### Step 1: Fetch and Aggregate Events in Calendar Component
```javascript
// src/components/NepaliCalendar.js

const [customerEvents, setCustomerEvents] = useState({});

useEffect(() => {
  if (!user) return;
  
  // Fetch all customer documents for this user
  const customersQuery = query(
    collection(db, 'customers'),
    where('userId', '==', user.uid)
  );
  
  const unsubscribe = onSnapshot(customersQuery, (snapshot) => {
    const aggregatedEvents = {};
    
    snapshot.docs.forEach(doc => {
      const customer = doc.data();
      const events = customer.events || [];
      
      events.forEach(event => {
        const dateKey = event.date; // YYYY-MM-DD format
        
        if (!aggregatedEvents[dateKey]) {
          aggregatedEvents[dateKey] = [];
        }
        
        aggregatedEvents[dateKey].push({
          id: `${doc.id}-${event.id}`,
          name: event.name,
          personName: event.personName,
          personRelation: event.personRelation,
          type: event.type || 'custom',
          customerName: customer.name,
          customerId: doc.id,
          source: 'customer-event'
        });
      });
    });
    
    setCustomerEvents(aggregatedEvents);
  });
  
  return () => unsubscribe();
}, [user]);

// Merge with existing calendar events
const allEvents = { ...calendarEvents };
Object.keys(customerEvents).forEach(dateKey => {
  if (!allEvents[dateKey]) {
    allEvents[dateKey] = [];
  }
  allEvents[dateKey] = [...allEvents[dateKey], ...customerEvents[dateKey]];
});
```

#### Step 2: Add Event Filtering
```javascript
// Add filter toggle in calendar UI
const [showCustomerEvents, setShowCustomerEvents] = useState(true);
const [showCalendarEvents, setShowCalendarEvents] = useState(true);

// Filter events based on toggle
const filteredEvents = {};
Object.keys(allEvents).forEach(dateKey => {
  filteredEvents[dateKey] = allEvents[dateKey].filter(event => {
    if (event.source === 'customer-event') return showCustomerEvents;
    return showCalendarEvents;
  });
});
```

## Recommended Approach

**Use Option 1 (Cloud Functions)** if:
- You want real-time sync across devices
- You need better performance with large datasets
- You want to avoid loading all customer data in the calendar
- You plan to add advanced features like notifications

**Use Option 2 (Client-side)** if:
- You want simpler implementation
- You have relatively small datasets
- You don't want to manage Cloud Functions
- You're in development/testing phase

## Visual Distinction

### Event Type Colors
- **Customer Events**: Purple gradient (matching app theme)
- **Calendar Events**: Amber/Orange
- **Tithis**: Yellow gradient
- **Public Holidays**: Blue

### Event Display Format
```
[Event Type Icon] Event Name
👤 Person Name (Relation)
📅 Customer Name
```

## Database Indexes Required

### For Option 1 (Cloud Functions):
```javascript
// Firestore indexes needed:
calendarEvents: {
  userId: "asc",
  dateKey: "asc"
}
```

### For Option 2 (Client-side):
```javascript
// Existing index already present:
customers: {
  userId: "asc"
}
```

## Migration Steps

1. ✅ Remove tree visualization from CustomerDetail
2. ✅ Replace with Family Members list view
3. ✅ Keep event-to-member linking intact
4. ⏳ Choose integration strategy (Option 1 or 2)
5. ⏳ Implement chosen strategy
6. ⏳ Add event filtering UI in calendar
7. ⏳ Test event synchronization
8. ⏳ Add visual distinctions for different event types
9. ⏳ Deploy and monitor

## Future Enhancements

1. **Event Categories**: Birthday, Anniversary, Death Anniversary, Custom
2. **Recurring Events**: Annual, Monthly, Weekly
3. **Event Reminders**: Push notifications
4. **Event Sharing**: Share events with family members
5. **Event Templates**: Pre-defined event types
6. **Calendar Export**: iCal, Google Calendar integration
7. **Event Search**: Search events across all customers

## Notes

- Events maintain the link to family members via `personId`
- Customer events automatically sync to calendar
- Users can toggle visibility of customer events
- Each event shows which customer/family member it belongs to
- Events are user-scoped (only visible to the owner)
