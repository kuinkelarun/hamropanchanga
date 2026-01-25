# Quick Template Reference

## Column Count & Required Fields

### Trees Template
- **Columns**: 4 (All required from create form)
- **Required**: 4 (Tree Name *, Primary Member Name *, Contact Information *, Location *)

### Members Template  
- **Columns**: 14 (All member form fields)
- **Required**: 2 (Tree Name *, Member Name *)
- **Conditional**: DOB Year/Month/Day (all 3 if any), DOD Year/Month/Day (if Status="Passed Away")

### Events Template
- **Columns**: 7 (Event details)
- **Required**: 4 (Tree Name *, Member Name *, Event Name *, Event Date)

---

## Tree Fields Mapping

From **Create Tree Form** (TreeSelectionPage) → Template Columns:

| Form Field | Template Column | Type | Required | Notes |
|------------|-----------------|------|----------|-------|
| Tree Name  | Tree Name * | Text | YES | 255 char max, must be unique |
| Primary Member Name | Primary Member Name * | Text | YES | 255 char max, founding member |
| Contact Info | Contact Information * | Text | YES | Phone or email |
| Location   | Location * | Text | YES | City, Country format |

| Form Field | Template Column | Type | Required | Notes |
|------------|-----------------|------|----------|-------|
| Tree Name  | Tree Name * | Text | YES | Must exist |
| Name *     | Member Name * | Text | YES | 255 char max |
| Nickname   | Nickname | Text | NO | 255 char max |
| Gender     | Gender | Select | NO | M/F/Non-binary/Prefer not |
| DOB        | DOB Year/Month/Day | Number | NO* | All 3 required if any |
| Status     | Status | Select | NO | Alive or Passed Away |
| DOD        | DOD Year/Month/Day | Number | NO* | If Passed Away, required |
| Location   | Location | Text | NO | City, Country |
| Photo URL  | Photo URL | Text | NO | https:// only |
| Notes      | Notes | Text | NO | 1000 char max |

---

## Event Fields Mapping

From **AddEventForm** Form → Template Columns:

| Form Field | Template Column | Type | Required | Notes |
|------------|-----------------|------|----------|-------|
| Tree Name  | Tree Name * | Text | YES | Must exist |
| Member Name| Member Name * | Text | YES | Must exist |
| Event Name | Event Name * | Text | YES | 255 char max |
| Description| Description | Text | NO | 1000 char max |
| Event Date | Event Date (YYYY-MM-DD) | Date | YES | ISO format |
| Repetition | Repetition | Select | NO | none/monthly/yearly |
| Notes      | Notes | Text | NO | 1000 char max |

---

## Date Entry Format

### For DOB/DOD in Members Template:
- **DOB Year**: YYYY (e.g., 1950)
- **DOB Month**: 01-12 (e.g., 05 for May)
- **DOB Day**: 01-31 (e.g., 15)

**Rule**: All three must be provided together or none at all.

**Example**: 
- Year: 1950, Month: 05, Day: 15 = May 15, 1950

### For Event Date in Events Template:
- **Format**: YYYY-MM-DD (e.g., 1950-05-15)
- **REQUIRED**: Must be provided
- **Invalid Formats**: 05/15/1950, 15-05-1950, 5/15/50

---

## Dropdown Values

### Gender (Members Only)
- Male
- Female
- Non-binary
- Prefer not to say
- (Leave blank if unknown)

### Status (Members Only)
- Alive (default if blank)
- Passed Away

### Repetition (Events Only)
- none (default if blank)
- monthly
- yearly

---

## Validation Quick Check

### Before Upload, Verify:

#### Trees Template
- [ ] Tree Name not blank
- [ ] Primary Member Name not blank
- [ ] Contact Information not blank (phone or email format)
- [ ] Location not blank
- [ ] No duplicate tree names
- [ ] All fields < 255 chars

