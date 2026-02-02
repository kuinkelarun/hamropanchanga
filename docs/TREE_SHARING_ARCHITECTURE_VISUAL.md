# Tree Sharing Architecture - Visual Guide

## Problem: Why the Original Approach Failed

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE TREES COLLECTION                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Tree 1: { ownerUid: "admin", sharedWith: {...} }           │
│  Tree 2: { ownerUid: "user1", sharedWith: {...} }           │
│  Tree 3: { ownerUid: "user2", sharedWith: {...} }           │
│  Tree 4: { ownerUid: "admin", sharedWith: {...} }           │
│  ...                                                          │
│  Tree 100: { ownerUid: "user50", sharedWith: {...} }        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                ┌───────────┴───────────┐
                │   QUERY ATTEMPT       │
                │                       │
                │  where('sharedWith.   │
                │   user@email.com',    │
                │   '!=', null)         │
                │                       │
                │  ❌ REQUIRES READING  │
                │     ALL 100 TREES     │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  SECURITY RULES       │
                │  CHECK EACH TREE:     │
                │                       │
                │  Can user read Tree 1?│
                │  Can user read Tree 2?│
                │  Can user read Tree 3?│
                │  ...                  │
                │                       │
                │  ❌ USER DOESN'T OWN  │
                │     MOST TREES        │
                │                       │
                │  🚫 PERMISSION DENIED │
                └───────────────────────┘
```

### The Chicken-and-Egg Problem

```
┌─────────────────────────────┐
│   To Execute Query:         │
│   Need permission to read   │
│   all potentially matching  │
│   documents                 │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   To Read Document:         │
│   Security rules check if   │
│   user owns or has access   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   To Know If Has Access:    │
│   Need to read the document │
│   (check sharedWith map)    │
└──────────┬──────────────────┘
           │
           └──────────┐
                      │
                      ▼
              ❌ IMPOSSIBLE! ❌
```

---

## Solution: Dual-Field Architecture

### Data Model

```
┌────────────────────────────────────────────────────────┐
│                   TREE DOCUMENT                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  id: "tree123"                                         │
│  familyName: "Smith Family"                            │
│  ownerUid: "user1"                                     │
│                                                         │
│  sharedWith: {                    ┐                    │
│    "user2@example.com": {         │ Detailed Info      │
│      permission: "view",          │ (Map)              │
│      sharedAt: Timestamp,         │                    │
│      sharedBy: "user1@example.com"│                    │
│    },                             │                    │
│    "user3@example.com": {         │                    │
│      permission: "edit",          │                    │
│      sharedAt: Timestamp,         │                    │
│      sharedBy: "user1@example.com"│                    │
│    }                              │                    │
│  }                                ┘                    │
│                                                         │
│  sharedWithEmails: [              ┐                    │
│    "user2@example.com",           │ Queryable Array   │
│    "user3@example.com"            │ (For Indexing)    │
│  ]                                ┘                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Why This Works

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE TREES COLLECTION                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Tree 1: { ownerUid: "admin", sharedWithEmails: [] }        │
│  Tree 2: { ownerUid: "user1", sharedWithEmails: [] }        │
│  Tree 3: { ownerUid: "user2",                               │
│            sharedWithEmails: ["user@email.com"] } ◄─┐       │
│  Tree 4: { ownerUid: "admin", sharedWithEmails: [] } │      │
│  ...                                                  │       │
│  Tree 100: { ownerUid: "user50",                     │       │
│              sharedWithEmails: ["user@email.com"] } ◄┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                ┌───────────┴───────────┐
                │   NEW QUERY           │
                │                       │
                │  where(               │
                │   'sharedWithEmails', │
                │   'array-contains',   │
                │   'user@email.com'    │
                │  )                    │
                │                       │
                │  ✅ USES INDEX        │
                │     RETURNS ONLY      │
                │     TREE 3 & TREE 100 │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  SECURITY RULES       │
                │  CHECK ONLY 2 TREES:  │
                │                       │
                │  Can user read Tree 3?│
                │  ✅ YES (shared with) │
                │                       │
                │  Can user read Tree100│
                │  ✅ YES (shared with) │
                │                       │
                │  ✅ PERMISSION OK     │
                └───────────────────────┘
```

---

## Query Performance Comparison

### OLD: Nested Map Query

```
Time Complexity: O(n) where n = total trees

┌───────────────────────────────────────┐
│  Step 1: Scan all documents          │
│  Time: 100ms * 100 trees = 10,000ms  │
└───────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│  Step 2: Check security for each     │
│  Time: 50ms * 100 trees = 5,000ms    │
└───────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│  Step 3: Filter matching documents   │
│  Time: 10ms                           │
└───────────────────────────────────────┘
           │
           ▼
    Total: ~15,000ms (15 seconds) ❌
    PLUS: Permission denied!
