# Bulk Upload Template Field Mapping

## Overview
All bulk upload templates now include **complete field mappings** directly from the corresponding UI forms:
- **Trees Template** → TreeSelectionPage tree creation
- **Members Template** → MemberModal (full form fields)
- **Events Template** → AddEventForm (complete event creation)

This ensures users can upload data using **all available fields** without limitations.

---

## 1. TREES TEMPLATE

### Form Source: TreeSelectionPage - Create Tree Modal
Creates new family trees with all required tree-level information.

### Template Columns

| Column | Type | Required | Max Length | Description |
|--------|------|----------|-----------|-------------|
| **Tree Name *** | Text | YES | 255 chars | Unique name for the family tree |
| **Primary Member Name *** | Text | YES | 255 chars | Name of the main/founding family member |
| **Contact Information *** | Text | YES | 255 chars | Phone (+1-555-0101) or email (contact@example.com) |
| **Location *** | Text | YES | 255 chars | City and Country where family is based |

### Example Data
```
Tree Name *          | Primary Member Name * | Contact Information *  | Location
------------------|----------------------|---------------------|-------------------
Smith Family        | John Smith          | +1-555-0123        | New York, USA
Johnson Household   | Mary Johnson        | mary@example.com    | Boston, USA
Anderson Clan       | Robert Anderson     | +1-212-555-0456    | Los Angeles, USA
```

### Rules
- **All fields are REQUIRED** - Tree cannot be created with any missing fields
- Tree Name must be unique (no duplicates in system)
- Contact can be phone number or email address
- System automatically adds: owner, createdAt, updatedAt timestamps
- Primary Member Name is displayed on tree cards
- Contact and Location appear on tree details

---

## 2. MEMBERS TEMPLATE

### Form Source: MemberModal
Adds family members to existing trees with complete personal information.

### Template Columns

