# Admin Bulk Upload - Quick Reference

## 🚀 Quick Start

### Access the Feature
Settings → Bulk Upload Management (Admin Only)

### Upload Tithis (3 Steps)
1. **Download Template** → `Tithis_Template.xlsx`
2. **Fill Excel** → See template examples
3. **Upload & Publish** → Drag-drop → Validate → Publish

### Upload Events (3 Steps)
1. **Download Template** → `Events_Template.xlsx`
2. **Fill Excel** → See template examples
3. **Upload & Publish** → Drag-drop → Validate → Publish

---

## 📋 Template Fields

### Tithis Template
| Field | Required | Format | Example |
|-------|----------|--------|---------|
| Name* | ✅ | Text | शुक्लपक्ष एकादशी |
| Pakshya* | ✅ | शुक्लपक्ष or कृष्णपक्ष | शुक्लपक्ष |
| Start Date* | ✅ | YYYY-MM-DD | 2025-11-15 |
| Start Time* | ✅ | HH:MM | 06:00 |
| End Date* | ✅ | YYYY-MM-DD | 2025-11-16 |
| End Time* | ✅ | HH:MM | 18:00 |
| Category | ❌ | Text | Festival |

### Events Template
| Field | Required | Format | Example |
|-------|----------|--------|---------|
| Title* | ✅ | Text | Family Gathering |
| Description | ❌ | Text | Annual reunion |
| Date* | ✅ | YYYY-MM-DD | 2025-12-25 |
| Is Public* | ✅ | TRUE/FALSE | TRUE |
| Associated Person | ❌ | Text | John Doe |

---

## ✅ Validation Rules

### Dates
- ✅ Format: YYYY-MM-DD (e.g., 2025-11-15)
- ✅ End Date must be ≥ Start Date
- ❌ Don't use: 11/15/2025 or 15-11-2025

### Times
- ✅ Format: HH:MM (24-hour, e.g., 14:30)
- ❌ Don't use: 2:30 PM or 14:30:00

### Pakshya (Tithis Only)
- ✅ शुक्लपक्ष (Shukla Paksha)
- ✅ कृष्णपक्ष (Krishna Paksha)
- ❌ Any other value

### Is Public (Events Only)
- ✅ TRUE (public event)
- ✅ FALSE (private event)
- ❌ Don't use: Yes/No, 1/0, true/false

---

## 🔄 Update vs Add

### Tithis
- **Match by**: Name field
- **Update**: If name already exists in database
- **Add**: If name is new

### Events
- **Match by**: Title + Date combination
- **Update**: If same title on same date exists
- **Add**: If combination is new

---

## ⚠️ Common Errors

| Error | Fix |
|-------|-----|
| "Name is required" | Fill the Name* column |
| "Start Date must be in YYYY-MM-DD format" | Use 2025-11-15, not 11/15/2025 |
| "Pakshya must be either शुक्लपक्ष or कृष्णपक्ष" | Copy exact text from template |
| "End Date cannot be before Start Date" | Check date logic |
| "Is Public must be TRUE or FALSE" | Use uppercase TRUE or FALSE |
| "Start Time must be in HH:MM format" | Use 06:00, not 6:00 AM |

---

## 🎯 Best Practices

### Excel Editing
1. ✅ Use template as starting point
2. ✅ Keep example rows for reference
3. ✅ Delete examples before uploading
4. ✅ Use Excel's date picker for dates
5. ✅ Copy-paste Pakshya values from examples

### Data Entry
1. ✅ Start with small batches (10-20 records)
2. ✅ Test upload before doing bulk entry
3. ✅ Export existing data first for backup
4. ✅ Use consistent naming conventions
5. ✅ Validate in Excel before uploading

### Error Handling
1. ✅ Read error messages carefully (shows row number)
2. ✅ Fix all errors before publishing
3. ✅ Export existing data to compare formats
4. ✅ Keep a backup copy of your Excel file

---

## 📊 Understanding Results

### Validation Summary
```
✅ Validation Complete:
• 25 valid records
• 20 new records to add
• 5 existing records to update
• 3 invalid records (see errors below)
```

**What it means:**
- **25 valid records**: Passed all validation checks
- **20 new**: Will be created in database
- **5 update**: Will overwrite existing records
- **3 invalid**: Fix errors before publishing

### Preview Table
Shows first 10 records that will be uploaded:
- **Status: ✨ New** → Will create new record
- **Status: 🔄 Update** → Will overwrite existing

---

## 🛠️ Troubleshooting

### File Won't Upload
- Check file extension (.xlsx or .xls)
- Ensure file isn't open in Excel
- Try drag-drop instead of browse

### All Records Show as Invalid
- Check column headers match template exactly
- Ensure no extra spaces in headers
- Re-download template and copy data

### Can't See Bulk Upload Management
- Verify you're logged in as admin
- Check Settings menu for option
- Contact admin to verify permissions

### Data Doesn't Appear in Calendar
- Check if dates are in visible calendar range
- For Tithis: Verify dates are in correct format
- Reload calendar page

### "Permission Denied" Error
- Ensure admin privileges in Firestore
- Check adminList collection has your UID
- Try signing out and back in

---

## 💡 Pro Tips

1. **Use Excel Formulas**: Generate date sequences automatically
2. **Copy Existing Data**: Export → Edit → Re-import
3. **Batch Processing**: Upload in groups of 50 for safety
4. **Save Frequently**: Keep Excel file as backup
5. **Test First**: Try with 2-3 records before bulk upload
6. **Search Feature**: Use search in Manual Management to verify uploads

---

## 🔗 Related Features

- **Manual Management**: View/search/delete individual records
- **Export Data**: Download existing data for editing
- **Calendar Display**: Uploaded data appears on Nepali Calendar
- **Edit Mode**: Toggle in Settings to edit calendar items

---

## 📞 Need Help?

1. Review error messages (they show exact row and issue)
2. Compare your Excel with downloaded template
3. Test with template examples first
4. Check date/time formats carefully
5. Verify Pakshya text is exactly शुक्लपक्ष or कृष्णपक्ष

---

**Remember**: Download template → Fill data → Validate → Fix errors → Publish ✅