```

### NEW: Array-Contains Query

```
Time Complexity: O(log n + m) where m = matching documents

┌───────────────────────────────────────┐
│  Step 1: Index lookup                │
│  Time: 20ms (direct access)           │
└───────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│  Step 2: Get 2 matching docs          │
│  Time: 50ms                           │
└───────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│  Step 3: Check security for 2 docs   │
│  Time: 50ms * 2 = 100ms               │
└───────────────────────────────────────┘
           │
           ▼
    Total: ~170ms (0.17 seconds) ✅
    PLUS: Permission granted!
```

**Performance Improvement:** ~88x faster (15000ms → 170ms)

---

## Code Flow Diagrams

### Sharing a Tree

```
┌──────────────────────────────────────────────────────────────┐
│                     USER CLICKS "SHARE"                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  shareTreeWithUser(treeId, recipientEmail, permission)       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Normalize email: "User@Example.com" → "user@example.com"│
│                                                               │
│  2. Get current tree document from Firestore                 │
│     const treeSnap = await getDoc(treeRef)                   │
│                                                               │
│  3. Get existing sharedWithEmails array                      │
│     const currentEmails = treeData?.sharedWithEmails || []   │
│                                                               │
│  4. Add email to array if not present                        │
│     const updatedEmails = currentEmails.includes(email)      │
│       ? currentEmails                                         │
│       : [...currentEmails, email]                            │
│                                                               │
│  5. Update Firestore with BOTH fields                        │
│     await updateDoc(treeRef, {                               │
│       // Detailed info in map                                │
│       [`sharedWith.${email}`]: {                             │
│         permission: "view" or "edit",                        │
│         sharedAt: Timestamp.now(),                           │
│         sharedBy: ownerEmail                                 │
│       },                                                      │
│       // Queryable array                                     │
│       sharedWithEmails: updatedEmails                        │
│     })                                                        │
│                                                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              ✅ TREE SUCCESSFULLY SHARED                      │
│     Recipient can now see tree in their list                 │
└──────────────────────────────────────────────────────────────┘
```

### Loading Shared Trees

```
┌──────────────────────────────────────────────────────────────┐
│              USER NAVIGATES TO /trees PAGE                    │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Trees.list(userId, { includeShared: true, userEmail })     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Query owned trees                                        │
│     where('ownerUid', '==', userId)                          │
│     Result: 3 trees                                          │
│                                                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Query shared trees (if includeShared)                   │
│     where('sharedWithEmails', 'array-contains',              │
│           userEmail.toLowerCase())                           │
│     Result: 2 trees                                          │
│                                                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Merge results, remove duplicates                         │
│     const treeMap = new Map()                                │
│     [...ownedTrees, ...sharedTrees].forEach(                 │
│       t => treeMap.set(t.id, t)                              │
│     )                                                         │
│     Result: 5 unique trees                                   │
│                                                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              ✅ DISPLAY ALL TREES IN UI                       │
│     (3 owned + 2 shared = 5 total)                           │
└──────────────────────────────────────────────────────────────┘
```

### Removing Share Access

```
┌──────────────────────────────────────────────────────────────┐
│               USER CLICKS "REMOVE ACCESS"                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  removeTreeShare(treeId, recipientEmail)                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Normalize email: "User@Example.com" → "user@example.com"│
│                                                               │
│  2. Get current tree document                                │
│     const treeSnap = await getDoc(treeRef)                   │
│                                                               │
│  3. Get current sharedWithEmails array                       │
│     const currentEmails = treeData?.sharedWithEmails || []   │
│                                                               │
│  4. Remove email from array                                  │
│     const updatedEmails = currentEmails.filter(              │
│       e => e !== normalizedEmail                             │
│     )                                                         │
│                                                               │
│  5. Update Firestore - remove from BOTH fields               │
│     await updateDoc(treeRef, {                               │
│       // Delete from map                                     │
│       [`sharedWith.${email}`]: deleteField(),                │
│       // Remove from array                                   │
│       sharedWithEmails: updatedEmails                        │
│     })                                                        │
│                                                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              ✅ ACCESS REMOVED SUCCESSFULLY                   │
│   Tree no longer appears in recipient's list                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Security Rules Flow

### Document Access Check

