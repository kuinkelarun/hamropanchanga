# Nepali Calendar Management - Admin Feature

## Overview
The Nepali Calendar Management tab provides a user-friendly interface for administrators to manage the Nepali (Bikram Sambat/BS) calendar system without requiring code access. This feature allows admins to add new years, update month configurations, specify leap years, and manage existing calendar data.

## Location
- **Path**: Admin Management → 🗓️ Calendar Manager Tab
- **Access Level**: Admin or users with `MANAGE_CALENDAR` permission
- **UI Component**: `NepaliCalendarManagement.js`
- **Data Source**: `src/data/bsCalendarData.js`

## Features

### 1. View Calendar Years
- Display all existing Nepali years in a grid layout
- Each year card shows:
  - **Nepali Year Number** (e.g., 2082)
  - **Leap Year Badge** (🔄 Leap or Regular)
  - **Start Date** (in Gregorian/AD calendar format)
  - **Total Days** (365 or 366)
  - **Edit Button** (for admins with permission)

### 2. Add New Year
Allows admins to add completely new Nepali years with custom configurations:

**Form Fields:**
- **Nepali Year*** - Year number (1900-2500 range)
- **Start AD Date*** - The Gregorian date when this Nepali year begins
- **Days in Each Month** - 12 input fields for months:
  - चैत्र्र (Chaitra)
  - वैशाख (Vaisakha)
  - ज्येष्ठ (Jyeshtha)
  - आषाढ़ (Ashadha)
  - श्रावण (Shravan)
  - भाद्रपद (Bhadrapada)
  - आश्विन (Ashwin)
  - कार्तिक (Kartik)
  - मार्गशीर्ष (Margshirsh)
  - पौष (Paush)
  - माघ (Magh)
  - फाल्गुन (Phalgun)

**Validation:**
- Each month must have 29-32 days
- Total days must be either 365 (regular) or 366 (leap year)
- Year must be unique (no duplicates allowed)
- Start date is required

### 3. Edit Existing Year
Modify configurations of already existing years:

**Editable Fields:**
- Start AD Date
- Days in each month
- System automatically calculates if it's a leap year (366 days) or regular year (365 days)

**Read-only Fields:**
- Year number (cannot be changed once created)

### 4. Leap Year Management
- **Automatic Detection**: System automatically identifies leap years based on total days (366)
- **Display**: Leap years are marked with 🔄 badge in year cards
- **Summary**: Clear indication in the form summary whether the configured year is a leap year

## Form Summary
The form displays a real-time summary of the year being configured:
- Year number
- Start date (formatted)
- Total days count
- Year type (Leap Year or Regular Year)

## Month Information

### Month Names (Nepali)
1. **चैत्र्र** (Chaitra) - March/April
2. **वैशाख** (Vaisakha) - April/May
3. **ज्येष्ठ** (Jyeshtha) - May/June
4. **आषाढ़** (Ashadha) - June/July
5. **श्रावण** (Shravan) - July/August
6. **भाद्रपद** (Bhadrapada) - August/September
7. **आश्विन** (Ashwin) - September/October
8. **कार्तिक** (Kartik) - October/November
9. **मार्गशीर्ष** (Margshirsh) - November/December
10. **पौष** (Paush) - December/January
11. **माघ** (Magh) - January/February
12. **फाल्गुन** (Phalgun) - February/March

### Days Range
- **Minimum**: 29 days per month
- **Maximum**: 32 days per month
- **Common Values**: Most months have 29-31 days, with some variations

## User Interface

### Mode Selector Buttons
1. **👁️ View Years** - Browse existing years in the system
2. **➕ Add Year** - Create a new Nepali year (admin only)
3. **✏️ Edit Year** - Modify an existing year (admin only)

### Alert Messages
- **Success** (Green) - "Year XXXX added/updated successfully!"
- **Error** (Red) - Validation errors or form failures
- **Warning** (Yellow) - Important information

### Year Card Interactions
- Click a year card to select it
- Selected cards highlight in green
- Edit button appears for quick editing

### Form Section
- Organized layout with clear field labels
- Real-time validation
- Month grid with individual inputs
- Summary panel with quick stats
- Cancel and Save buttons