#### Members Template
- [ ] Tree Name matches existing tree
- [ ] Member Name not blank
- [ ] If Gender provided, use exact values
- [ ] If any DOB provided, ALL 3 required (Y/M/D)
- [ ] If Status="Passed Away", DOD required
- [ ] Photo URL starts with https://
- [ ] Notes < 1000 chars

#### Events Template
- [ ] Tree Name matches existing tree
- [ ] Member Name matches existing member
- [ ] Event Name not blank
- [ ] Event Date in YYYY-MM-DD format
- [ ] If Repetition provided, use: none/monthly/yearly
- [ ] Description < 1000 chars

---

## Upload Workflow

```
1. Trees Page
   ↓
2. Click "📁 Build From File Upload"
   ↓
3. Confirmation Dialog (proceed)
   ↓
4. BulkUploadModal Opens
   ↓
5. Select Tab (Trees/Members/Events)
   ↓
6. Download Template
   ↓
7. Fill Template with Data
   ↓
8. Upload File (drag-drop or select)
   ↓
9. Real-time Validation
   ↓
10. Preview (first 5 rows)
   ↓
11. Click "Create Trees/Members/Events"
   ↓
12. Batch Processing (Firebase operations)
   ↓
13. Results Summary (success/failed counts)
```

---

## Error Messages & Fixes

### Common Member Errors
| Error | Fix |
|-------|-----|
| Tree "X" does not exist | Check tree name spelling (case-sensitive) |
| Member already exists | Use different name or add nickname |
| All three date parts required | If providing DOB, need Year/Month/Day all |
| Gender must be one of... | Use exact values: Male, Female, Non-binary, Prefer not |
| Photo URL invalid | Must start with https:// |
| Date of Death required | If Status="Passed Away", must provide DOD |

### Common Event Errors
| Error | Fix |
|-------|-----|
| Tree "X" does not exist | Check tree name (case-sensitive) |
| Member "X" not found | Check member name spelling in that tree |
| Event Date required | Must provide in YYYY-MM-DD format |
| Invalid Event Date format | Use YYYY-MM-DD (not 05/15/1950) |
| Repetition must be one of... | Use: none, monthly, or yearly |

---

## Helpful Examples

### Member with All Fields
```
Tree Name: Smith Family
Member Name: John Smith
Nickname: Jack
Gender: Male
DOB Year: 1950
DOB Month: 05
DOB Day: 15
Status: Alive
DOD Year: (empty)
DOD Month: (empty)
DOD Day: (empty)
Location: New York, USA
Photo URL: https://example.com/john.jpg
Notes: Family patriarch, business owner
```

### Deceased Member
```
Tree Name: Smith Family
Member Name: Robert Smith
Nickname: Bob
Gender: Male
DOB Year: 1920
DOB Month: 01
DOB Day: 10
Status: Passed Away
DOD Year: 2000
DOD Month: 06
DOD Day: 15
Location: Boston, USA
Photo URL: (empty)
Notes: Grandfather
```

### Event with Repetition
```
Tree Name: Smith Family
Member Name: John Smith
Event Name: Anniversary
Description: Wedding anniversary
Event Date: 1975-06-20
Repetition: yearly
Notes: Celebrate annually on June 20
```

---

## Tips & Tricks

✅ **DO**
- Use UTF-8 encoding for special characters
- Keep column headers exactly as shown
- Test with 2-3 rows first
- Review validation warnings before upload
- Check Firestore after upload to verify data

❌ **DON'T**
- Modify column headers
- Add new columns
- Change column order
- Mix different data types in same column
- Manually add Member IDs

---

## Support

- Check BULK_UPLOAD_TEMPLATE_MAPPING.md for detailed field reference
- Check TEMPLATE_ENHANCEMENT_SUMMARY.md for implementation details
- Review error messages in validation results
- Check Firestore directly to verify stored data

---

**Last Updated**: January 19, 2026
**Status**: Ready for Testing
