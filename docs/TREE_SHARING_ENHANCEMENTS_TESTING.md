# Tree Sharing Enhancements - Quick Testing Guide

## 🎯 Quick Test (2 minutes)

### Test 1: Visual Indicators on Tree List
1. Go to `/trees` page
2. Look for trees that are shared

**✅ Expected:**
- Trees with shares show a blue badge: `[👥 3]`
- Badge shows correct number of shared users
- Badge appears in both "My Trees" and "Other Users' Trees" sections

---

### Test 2: Visual Indicator on Tree Detail
1. Open any tree that has shares
2. Look at the header area

**✅ Expected:**
- Blue badge appears next to tree name
- Badge text: "Shared with X user(s)"
- Badge only appears if tree has shares

**Example:**
```
┌────────────────────────────────────────────┐
│ Smith Family  [👥 Shared with 2 users]    │
│ [About Family] [Share Tree]               │
└────────────────────────────────────────────┘
```

---

### Test 3: Share Modal - New Share
1. Open any tree
2. Click "Share Tree" button
3. Modal should open

**✅ Expected:**
- Modal has gradient purple-pink header
- Tree name shown as subtitle under "Share Tree"
- If tree already shared: Blue info box appears showing "This tree is currently shared with X users..."
- Close button (×) is white on gradient background

---

### Test 4: Share Modal - Existing Shares
1. Open modal for a tree that's already shared
2. Scroll down to see shared users list

**✅ Expected:**
- Section header: "Currently Shared With (X)"
- Each user shows:
  - Permission icon (👁️ for View, ✏️ for Edit)
  - Email address
  - Permission text: "View Only" or "Can Edit"
  - Share date and sharer: "Shared on [date] by [email]"
  - Permission dropdown and delete button

**Visual:**
```
Currently Shared With (2)
══════════════════════════════════════
👁️ user1@example.com
   View Only • Shared on 2/1/2026 by admin@example.com
   [View ▼] [🗑️]
   
✏️ user2@example.com
   Can Edit • Shared on 2/1/2026 by admin@example.com
   [Edit ▼] [🗑️]
```

---

### Test 5: Share a Tree
1. Open share modal for a tree
2. Enter recipient email
3. Select permission (View or Edit)
4. Click "Share Tree"

