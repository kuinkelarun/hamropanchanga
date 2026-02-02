# Tree Sharing Feature - Visual Guide

## 🎯 Where to Find the Share Buttons

### Option 1: Tree List Page (Bulk Sharing)

**URL**: `/trees`  
**Button**: "📤 Share Trees" (Purple/Pink)  
**Location**: Top right, next to "Build New Tree" and "File Upload"

```
╔════════════════════════════════════════════════════════════════╗
║                        Your Trees                              ║
║                                                                ║
║  ┏━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━━━┓   ║
║  ┃ + Build    ┃  ┃ 📁 File    ┃  ┃ 📤 Share Trees      ┃   ║
║  ┃   New Tree ┃  ┃   Upload   ┃  ┃                      ┃   ║
║  ┗━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━┛   ║
║     Green           Blue            Purple/Pink ⟵ NEW!       ║
╚════════════════════════════════════════════════════════════════╝
```

**What it does**:
- Opens a modal with multi-select tree list
- Shows ALL your trees (regular users) or ALL trees in system (admins)
- Allows selecting multiple trees with checkboxes
- Share many trees at once with the same person

---

### Option 2: Tree Detail Page (Single Tree Sharing)

**URL**: `/tree/:treeId`  
**Button**: "🔗 Share Tree" (Blue/Indigo)  
**Location**: Header, next to "About Family" button

```
╔════════════════════════════════════════════════════════════════╗
║  Smith Family Tree                                             ║
║                                                                ║
║  ┏━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━┓                    ║
║  ┃ ℹ️ About Family ┃  ┃ 🔗 Share Tree    ┃                    ║
║  ┗━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━┛                    ║
║     Purple/Pink         Blue/Indigo ⟵ NEW!                    ║
║                                                                ║
║  📍 New York  📞 555-1234  📅 Updated 2 days ago              ║
╚════════════════════════════════════════════════════════════════╝
```

**What it does**:
- Opens a modal for the current tree only
- Shows tree name in modal header
- Allows sharing this specific tree
- Also shows existing shares and lets you manage them

---

## 📱 Mobile View

### Tree List Page (Mobile)
```
┌──────────────────────────┐
│     Your Trees           │
│                          │
│  ┌────────────────────┐  │
│  │ + Build New Tree   │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ 📁 File Upload     │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ 📤 Share Trees     │⟵ NEW!
│  └────────────────────┘  │
└──────────────────────────┘
    Stacked vertically
    Full text visible
```

### Tree Detail Page (Mobile)
```
┌────────────────────────────┐
│ Smith Family Tree          │
│                            │
│ [ℹ️]  [🔗] ⟵ NEW!         │
│ About  Share               │
│ Family Tree                │
│                            │
│ Icon only on mobile        │
└────────────────────────────┘
```

---

## 🎬 Quick Action Flows

### Flow 1: Share Multiple Trees
```
Start at /trees page
     ↓
Click "📤 Share Trees" button
     ↓
Modal opens with tree list
     ↓
☑ Check boxes for trees to share
     ↓
Enter recipient email: user@example.com
     ↓
Select permission: ○ View  ● Edit
     ↓
Click "Share 3 Tree(s)" button
     ↓
✅ Success: "3 trees shared!"
     ↓
Done! Recipient can now access trees
```

### Flow 2: Share Single Tree
```
Open /tree/abc123 page
     ↓
Click "🔗 Share Tree" button
     ↓
Modal opens for current tree
     ↓
Enter recipient email: user@example.com
     ↓
Select permission: ● View  ○ Edit
     ↓
Click "Share Tree" button
     ↓
✅ Success: "Tree shared with user@example.com"
     ↓
Done! Recipient can now access tree
```

### Flow 3: Manage Existing Shares
```
Open /tree/abc123 page
     ↓
Click "🔗 Share Tree" button
     ↓
Modal shows "Currently Shared With:"
     ↓
See list of people with access:
  • john@example.com [Edit ▼] [Remove]
  • mary@example.com [View ▼] [Remove]
     ↓
Option A: Change permission
  Click dropdown, select new permission
     ↓
Option B: Remove access
  Click [Remove] button
     ↓
✅ Changes saved automatically
```

---

## 🎨 Button Styles Reference

### Share Trees Button (Tree List)
```css
Background: Purple → Pink gradient
Icon: 📤 (outbox)
Text: "Share Trees"
Size: Medium (py-2.5)
Hover: Darker gradient + slight scale up
Disabled: Grayed out (60% opacity)
```

**When you see it**:
- ✅ When logged in → Full color, clickable
- ⚪ When logged out → Grayed out, cursor-not-allowed

### Share Tree Button (Tree Detail)
```css
Background: Light blue → Light indigo
Icon: 🔗 (SVG share icon)
Text: "Share Tree" (hidden on mobile)
Size: Small (py-1.5)
Shape: Rounded pill
Hover: Brighter background + shadow
```

