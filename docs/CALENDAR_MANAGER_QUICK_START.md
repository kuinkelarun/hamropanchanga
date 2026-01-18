# Nepali Calendar Management - Quick Start Guide

## What's New?
A brand new **Calendar Manager** tab has been added to the Admin Management page. This allows admins to manage the Nepali calendar without touching code.

## How to Access

1. **Log in** as an admin or super user with calendar management permissions
2. Go to **Settings → Admin Management**
3. Click the **🗓️ Calendar Manager** tab
4. You'll see three modes:
   - 👁️ **View Years** - Browse existing calendar years
   - ➕ **Add Year** - Create new Nepali years
   - ✏️ **Edit Year** - Modify existing years

## Common Tasks

### Viewing Calendar Years
1. Click the **👁️ View Years** button (selected by default)
2. Browse the year cards in the grid
3. Each card shows:
   - Nepali year number
   - Whether it's a leap year (🔄)
   - Start date in Gregorian calendar
   - Total days in the year

### Adding a New Year
**Scenario**: Need to add year 2090 (coming soon)

1. Click **➕ Add Year** button
2. Fill in the form:
   - **Nepali Year**: Enter `2090`
   - **Start AD Date**: Select April 13, 2026 (for example)
   - **Days in Each Month**: Adjust each month's days
     - Most months: 30-31 days
     - Some: 29 or 32 days
3. Watch the **Total Days** indicator:
   - Shows ✅ **Regular Year** for 365 days
   - Shows 🔄 **Leap Year** for 366 days
4. Review the Summary panel for accuracy
5. Click **➕ Add Year** to save

### Editing an Existing Year
**Scenario**: Need to fix month days for year 2082

1. Click **👁️ View Years** to see all years
2. Click on the year card for 2082 (it will highlight)
3. Click the **Edit** button on the card (or click ✏️ Edit Year tab)
4. Modify the month configurations as needed
5. The form auto-calculates if it's a leap year
6. Click **💾 Save Changes**

## Month Configuration Guide

### The 12 Nepali Months (In Order)
| Number | Name (Nepali) | Name (English) | Typical Days |
|--------|---|---|---|
| 1 | चैत्र्र | Chaitra | 29-31 |
| 2 | वैशाख | Vaisakha | 30-32 |
| 3 | ज्येष्ठ | Jyeshtha | 31-32 |
| 4 | आषाढ़ | Ashadha | 31-32 |
| 5 | श्रावण | Shravan | 30-31 |
| 6 | भाद्रपद | Bhadrapada | 29-30 |
| 7 | आश्विन | Ashwin | 29-30 |
| 8 | कार्तिक | Kartik | 28-30 |
| 9 | मार्गशीर्ष | Margshirsh | 29-30 |
| 10 | पौष | Paush | 29-30 |
| 11 | माघ | Magh | 29-30 |
| 12 | फाल्गुन | Phalgun | 30-31 |

### Days Rules
- **Minimum**: 29 days per month
- **Maximum**: 32 days per month
- **Total**: Must be exactly 365 or 366 days
- **Leap Year**: Any year with 366 total days automatically marked as leap year

### Example: Regular Year (365 days)
```
चैत्र्र: 31, वैशाख: 31, ज्येष्ठ: 32, आषाढ़: 32, श्रावण: 31, भाद्रपद: 30,
आश्विन: 30, कार्तिक: 30, मार्गशीर्ष: 29, पौष: 30, माघ: 29, फाल्गुन: 31
Total: 365 days ✅ Regular Year
```

### Example: Leap Year (366 days)
```
Same as above but फाल्गुन: 32 instead of 31
Total: 366 days 🔄 Leap Year
```

## Form Validation Messages

### Error Messages & How to Fix

| Error | Meaning | Fix |
|-------|---------|-----|
| "Year and Start Date are required" | Missing required fields | Fill in both year and date fields |
| "Year must be between 1900 and 2500" | Invalid year range | Enter year within valid range |
| "Year already exists" | Can't add duplicate | Use Edit mode instead |
| "Total days must be 365 or 366" | Wrong total | Adjust month days: <365 add days, >366 reduce days |

### Success Messages
- ✅ "Year XXXX added successfully!" → Year created (backend sync needed)
- ✅ "Year XXXX updated successfully!" → Year modified (backend sync needed)

## Quick Tips

✨ **Pro Tips**
1. **Use Edit Mode to modify years** - Click a year card and it auto-loads into edit form
2. **Total Days Indicator** - Always check the total before saving
3. **Month Grid** - You can edit months in any order; system validates as you go
4. **Summary Panel** - Review everything before clicking save
5. **Cancel Anytime** - Click Cancel to discard changes and return to view mode

⚠️ **Important Notes**
1. Admin must have **MANAGE_CALENDAR** permission (set by main admin)
2. Year numbers must be unique (no duplicates allowed)
3. Cannot delete years (only add/edit)
4. Start date should be the Gregorian date when the Nepali year begins
5. Changes are not persistent yet (backend integration in progress)

## Permissions

### Who Can Access?
- ✅ **Admins**: Always have access
- ⚠️ **Super Users**: Only if admin grants MANAGE_CALENDAR permission

### Checking Your Permission
1. If you see the **🗓️ Calendar Manager** tab → You have access
2. If tab is grayed out or missing → Ask admin for permission
3. Contact admin at [admin-email] to request access

## Common Use Cases

### Use Case 1: Add Years for Future
**When**: Preparing calendar for coming Nepali years
**Steps**:
1. Get official calendar data for new years
2. Add each year via ➕ Add Year button
3. Enter exact month configurations
4. Verify with 📊 View Years

### Use Case 2: Correct an Existing Year
**When**: Found error in month days
**Steps**:
1. View the year in 👁️ View Years
2. Click year card → Click Edit button
3. Fix the month days
4. Click 💾 Save Changes

### Use Case 3: Add Special Year Configuration
**When**: Adding non-standard year setup
**Steps**:
1. Click ➕ Add Year
2. Fill in all month values carefully
3. Watch total days indicator
4. Review summary
5. Save when ready

## Troubleshooting

### Problem: "You are about to..." but no button appears
**Solution**: Scroll down or check browser console for errors

### Problem: Changes not showing after save
**Solution**: Backend integration not yet complete. This is normal.
**Next Step**: Contact development team for backend sync setup

### Problem: Year already exists error
**Solution**: The year you're trying to add is already in the system.
- Use Edit mode instead
- Or choose a different year number

### Problem: Total days won't equal 365/366
**Debug**:
1. Check the total days counter at top of month grid
2. Add up all months manually
3. Remember: must be exactly 365 or 366
4. Adjust one month by needed difference

## Getting Help

**Questions?** Check these resources:
1. 📖 Full documentation: `docs/NEPALI_CALENDAR_MANAGEMENT.md`
2. 💬 Ask your admin for clarification
3. 🐛 Report issues via project issue tracker
4. 📧 Contact development team

## Next Steps

1. **Access the feature**: Go to Admin Management → Calendar Manager
2. **View existing years**: Click View Years to see what's already there
3. **Try adding a year**: Test with Add Year button
4. **Provide feedback**: Let admins know what works and what needs improvement

---

**Version**: 1.0  
**Status**: Feature Complete (Backend Integration Pending)  
**Last Updated**: January 2, 2026
