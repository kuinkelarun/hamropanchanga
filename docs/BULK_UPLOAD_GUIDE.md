# Bulk Upload & Tree Sharing Implementation Guide

## 📋 Overview

This document outlines the complete implementation of:
1. **Bulk Upload System** - Upload trees, members, and events in batch
2. **Tree Sharing System** - Share trees with other users with permission levels

## 🎯 Files Created

### Utilities & Services
- `src/utils/BulkUploadTemplates.js` - Excel template generation
- `src/utils/ExcelParser.js` - Parse Excel/CSV files
- `src/utils/BulkUploadValidation.js` - Validate upload data
- `src/utils/TreeSharingUtils.js` - Tree sharing helpers
- `src/services/BulkUploadService.js` - Firebase operations

### Components
- `src/components/BulkUploadModal.js` - Main bulk upload modal with tabs
- `src/components/BulkUploadModal.css` - Modal styles
- `src/components/TreeShareModal.js` - Tree sharing dialog
- `src/components/TreeShareModal.css` - Share modal styles

## 📝 Database Schema Updates

### Trees Collection
```javascript
{
  id: string,
  name: string,
  description: string,
  owner: string (userId),
  ownerEmail: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  memberCount: number,
  eventCount: number,
  isActive: boolean,
  sharedWith: {
    "user@email.com": {
      permission: "view" | "edit",
      sharedAt: Timestamp,
      sharedBy: string (owner email)
    }
  }
}
```

## 🔧 Integration Steps

### Step 1: TreesPage.js Updates
Add this to your TreesPage component:

```javascript
import { useState } from 'react';
import BulkUploadModal from './BulkUploadModal';

function TreesPage() {
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showUploadConfirmation, setShowUploadConfirmation] = useState(false);
  
  const handleOpenBulkUploadConfirmation = () => {
    setShowUploadConfirmation(true);
  };

  const handleConfirmBulkUpload = () => {
    setShowUploadConfirmation(false);
    setShowBulkUploadModal(true);
  };

  const handleBulkUploadComplete = (results, tabType) => {
    // Refresh tree list
    // Show completion message
    setShowBulkUploadModal(false);
  };

  return (
    <>
      <div className="trees-header">
        <button onClick={() => createNewTree()}>🌳 Build New Tree</button>
        <button onClick={handleOpenBulkUploadConfirmation}>📁 Build Tree From File Upload</button>
      </div>

      {/* Bulk Upload Confirmation Dialog */}
      {showUploadConfirmation && (
        <div className="confirmation-modal">
          <div className="confirmation-content">
            <h3>Ready for Bulk Upload?</h3>
            <p>Bulk upload is ideal if you have 5 or more trees to build.</p>
            <p>Do you have the file ready?</p>
            <div className="confirmation-actions">
              <button onClick={() => setShowUploadConfirmation(false)}>Cancel</button>
              <button onClick={handleConfirmBulkUpload} className="primary">Proceed to Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        onComplete={handleBulkUploadComplete}
        userId={userId}
        userEmail={userEmail}
      />

      {/* Rest of trees list */}
      {/* Add shared indicator for each tree */}
    </>
  );
}
```

### Step 2: TreeDetailPage.js Updates
Add tree sharing button:

```javascript
import TreeShareModal from './TreeShareModal';

function TreeDetailPage({ treeId, userId, userEmail }) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [tree, setTree] = useState(null);

  const handleShareComplete = () => {
    // Refresh tree data
  };

  return (
    <>
      <div className="tree-detail-header">
        <h1>{tree?.name}</h1>
        {tree?.owner === userId && (
          <button onClick={() => setShowShareModal(true)}>📤 Share Tree</button>
        )}
      </div>

      <TreeShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tree={tree}
        onComplete={handleShareComplete}
        userId={userId}
        userEmail={userEmail}
      />

      {/* Add shared indicator if viewing shared tree */}
      {tree?.owner !== userId && tree?.sharedWith?.[userEmail] && (
        <div className="shared-indicator">
          📤 Shared by {tree.ownerEmail} 
          ({tree.sharedWith[userEmail].permission === 'view' ? '👁️ View' : '✏️ Edit'})
        </div>
      )}
    </>
  );
}
```

### Step 3: Tree List Display
Add shared indicator to tree cards:

```javascript
import { getTreeAccessType, getSharedBadgeText } from '../utils/TreeSharingUtils';

function TreeCard({ tree, userId, userEmail }) {
  const access = getTreeAccessType(tree.owner, userId, userEmail, tree.sharedWith);

  return (
    <div className="tree-card">
      <h3>{tree.name}</h3>
      {access.type === 'shared' && (
        <div className="shared-badge">
          {getSharedBadgeText(tree.sharedBy)}
        </div>
      )}
      {/* rest of card */}
    </div>
  );
}
```

## 📊 Template Specifications

### Trees Template
**Required Fields:**
- Tree Name

**Optional Fields:**
- Description
- Notes

**Example:**
```
Tree Name | Description | Notes
Smith Dynasty | Main branch of the Smith family | Founded 1950
```

### Family Members Template
**Required Fields:**
- Tree Name
- Member Name

**Optional Fields:**
- Tree ID (auto-filled, leave empty)
- Gender (M/F/O)
- Date of Birth (YYYY-MM-DD)
- Relationship
- Phone
- Email
- Notes

**Example:**
```
Tree ID | Tree Name | Member Name | Gender | DOB | Relationship | Phone | Email | Notes
        | Smith Dynasty | John Smith | M | 1980-05-15 | Head | +1-555-0101 | john@email.com | Patriarch
```