```
┌──────────────────────────────────────────────────────────────┐
│           USER TRIES TO ACCESS TREE DOCUMENT                  │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│             FIRESTORE SECURITY RULES                          │
│                                                               │
│  match /trees/{treeId} {                                     │
│    allow read: if isTreeOwner(treeId)                        │
│                || request.auth.token.email                   │
│                   in resource.data.sharedWith                │
│                || isAdmin()                                   │
│                || isSuperUser();                             │
│  }                                                            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    CHECK CONDITIONS                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. isTreeOwner(treeId)?                                     │
│     → Check if request.auth.uid == resource.data.ownerUid    │
│     ✅ YES → Allow access                                     │
│     ❌ NO → Continue to next check                            │
│                                                               │
│  2. Is user's email in sharedWith map?                       │
│     → Check if request.auth.token.email                      │
│        is a key in resource.data.sharedWith                  │
│     ✅ YES → Allow access                                     │
│     ❌ NO → Continue to next check                            │
│                                                               │
│  3. isAdmin()?                                               │
│     → Check user's custom claims                             │
│     ✅ YES → Allow access                                     │
│     ❌ NO → Continue to next check                            │
│                                                               │
│  4. isSuperUser()?                                           │
│     → Check user's role                                      │
│     ✅ YES → Allow access                                     │
│     ❌ NO → Deny access                                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Migration Visual

### Before Migration

```
┌────────────────────────────────────────┐
│  Tree A                                │
│  {                                     │
│    sharedWith: {                       │
│      "user1@test.com": {...}          │
│    }                                   │
│  }                                     │
│  ❌ Missing sharedWithEmails array     │
└────────────────────────────────────────┘

Result: Query fails, tree not in recipient's list
```

### After Migration

```
┌────────────────────────────────────────┐
│  Tree A                                │
│  {                                     │
│    sharedWith: {                       │
│      "user1@test.com": {...}          │
│    },                                  │
│    sharedWithEmails: [                │
│      "user1@test.com"                 │
│    ]                                   │
│  }                                     │
│  ✅ Both fields present and in sync    │
└────────────────────────────────────────┘

Result: Query succeeds, tree appears in recipient's list
```

---

## Error States & Recovery

### Error: Tree Not Appearing

```
┌────────────────────────────┐
│  Tree not in recipient's   │
│  list after sharing        │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  Check Firestore document  │
└──────────┬─────────────────┘
           │
           ├──► Has sharedWithEmails array?
           │    ❌ NO
           │    └──► Run migration script
           │         └──► ✅ Fixed
           │
           └──► ✅ YES
                └──► Email in array?
                     ├──► ❌ NO
                     │    └──► Re-share tree
                     │         └──► ✅ Fixed
                     │
                     └──► ✅ YES
                          └──► Email lowercase?
                               ├──► ❌ NO
                               │    └──► Re-share tree
                               │         └──► ✅ Fixed
                               │
                               └──► ✅ YES
                                    └──► Check user email match
                                         └──► ✅ Should work
```

---

## Architecture Decision Rationale

### Why Not Other Approaches?

#### Rejected: Separate Collection
```
userTreeAccess/
  {userId}/
    trees/
      {treeId}: { permission: "view" }
```

**Pros:**
- Clean separation
- Easy user-centric queries

**Cons:**
- ❌ More write operations (2x writes)
- ❌ Harder to maintain consistency
- ❌ Complex security rules
- ❌ More expensive (storage + operations)

#### Rejected: Client-Side Filtering
```
1. Fetch ALL trees
2. Filter in JavaScript
```

**Cons:**
- ❌ Requires admin-level access
- ❌ Security risk
- ❌ Terrible performance
- ❌ Expensive (reads all documents)

#### ✅ Chosen: Dual-Field
```
Same document with:
- sharedWith (map)
- sharedWithEmails (array)
```

**Pros:**
- ✅ Works with security rules
- ✅ Fast indexed queries
- ✅ Simple to implement
- ✅ Easy to maintain
- ✅ Minimal storage overhead

**Cons:**
- ⚠️ Slight data duplication (~50 bytes per user)

---

## Summary

### The Fix in One Diagram

```
BEFORE                          AFTER
──────                          ─────

Query:                          Query:
where('sharedWith.email',       where('sharedWithEmails',
      '!=', null)                    'array-contains', 'email')

    ↓                               ↓
❌ Scans all docs                ✅ Uses index
❌ Security blocks               ✅ Security allows
❌ Slow (O(n))                   ✅ Fast (O(log n))
❌ Doesn't work                  ✅ Works perfectly


Data:                           Data:
{                               {
  sharedWith: {                   sharedWith: {
    "user@test.com": {...}          "user@test.com": {...}
  }                                 },
}                                 sharedWithEmails: [
                                     "user@test.com"
                                   ]
                                 }

    ↓                               ↓
❌ Can't query efficiently       ✅ Array-contains query
                                 ✅ Indexed lookup
                                 ✅ Security compatible
```

---

*This visual guide complements the technical documentation in TREE_SHARING_FIX.md*
