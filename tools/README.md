# Database Tools

This directory contains tools for validating and maintaining the bulk upload system's data integrity.

## Prerequisites

1. **Firebase Service Account Key**:
   - Place your `firebase-service-account.json` file in the project root
   - Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

2. **Install Dependencies**:
   ```bash
   npm install firebase-admin
   ```

## Tools

### 1. Data Validation Tool

**Purpose**: Validates database integrity without making any changes.

**Usage**:
```bash
node tools/validate-bulk-upload-data.js
```

**Checks**:
- ✅ Duplicate tree names (normalized)
- ✅ Missing normalized fields
- ✅ Normalization consistency
- ✅ Referential integrity (orphaned events/members)
- ✅ Missing references

**Example Output**:
```
🔍 BULK UPLOAD DATA VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Checking for duplicate tree names...
   ✅ No duplicate tree names found

📊 Checking for missing normalized fields...
   ⚠️  Found 15 trees without nameNormalized field
       Run the migration script to fix this.

📋 VALIDATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duplicate tree names:        0
Missing normalized fields:   15
Normalization inconsistent:  0
Orphaned events:             0
Missing references:          0

⚠️  Found 15 issues that need attention
```

### 2. Database Migration Tool

**Purpose**: Fixes database records to ensure all normalized fields are present and correct.

**Usage**:

**Dry run** (see what would change):
```bash
node tools/migrate-normalize-fields.js --dry-run
```

**Actual migration**:
```bash
node tools/migrate-normalize-fields.js
```

**Limited migration** (for testing):
```bash
node tools/migrate-normalize-fields.js --dry-run --limit=10
```

**What it does**:
- Adds missing `nameNormalized` fields to trees
- Adds missing `nameNormalized` fields to members
- Updates incorrectly normalized fields
- Ensures consistency with current normalization algorithm

**Example Output**:
```
🔧 DATABASE NORMALIZATION MIGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Migrating tree normalization fields...
   Processing 150 trees...
   ✏️  tree123:
       Name: "राम  परिवार"
       Old normalized: "राम  परिवार"
       New normalized: "राम परिवार"
   
   💾 Committing 15 updates...
   ✅ Successfully updated 15 trees

📋 MIGRATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trees updated:    15
Members updated:  42
Total errors:     0

✅ Migration completed successfully!
```

## Recommended Workflow

### First-Time Setup

1. **Run validation**:
   ```bash
   node tools/validate-bulk-upload-data.js
   ```

2. **If issues found, run migration in dry-run mode**:
   ```bash
   node tools/migrate-normalize-fields.js --dry-run
   ```

3. **Review the changes, then run actual migration**:
   ```bash
   node tools/migrate-normalize-fields.js
   ```

4. **Validate again to confirm fixes**:
   ```bash
   node tools/validate-bulk-upload-data.js
   ```

### Regular Maintenance

Run validation monthly or after bulk uploads:
```bash
node tools/validate-bulk-upload-data.js
```

## Troubleshooting

### "Cannot find module 'firebase-admin'"
```bash
npm install firebase-admin
```

### "Error: Could not load the default credentials"
Make sure `firebase-service-account.json` is in the project root and is valid.

### "PERMISSION_DENIED: Missing or insufficient permissions"
Ensure your Firebase service account has:
- Cloud Firestore: Read/Write access
- Firebase Admin SDK privileges

### Large Database Performance

For databases with 10,000+ records:
- Use `--limit` flag to test first
- Run during off-peak hours
- Monitor Firebase quotas (read/write operations)

## Integration with CI/CD

Add validation to your CI pipeline:

```yaml
# .github/workflows/validate.yml
name: Validate Database
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sundays
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install firebase-admin
      - run: node tools/validate-bulk-upload-data.js
```

## Safety Features

### Validation Tool
- ✅ Read-only operations
- ✅ No changes to database
- ✅ Can run on production safely

### Migration Tool
- ✅ Dry-run mode available
- ✅ Batch operations with error handling
- ✅ Detailed logging of all changes
- ✅ Atomic updates (all-or-nothing per batch)

## Related Documentation

- [Bulk Upload Diagnosis](../BULK_UPLOAD_DIAGNOSIS_AND_FIX.md) - Complete analysis
- [Priority 1 Fixes](../PRIORITY_1_FIXES_COMPLETE.md) - Implementation details
- [Text Normalization](../src/utils/textNormalize.js) - Normalization algorithm

## Support

For issues or questions:
1. Check tool output for specific error messages
2. Review Firebase console for quota/permission issues
3. Refer to comprehensive diagnosis document
4. Check logs for detailed error information