### Events Template
**Required Fields:**
- Tree Name
- Member Name
- Event Type
- Event Date (YYYY-MM-DD)

**Optional Fields:**
- Tree ID (auto-filled)
- Tithi Date (YYYY-MM-DD)
- Event Details
- Notes

**Example:**
```
Tree ID | Tree Name | Member Name | Event Type | Event Date | Tithi Date | Event Details | Notes
        | Smith Dynasty | John Smith | Birth | 1980-05-15 | 1980-05-15 | Born in NY | New York
```

## 🔐 Permission System

### View Permission
- Can view tree structure
- Can view tree builder
- Can view all events
- **Cannot:** Edit, add, or delete anything

### Edit Permission
- Can view everything (view permission)
- Can edit members
- Can edit events
- Can add new members
- Can add new events
- **Cannot:** Delete tree, manage sharing, delete members

## 🚀 Features & Validation

### Bulk Upload Features
✅ Drag-drop file upload
✅ File type validation (.xlsx, .xls, .csv)
✅ Row-by-row validation
✅ Duplicate detection
✅ Data preview before commit
✅ Batch processing
✅ Result summary with success/failure counts

### Validation Rules

**Trees:**
- Tree Name: Required, max 255 chars, unique
- Description: Optional, max 500 chars
- Notes: Optional, max 500 chars

**Members:**
- Tree Name: Required, must exist
- Member Name: Required, max 255 chars
- Gender: Optional, must be M/F/O
- DOB: Optional, format YYYY-MM-DD
- Phone: Optional, 7-15 digits
- Email: Optional, valid format
- Duplicates: Skip with warning

**Events:**
- Tree Name: Required, must exist
- Member Name: Required, must exist in tree
- Event Type: Required
- Event Date: Required, format YYYY-MM-DD
- Tithi Date: Optional
- Duplicates: Update with new data

## 📱 Mobile Responsiveness

All components are fully responsive:
- **Desktop (>768px):** Full-size modals, multi-column layouts
- **Tablet (480-768px):** Compact modals with vertical scrolling
- **Mobile (<480px):** Full-screen optimized, touch-friendly controls

## 🔄 Data Flow

### Bulk Upload Flow
1. User clicks "Build Tree From File Upload"
2. Confirmation dialog appears
3. User proceeds → Modal opens
4. User selects file → Automatic parsing
5. System validates data
6. User reviews preview
7. User clicks "Commit Upload"
8. Batch processing occurs
9. Results summary displayed

### Tree Sharing Flow
1. Tree owner clicks "Share Tree"
2. Share modal opens
3. Owner enters recipient email
4. Owner selects permission level
5. Click "Share Tree"
6. Recipients can see tree in their tree list
7. Owner can update/remove permissions anytime

## ⚙️ API Reference

### BulkUploadService Functions

```javascript
// Create trees
createTreesFromBulkUpload(treeData, userId, userEmail)
→ {success: [], failed: [], stats: {created, skipped, errors}}

// Add members
addFamilyMembersFromBulkUpload(memberData, userId, treeMap)
→ {success: [], failed: [], stats: {created, skipped, errors}}

// Add events
addEventsFromBulkUpload(eventData, userId, treeMap, memberMap)
→ {success: [], failed: [], stats: {created, updated, errors}}

// Share tree
shareTreeWithUser(treeId, recipientEmail, permission, ownerEmail)
→ Promise<boolean>

// Update permission
updateSharePermission(treeId, recipientEmail, newPermission)
→ Promise<boolean>

// Remove share
removeTreeShare(treeId, recipientEmail)
→ Promise<boolean>

// Get shared trees
getSharedTreesForUser(userEmail)
→ Promise<Array<tree>>
```

## 🧪 Testing Checklist

- [ ] Download each template
- [ ] Verify template columns and sample data
- [ ] Upload valid tree data
- [ ] Upload with duplicate trees
- [ ] Upload members to non-existent tree
- [ ] Upload events for non-existent member
- [ ] Share tree with valid email
- [ ] Share tree with own email (should error)
- [ ] Update sharing permission
- [ ] Remove shared tree access
- [ ] Verify shared tree appears in recipient's list
- [ ] Test mobile responsiveness
- [ ] Verify validation error messages
- [ ] Test large file uploads (500+ rows)

## 🐛 Troubleshooting

### File Upload Issues
- Ensure file is .xlsx, .xls, or .csv format
- Check file encoding (UTF-8 recommended)
- Ensure no hidden rows in Excel

### Validation Failures
- Check date formats (YYYY-MM-DD)
- Verify email formats
- Ensure tree/member names match exactly (case-sensitive)
- Check for leading/trailing spaces

### Sharing Issues
- Recipients must have registered accounts
- Recipients need to use registered email
- Owner cannot share with themselves
- Cannot share tree that doesn't exist

## 📚 Dependencies

Ensure these packages are installed:
```bash
npm install xlsx
```

## 🔄 Future Enhancements

- [ ] Bulk import from CSV with delimiter options
- [ ] ZIP file download for all templates
- [ ] Scheduled bulk uploads
- [ ] Bulk operations history
- [ ] Role-based sharing (admin, editor, viewer roles)
- [ ] Family relationship validation
- [ ] Duplicate member detection with merge options
- [ ] Excel export with current tree data

## 📞 Support

For issues or questions:
1. Check validation messages in the modal
2. Review the troubleshooting section
3. Check browser console for error details
4. Verify data format matches templates

---

**Last Updated:** January 2026
**Status:** Ready for Integration