## Data Structure

```javascript
{
  year: 2082,
  startAdDate: "2025-04-13", // Gregorian date
  isLeapYear: false,
  daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]
}
```

## Permissions

### MANAGE_CALENDAR Permission
- **Type**: Assignable to Super Users
- **Default for Admins**: ✅ Enabled
- **Default for Super Users**: ❌ Disabled (can be enabled by admin)
- **Visibility**: "Calendar Manager" tab hidden if user lacks permission

### Permission Checks
- Tab button is disabled if user lacks MANAGE_CALENDAR permission
- Add Year button is disabled if user lacks permission
- Edit Year button is disabled if user lacks permission
- View Years is always accessible

## Backend Integration (TODO)

Currently, the interface shows mock success messages. To make it fully functional:

1. **Create Firestore Collection**: `nepaliCalendarData` or update `bsCalendarData`
2. **Add Function**: Handle year addition/updates to database
3. **Validation**: Server-side validation before saving
4. **Version Control**: Track changes and maintain calendar history

### Suggested Firebase Structure
```javascript
// Collection: nepaliCalendarData
{
  docId: "2082",
  year: 2082,
  startAdDate: Timestamp,
  isLeapYear: false,
  daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com"
}
```

## CSS Styling

### File
- `src/styles/NepaliCalendarManagement.css`

### Features
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Gradient Backgrounds**: Professional color scheme
- **Smooth Animations**: Slide-in alerts, hover effects
- **Clear Visual Hierarchy**: Headers, sections, and interactive elements

### Color Scheme
- **Primary Blue**: #3498db (buttons, borders)
- **Success Green**: #27ae60 (save buttons, leap year)
- **Danger Red**: #c0392b (validation errors)
- **Warning Orange**: #f39c12 (info cards)
- **Light Gray**: #ecf0f1 (backgrounds, borders)

## Usage Example

### Adding a New Year
1. Navigate to Admin Management
2. Click 🗓️ Calendar Manager tab
3. Click ➕ Add Year button
4. Enter year number (e.g., 2082)
5. Select start AD date (April 13, 2025)
6. Configure days for each month
7. Review summary
8. Click ➕ Add Year to save

### Editing Existing Year
1. View Years mode (default)
2. Click on year card to select
3. Card highlights and Edit button appears
4. Click Edit or ✏️ Edit Year mode button
5. Modify dates and month configurations
6. Click 💾 Save Changes

## Responsive Behavior

### Desktop
- Year grid: Multiple columns
- Month input grid: 6 columns
- Form layout: Two-column where applicable
- Sidebar navigation available

### Tablet
- Year grid: 2-3 columns
- Month input grid: 3 columns
- Full-width form
- Responsive buttons

### Mobile
- Year grid: Single column
- Month input grid: 2 columns
- Stacked form layout
- Full-width buttons

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Security Considerations
- Only accessible to admins with MANAGE_CALENDAR permission
- Input validation on client and server (recommended)
- Audit trail for calendar changes (recommended)
- No deletion of existing years (only add/edit)

## Future Enhancements

1. **Bulk Import**: Upload CSV with multiple years
2. **Calendar Validation**: Check for gaps or overlaps
3. **Export**: Download current calendar data
4. **History**: View change history and revert changes
5. **Comparison**: Side-by-side year comparison
6. **Templates**: Pre-built templates for common patterns
7. **Sync**: Automatic sync from authoritative calendar source
8. **Notifications**: Notify users of calendar updates

## Troubleshooting

### "No permission to manage calendar"
- Contact administrator
- Verify MANAGE_CALENDAR permission is enabled for your account

### Year validation error
- Ensure year is between 1900-2500
- Check that year doesn't already exist
- Verify total days is 365 or 366

### Month days validation error
- Each month must have 29-32 days
- Total days must equal exactly 365 or 366
- Check the total days indicator for current sum

### Changes not saving
- Backend integration needed (see TODO section)
- Check browser console for errors
- Verify Firestore rules allow writes

## Support
For issues or feature requests, contact the development team or file an issue in the project repository.
