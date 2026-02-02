# Tree Sharing Feature - Quick Reference

## 📍 Where to Find Sharing Features

### 1. Tree List Page (`/trees`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Trees                               │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐       │
│  │   + Build   │  │ 📁 File     │  │ 📤 Share Trees   │       │
│  │   New Tree  │  │   Upload    │  │                  │       │
│  └─────────────┘  └─────────────┘  └──────────────────┘       │
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┐                  │
│  │ Tree 1      │ Tree 2      │ Tree 3      │                  │
│  │ Location    │ Location    │ Location    │                  │
│  │ Contact     │ Contact     │ Contact     │                  │
│  │ [View] [Edit] [Delete]  │ ...          │                  │
│  └─────────────┴─────────────┴─────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Click "Share Trees"
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              📤 Share Multiple Trees Modal                      │
│                                                                 │
│  Recipient Email: [user@example.com____________]               │
│                                                                 │
│  Permission: ○ View Only  ● Can Edit                           │
│                                                                 │
│  Select Trees to Share: (2 selected)                           │
│  [Search trees..._______________] [Select All]                 │
│                                                                 │
│  ┌──────────────────────────────────────────┐                 │
│  │ ☑ Smith Family Tree                      │                 │
│  │   👤 John Smith  📍 New York  👥 15      │                 │
│  │                                           │                 │
│  │ ☑ Johnson Family Tree                    │                 │
│  │   👤 Mary Johnson  📍 Boston  👥 22      │                 │
│  │                                           │                 │
│  │ ☐ Davis Family Tree                      │                 │
│  │   👤 Bob Davis  📍 Chicago  👥 10        │                 │
│  └──────────────────────────────────────────┘                 │
│                                                                 │
│  [Cancel]                          [Share 2 Tree(s)]           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Tree Detail Page (`/tree/:treeId`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Smith Family Tree                                              │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐                       │
│  │ ℹ️ About Family│  │ 🔗 Share Tree  │                       │
│  └────────────────┘  └────────────────┘                       │
│                                                                 │
│  📍 New York  📞 555-1234  📅 Updated 2 days ago              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tree Preview]          [Family Members]                      │
│                                                                 │
│                          [Events & Calendar]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Click "Share Tree"
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              🔗 Share Tree: Smith Family Tree                   │
│                                                                 │
│  Recipient Email: [user@example.com____________]               │
│                                                                 │
│  Permission: ● View Only  ○ Can Edit                           │
│                                                                 │
│  Currently Shared With:                                        │
│  ┌──────────────────────────────────────────┐                 │
│  │ john@example.com                         │                 │
│  │ Permission: [Edit ▼]  [Remove]          │                 │
│  │                                           │                 │
│  │ mary@example.com                         │                 │
│  │ Permission: [View ▼]  [Remove]          │                 │
│  └──────────────────────────────────────────┘                 │
│                                                                 │
│  [Cancel]                              [Share Tree]            │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Permission Levels

### View Only (👁️)
- ✅ View tree structure
- ✅ View member details
- ✅ View relationships
- ✅ View events
- ❌ Cannot edit anything
- ❌ Cannot delete tree
- ❌ Cannot share tree

### Can Edit (✏️)
- ✅ View tree structure
- ✅ View member details
- ✅ View relationships
- ✅ View events
- ✅ Add/edit/delete members
- ✅ Add/edit/delete relationships
- ✅ Add/edit/delete events
- ❌ Cannot delete tree
- ❌ Cannot change ownership
- ❌ Cannot modify sharing settings

## 👥 User Roles

### Regular User
**Tree List Page**:
- Sees only own trees
- Can share own trees with others
- Cannot see or share other users' trees

**Tree Detail Page**:
- Can share if they own the tree
- Cannot share if viewing someone else's shared tree