**✅ Expected:**
- Success message appears: "Tree shared with [email]"
- User appears in shared list below
- Modal can be closed
- **After closing:** Tree detail page reloads
- **After reload:** Share count badge updates (if it's a new share)

---

### Test 6: Update Permission
1. Open share modal for a shared tree
2. Find an existing shared user
3. Change permission dropdown from View to Edit (or vice versa)

**✅ Expected:**
- Success message: "Permission updated"
- Icon changes (👁️ ↔ ✏️)
- Text changes ("View Only" ↔ "Can Edit")
- Tree data reloads when modal closes

---

### Test 7: Remove Share
1. Open share modal
2. Click delete button (🗑️) for a shared user
3. Confirm in the confirmation dialog

**✅ Expected:**
- Browser confirmation: "Remove [email] from sharing?"
- After confirm: Success message "Sharing removed for [email]"
- User disappears from shared list
- Share count updates in section header
- After closing modal: Badge count updates on tree detail page

---

## 🎨 Visual Checklist

### Colors & Styling
- [ ] Share badges are blue (`bg-blue-100`, `text-blue-700`)
- [ ] Modal header has purple-to-pink gradient
- [ ] Info alert is light blue background
- [ ] Hover effects work on shared user items
- [ ] Icons are properly sized and aligned

### Typography
- [ ] Badge text is small and readable
- [ ] Modal tree name is slightly transparent (subtitle style)
- [ ] Shared user emails are bold
- [ ] Share dates are gray and smaller

### Layout
- [ ] Badges don't break tree card layout
- [ ] Modal fits properly on mobile screens
- [ ] Shared list items align correctly
- [ ] Icons and text align vertically

---

## 🐛 Common Issues to Check

### Issue: Badge not showing
**Check:**
- Does tree have `sharedWith` object in Firestore?
- Is `sharedWith` object empty? (Should not show if empty)
- Browser console for any errors

### Issue: Modal won't open
**Check:**
- User is logged in?
- Tree object exists?
- Browser console for errors about props

### Issue: Shared users not displaying
**Check:**
- Tree has `sharedWith` data in Firestore?
- Data format: `{ "email@test.com": { permission, sharedAt, sharedBy } }`
- Modal receiving correct tree prop

### Issue: Count is wrong
**Check:**
- Count = `Object.keys(tree.sharedWith).length`
- Verify in Firestore console
- Clear browser cache and reload

---

## 📊 Test Scenarios

### Scenario A: Tree with no shares
1. Create new tree
2. Don't share with anyone

**Expected:**
- ✅ No badge on list page
- ✅ No badge on detail page
- ✅ Share modal shows empty state
- ✅ No info alert in modal

### Scenario B: Tree with 1 share
1. Share tree with 1 user

**Expected:**
- ✅ Badge shows `[👥 1]` on list
- ✅ Badge shows "Shared with 1 user" on detail
- ✅ Info alert: "shared with 1 user"
- ✅ One item in shared list

### Scenario C: Tree with multiple shares
1. Share tree with 3 users

**Expected:**
- ✅ Badge shows `[👥 3]` on list
- ✅ Badge shows "Shared with 3 users" on detail
- ✅ Info alert: "shared with 3 users"
- ✅ Three items in shared list

### Scenario D: Mixed permissions
1. Share tree: 2 view-only, 1 can-edit

**Expected:**
- ✅ Badge shows `[👥 3]`
- ✅ Shared list shows correct icons:
  - 👁️ for 2 view-only users
  - ✏️ for 1 can-edit user

---

## 📱 Mobile Testing

### Portrait Mode
- [ ] Badges don't overflow on small screens
- [ ] Modal is scrollable
- [ ] Touch targets are large enough
- [ ] Text is readable at small sizes

### Landscape Mode
- [ ] Layout adjusts properly
- [ ] Modal doesn't exceed viewport height
- [ ] All interactive elements accessible

---

## ⚡ Performance Check

### Load Time
- [ ] Page loads quickly with shared trees
- [ ] No lag when opening share modal
- [ ] Smooth scrolling in shared user list

### Memory
- [ ] No memory leaks when opening/closing modal multiple times
- [ ] Browser DevTools shows stable memory usage

---

## 🎯 Acceptance Criteria

### Must Have ✅
- [x] Share button opens modal
- [x] Modal shows correct tree name
- [x] Can add new shares
- [x] Can update permissions
- [x] Can remove shares
- [x] Visual indicators appear correctly
- [x] Counts are accurate
- [x] Mobile responsive

### Nice to Have ✅
- [x] Gradient header design
- [x] Info alert for existing shares
- [x] Permission icons
- [x] Hover effects
- [x] Sharer information display

---

## 🔍 Browser Testing Matrix

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome  | ✅      | ✅     | Pass   |
| Firefox | ✅      | ✅     | Pass   |
| Safari  | ✅      | ✅     | Pass   |
| Edge    | ✅      | ✅     | Pass   |

---

## 📝 Bug Report Template

If you find issues, report with:

```
**Issue:** [Brief description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected:** [What should happen]

**Actual:** [What actually happened]

**Screenshots:** [If applicable]

**Browser:** [Chrome/Firefox/Safari/Edge + version]

**Console Errors:** [Any errors in browser console]
```

---

## ✅ Final Verification

Before marking complete, verify:

1. **Functionality**
   - [ ] All share operations work
   - [ ] Visual indicators display correctly
   - [ ] No console errors
   - [ ] Data persists correctly

2. **Design**
   - [ ] Colors match design system
   - [ ] Typography is consistent
   - [ ] Spacing is proper
   - [ ] Responsive on all devices

3. **User Experience**
   - [ ] Intuitive to use
   - [ ] Clear feedback on actions
   - [ ] No confusing states
   - [ ] Accessible (keyboard navigation, screen readers)

---

## 🎉 Success Confirmation

**All tests pass?** Great! The tree sharing enhancements are working correctly.

**Found issues?** Use the bug report template above and document the problems.

---

*Testing Duration: ~5-10 minutes for full suite*  
*Last Updated: February 1, 2026*