| Column | Type | Required | Max Length | Description |
|--------|------|----------|-----------|-------------|
| **Tree Name *** | Text | YES | Ref | Must match existing tree name exactly |
| **Member Name *** | Text | YES | 255 chars | Full name of the family member |
| **Nickname** | Text | NO | 255 chars | Shortened name (Jack, Bob, etc.) |
| **Gender** | Dropdown | NO | - | Male, Female, Non-binary, Prefer not to say |
| **DOB Year** | Number | NO* | YYYY | Birth year (required if any DOB part given) |
| **DOB Month** | Number | NO* | 01-12 | Birth month (required if any DOB part given) |
| **DOB Day** | Number | NO* | 01-31 | Birth day (required if any DOB part given) |
| **Status** | Dropdown | NO | - | Alive (default), Passed Away |
| **DOD Year** | Number | NO* | YYYY | Death year (required if Status="Passed Away") |
| **DOD Month** | Number | NO* | 01-12 | Death month (required if Status="Passed Away") |
| **DOD Day** | Number | NO* | 01-31 | Death day (required if Status="Passed Away") |
| **Location** | Text | NO | 255 chars | City, Country format |
| **Photo URL** | Text | NO | URL | Direct image link (https://...) |
| **Notes** | Text | NO | 1000 chars | Additional information about member |

### Example Data

**Living Member:**
```
Tree Name * | Member Name * | Nickname | Gender | DOB Year | DOB Month | DOB Day | Status | DOD Year | DOD Month | DOD Day | Location      | Photo URL            | Notes
------------|---------------|----------|--------|----------|-----------|---------|--------|----------|-----------|---------|---------------|----------------------|----------
Smith Fam  | John Smith    | Jack     | Male   | 1950     | 05        | 15      | Alive  |          |           |         | New York, USA | https://ex.com/j.jpg | Patriarch
Smith Fam  | Mary Smith    |          | Female | 1952     | 03        | 20      | Alive  |          |           |         | New York, USA |                      | Matriarch
Smith Fam  | Robert Smith  | Bob      | Male   | 1975     | 07        | 10      | Passed Away | 2020 | 12    | 25      | Boston, USA   |                      | Eldest son
```

### Important Rules

**Date Requirements:**
- All three date parts (Year, Month, Day) must be provided together
- If any part is missing, the entire date is skipped
- Format: Year (YYYY), Month (01-12), Day (01-31)
- Leading zeros required (05 not 5)

**Status & Death Date:**
- If Status = "Passed Away", DOD is required
- DOD fields are ignored if Status = "Alive" (default)
- Both require all three parts if provided

**Gender Values:**
- Male
- Female
- Non-binary
- Prefer not to say
- (Leave blank if unknown)

**Photo URL:**
- Must be valid HTTPS URL
- Should link directly to image file
- Example: `https://example.com/photos/member.jpg`

**Member IDs:**
- Auto-generated as `MEM_${timestamp}_${randomId}`
- Do NOT add Member ID column manually

**Duplicate Detection:**
- Same name + nickname combination triggers duplicate check
- Display name includes both fields for identification

---

## 3. EVENTS TEMPLATE

### Form Source: AddEventForm
Adds events (life milestones) to family members with full event details.

### Template Columns

| Column | Type | Required | Max Length | Description |
|--------|------|----------|-----------|-------------|
| **Tree Name *** | Text | YES | Ref | Must match existing tree name exactly |
| **Member Name *** | Text | YES | Ref | Must match existing member name exactly |
| **Event Name *** | Text | YES | 255 chars | Name/title of event (Birth, Marriage, etc.) |
| **Description** | Text | NO | 1000 chars | Detailed description of the event |
| **Event Date (YYYY-MM-DD)** | Date | YES | YYYY-MM-DD | Event date in ISO 8601 format |
| **Repetition** | Dropdown | NO | - | none (default), monthly, yearly |
| **Notes** | Text | NO | 1000 chars | Additional event information |

### Example Data

```
Tree Name * | Member Name * | Event Name  | Description           | Event Date    | Repetition | Notes
------------|---------------|-------------|----------------------|---------------|-----------|------------------
Smith Fam  | John Smith    | Birth       | Born in New York      | 1950-05-15    | none      | Patriarch born
Smith Fam  | John Smith    | Marriage    | Married to Mary       | 1975-06-20    | yearly    | Wedding anniversary
Smith Fam  | Mary Smith    | Birth       | Born in Boston        | 1952-03-20    | none      | Matriarch born
Smith Fam  | Robert Smith  | Graduation  | College graduation    | 1997-05-22    | none      | Harvard University
Smith Fam  | John Smith    | Retirement  | Retired from business | 2010-01-15    | none      | Retired as CEO
```

### Event Name Examples
- Birth
- Marriage
- Death
- Graduation
- Achievement
- Relocation
- Retirement
- Anniversary
- Promotion
- Other

### Repetition Values
- **none** (default) - Event occurs once
- **monthly** - Event repeats every month on same date
- **yearly** - Event repeats annually (good for anniversaries)

### Important Rules

**Date Format:**
- Must be YYYY-MM-DD format (ISO 8601)
- Example: `1950-05-15` (5 May 1950)
- Invalid formats: `05/15/1950`, `15-05-1950`, `5/15/50`

**Required References:**
- Tree Name must match existing tree (case-sensitive)
- Member Name must match existing member in that tree (case-sensitive)
- Both are validated before event creation

**Duplicate Handling:**
- Same tree + member + event name + date = duplicate
- Duplicates will update with new data
- Warning displayed if detected in upload

**Repetition Field:**
- Optional (defaults to 'none')
- Values: `none`, `monthly`, `yearly`
- Lowercase preferred (auto-converted)

---

## Upload Workflow

### Step 1: Download Template
- Click corresponding template button (Trees/Members/Events)
- Excel file downloads with instructions sheet

### Step 2: Fill Template
- Add rows with your data
- Follow column descriptions exactly
- Use provided examples as reference

### Step 3: Validate & Upload
- Upload file via drag-drop or file picker
- System validates each row
- Errors shown in red, warnings in yellow
- Preview shows first 5 rows

### Step 4: Commit
- Review validation results
- Click "Create" to save to Firebase
- Progress shown during batch operations

### Step 5: Results
- Success count shown
- Failed items listed with reasons
- IDs provided for created items

---

## Validation Error Reference

### Tree Upload Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Tree Name is required | Empty tree name cell | Enter tree name |
| Tree Name exceeds 255 characters | Name too long | Shorten name |
| Tree already exists | Duplicate found | Use different name |
| Duplicate tree name in upload | Multiple same names | Remove duplicates |

### Member Upload Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Tree Name is required | Empty tree name | Provide tree name |
| Member Name is required | Empty member name | Provide member name |
| Tree "X" does not exist | Tree not found | Check tree name spelling |
| Member already exists | Duplicate in tree | Use different name or nickname |
| Gender must be one of... | Invalid gender | Use: Male, Female, Non-binary, Prefer not to say |
| Invalid Date of Birth | Incomplete or bad date | Provide all three parts (Year, Month, Day) |
| Date of Death required | Status="Passed Away" but no DOD | Provide death date |
| Location exceeds 255 characters | Too long | Shorten location |
| Photo URL invalid | Not valid HTTPS URL | Use complete URL starting with https:// |

### Event Upload Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Tree Name is required | Empty tree name | Provide tree name |
| Member Name is required | Empty member name | Provide member name |
| Event Name is required | Empty event name | Provide event name |
| Event Date is required | Empty or invalid date | Use YYYY-MM-DD format |
| Member "X" not found | Member doesn't exist | Check member name spelling |
| Repetition must be one of... | Invalid repetition value | Use: none, monthly, yearly |
| Date format invalid | Not YYYY-MM-DD | Use format: 1950-05-15 |
| Description exceeds 1000 characters | Too long | Shorten description |

---

## FAQ

**Q: Can I edit templates after download?**
A: Yes, add/remove rows, modify data. Keep column headers unchanged.

**Q: What if member name has special characters?**
A: Supported: é, ñ, ü, etc. Use UTF-8 encoding in Excel.

**Q: Can I upload partial dates?**
A: No, if providing date, all three parts (Year, Month, Day) required.

**Q: What if I make a mistake?**
A: Upload will show errors. Fix data and re-upload. Successful rows are saved.

**Q: Are there limits on batch size?**
A: Yes, max 500 operations per batch. System auto-handles larger uploads.

**Q: Can I update existing data?**
A: Members: No (upload skips existing). Events: Yes (updates if same tree+member+event+date).

**Q: How are member IDs generated?**
A: Auto-generated: `MEM_${timestamp}_${randomId}`. Never provide manually.

**Q: Can I share trees during bulk upload?**
A: No, create/upload first. Use Tree Share feature after creation.

---

## Technical Details

### Field Mapping Source Code
- **Trees**: `TreeSelectionPage.js` tree creation logic
- **Members**: `MemberModal.js` form fields
- **Events**: `AddEventForm.js` event creation form

### Validation Implementation
- `BulkUploadValidation.js` - All validation rules
- `ExcelParser.js` - File parsing (XLSX, CSV)
- `BulkUploadService.js` - Firebase operations

### Database Schema
Members stored with fields:
```javascript
{
  name,           // Required
  nickname,       // Optional
  gender,         // Male/Female/Non-binary/Prefer not to say
  dob,            // YYYY-MM-DD or null
  status,         // alive or deceased
  dod,            // YYYY-MM-DD or null
  location,       // City, Country
  photo,          // HTTPS URL
  notes           // Additional info
}
```

Events stored with fields:
```javascript
{
  title,          // Required (Event Name)
  description,    // Optional
  dateKey,        // YYYY-MM-DD (required)
  repetition,     // none/monthly/yearly
  notes           // Additional info
}
```

---

## Last Updated
**January 19, 2026**

All templates validated and deployed with full field support.