**Responsive behavior**:
- Desktop: `[🔗 Share Tree]` (icon + text)
- Mobile: `[🔗]` (icon only)

---

## 🔍 Finding the Buttons - Checklist

### On Tree List Page (`/trees`)
- [ ] I can see "Your Trees" section
- [ ] I can see three buttons in the top right
- [ ] The third button says "📤 Share Trees"
- [ ] The button is purple/pink colored
- [ ] When I hover, it gets darker and slightly bigger

### On Tree Detail Page (`/tree/:id`)
- [ ] I can see the tree title at the top
- [ ] I can see two pill-shaped buttons below the title
- [ ] The first button says "ℹ️ About Family"
- [ ] The second button says "🔗 Share Tree"
- [ ] The Share button is blue/indigo colored

### If Buttons Are Missing
❌ **Button not visible** → Check if you're logged in
❌ **Button grayed out** → You need to sign in first
❌ **No Share Tree on detail page** → Check you're on `/tree/:id` URL
❌ **Can't find tree list page** → Navigate to `/trees` route

---

## 📊 Button Comparison

| Feature | Share Trees | Share Tree |
|---------|-------------|------------|
| **Location** | Tree list page (`/trees`) | Tree detail page (`/tree/:id`) |
| **Color** | Purple/Pink | Blue/Indigo |
| **Icon** | 📤 Outbox | 🔗 Link/Share |
| **Purpose** | Share multiple trees | Share current tree |
| **Selection** | Multi-select checkboxes | Single tree only |
| **Modal** | BulkTreeShareModal | TreeShareModal |
| **Search** | Yes, with filter | No |
| **Manage Shares** | No | Yes |

---

## ✨ Visual Indicators

### Button States

**Normal State**:
```
┌─────────────────┐
│ 📤 Share Trees │  ← Gradient background, full color
└─────────────────┘
```

**Hover State**:
```
┌─────────────────┐
│ 📤 Share Trees │  ← Darker, slightly larger, shadow
└─────────────────┘
```

**Disabled State**:
```
┌─────────────────┐
│ 📤 Share Trees │  ← 60% opacity, grayed out
└─────────────────┘
    Cannot click
```

---

## 🎯 Success States

### After Sharing Trees
```
╔════════════════════════════════════════╗
║  ✅ Success                            ║
║  Successfully shared 3 tree(s) with    ║
║  user@example.com                      ║
╚════════════════════════════════════════╝
```

### After Sharing Single Tree
```
╔════════════════════════════════════════╗
║  ✅ Success                            ║
║  Tree shared with user@example.com     ║
╚════════════════════════════════════════╝
```

### After Removing Share
```
╔════════════════════════════════════════╗
║  ✅ Success                            ║
║  Share removed successfully            ║
╚════════════════════════════════════════╝
```

---

## 🚨 Error States

### Invalid Email
```
╔════════════════════════════════════════╗
║  ❌ Error                              ║
║  Please enter a valid email address    ║
╚════════════════════════════════════════╝
```

### No Trees Selected
```
╔════════════════════════════════════════╗
║  ❌ Error                              ║
║  Please select at least one tree       ║
╚════════════════════════════════════════╝
```

### Self-Sharing Attempt
```
╔════════════════════════════════════════╗
║  ❌ Error                              ║
║  You cannot share with yourself        ║
╚════════════════════════════════════════╝
```

---

## 📍 Navigation Map

```
Application Routes
├── /trees (Tree List Page)
│   ├── Header Actions
│   │   ├── [+ Build New Tree]
│   │   ├── [📁 File Upload]
│   │   └── [📤 Share Trees] ⟵ NEW FEATURE
│   └── Tree Cards
│       └── [View] [Edit] [Delete]
│
└── /tree/:treeId (Tree Detail Page)
    ├── Header
    │   ├── Tree Title
    │   ├── [ℹ️ About Family]
    │   └── [🔗 Share Tree] ⟵ NEW FEATURE
    └── Content
        ├── Tree Preview
        ├── Members List
        └── Events List
```

---

## 🎓 Quick Tips

1. **Looking for bulk sharing?**
   → Go to `/trees` and click "📤 Share Trees"

2. **Want to share just one tree?**
   → Open the tree and click "🔗 Share Tree"

3. **Need to change permissions?**
   → Open tree, click "🔗 Share Tree", change dropdown

4. **Want to remove access?**
   → Open tree, click "🔗 Share Tree", click "Remove"

5. **Can't see other people's trees?**
   → Only admins can see and share all trees

---

**Need More Help?**  
See [TREE_SHARING_QUICK_REFERENCE.md](./TREE_SHARING_QUICK_REFERENCE.md) for complete instructions!