### Admin User
**Tree List Page**:
- Sees ALL trees (including other users')
- Can share any tree with anyone
- Special button tooltip: "Share any trees with other users"

**Tree Detail Page**:
- Can share any tree
- Can share even if not the owner

## 🎯 Quick Actions

### Share Multiple Trees
1. Go to `/trees` page
2. Click "📤 Share Trees" button
3. Select trees using checkboxes
4. Enter recipient email
5. Choose permission level
6. Click "Share X Tree(s)"

### Share Single Tree
1. Open tree detail page (`/tree/:treeId`)
2. Click "🔗 Share Tree" button in header
3. Enter recipient email
4. Choose permission level
5. Click "Share Tree"

### Manage Existing Shares
1. Open tree detail page
2. Click "🔗 Share Tree" button
3. View "Currently Shared With" list
4. Change permission or remove access

## ⚡ Keyboard Shortcuts

- `Tab`: Navigate between fields
- `Enter`: Submit share form
- `Escape`: Close modal
- `Space`: Toggle checkbox (in tree list)

## 🎨 Visual Indicators

### Button Colors
- **Build New Tree**: Green (🟢)
- **File Upload**: Blue (🔵)
- **Share Trees**: Purple/Pink (🟣🩷)
- **Share Tree**: Blue/Indigo (🔵)

### Status Messages
- **Success**: Green background, ✅ icon
- **Error**: Red background, ❌ icon
- **Warning**: Yellow background, ⚠️ icon

## 📱 Mobile Experience

### Tree List Page
- Buttons may wrap to multiple rows
- "Share Trees" shows full text
- Modal takes full screen width

### Tree Detail Page
- Share button shows icon only (🔗)
- Text hidden on mobile
- Modal optimized for touch

## 🔒 Security

### Client-Side
- Buttons disabled when not logged in
- Email validation before submission
- Self-sharing prevented
- Role-based tree filtering

### Server-Side
- Firestore rules enforce permissions
- Admin privilege verified
- Owner verification for regular users
- Only `sharedWith` field can be updated

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Button grayed out | Make sure you're logged in |
| No trees in modal | Regular users only see own trees |
| Share failed | Check email format, verify Firestore rules |
| Tree not shared | Check recipient's email matches exactly (case-sensitive) |
| Cannot edit shared tree | Owner set "View Only" permission |

## 📖 Related Documentation

- [Bulk Tree Sharing Guide](./BULK_TREE_SHARING_GUIDE.md) - Complete feature documentation
- [Tree Sharing Integration](./TREE_SHARING_INTEGRATION.md) - Technical integration guide
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Development summary
- [Validation Report](./TREE_DELETION_AND_SHARING_VALIDATION.md) - Testing and validation

## 🚀 Getting Started

### For End Users
1. **Want to share multiple trees?**
   - Go to "Your Trees" page
   - Click "📤 Share Trees"
   - Select trees and share!

2. **Want to share one tree?**
   - Open the tree detail page
   - Click "🔗 Share Tree"
   - Enter email and share!

3. **Want to manage who has access?**
   - Open tree detail page
   - Click "🔗 Share Tree"
   - See "Currently Shared With" list
   - Change or remove access

### For Developers
1. **Import the components**:
   ```javascript
   import BulkTreeShareModal from '../BulkTreeShareModal';
   import TreeShareModal from '../TreeShareModal';
   ```

2. **Add state**:
   ```javascript
   const [showShareModal, setShowShareModal] = useState(false);
   ```

3. **Add button**:
   ```javascript
   <button onClick={() => setShowShareModal(true)}>
     Share
   </button>
   ```

4. **Add modal**:
   ```javascript
   {showShareModal && (
     <BulkTreeShareModal
       isOpen={showShareModal}
       onClose={() => setShowShareModal(false)}
       userEmail={user.email}
       userId={user.uid}
       isAdmin={isAdmin}
     />
   )}
   ```

---

**Need Help?** Check the [troubleshooting section](./TREE_SHARING_INTEGRATION.md#troubleshooting) or contact support.
