# Family Tree Builder Integration Plan

## 1. Executive Summary
This document outlines the strategy for integrating the standalone "Tree Builder" application (React/Vite/MongoDB) into the main "Family Tree App" (React/Firebase). The goal is to provide a seamless visual tree-building experience within the existing application, leveraging Firebase Firestore for real-time data persistence and replacing the legacy list-based member management with a graph-based visual editor.

## 2. Architecture Overview

### Current State
- **Main App**: React (CRA), Firebase (Auth, Firestore, Functions). List-based data entry.
- **Tree Builder**: React (Vite), Express/MongoDB. Canvas-based visual editor using `reactflow`.

### Target State (Chosen Option: Embedded Builder + Firestore Adapter)
- **Unified App**: React (CRA), Firebase. The visual builder runs **inside** the main app, not as a separate deployed app.
- **Tree Builder Module**: We reuse the standalone builder's React components and state logic as much as possible, mounting them under a route like `/builder` or `/builder/:treeId`.
- **Backend**: The Node.js/Express/MongoDB backend of the builder is retired. Its REST API surface is replaced by a **Firestore-backed adapter** that implements the same logical operations (create tree, list trees, add member, add relationship, etc.).
- **Auth**: We drop the standalone email/password auth. All builder operations run as the already-signed-in Firebase user from the main app.
- **Legacy Data**: Existing `customers` and their embedded `familyMembers` are considered test data and may be cleared or ignored. New trees will use the builder's data model only.

## 3. Technical Stack Alignment

### Dependencies
The following libraries from the Tree Builder must be installed in the Main App:
- `reactflow`: Core canvas library.
- `elkjs` & `web-worker`: For auto-layout algorithms (if used in builder).
- `html-to-image`: For exporting tree images.
- `@heroicons/react`: For UI icons.
- `dagre`: (Optional) Alternative layout engine if ELK is too heavy.

### File Structure
New directory structure in `src/components/TreeBuilder/`:
```
src/
  components/
    TreeBuilder/
      TreeBuilderPage.js       # Main container / Route target
      TreeBoard.js             # ReactFlow canvas wrapper
      Sidebar.js               # Drag-and-drop member list
      controls/                # Zoom, Layout, Export controls
      nodes/                   # Custom Node Components
        FamilyNode.js
        MarriageNode.js
      edges/                   # Custom Edge Components
      hooks/                   # Custom hooks for Firestore sync
      utils/                   # Layout and formatting utilities
```

## 4. Data Model Transformation (MongoDB c Firestore)

We will **mirror the standalone Tree Builder's model** in Firestore, changing only the persistence layer, not the logical behavior.

> Note: Exact field lists come from `tree-builder/client/src/App.jsx`, `utils/api.js`, and related model helpers.

### High-Level Firestore Schema (per tree)

We will introduce a top-level `trees` collection to store visual trees:

- `trees/{treeId}`
  - `ownerUid`: string (Firebase auth UID)
  - `title`: string
  - `createdAt`: Timestamp / ISO string
  - `updatedAt`: Timestamp / ISO string
  - other metadata as needed (flags, settings)

Members and relationships are stored as subcollections:

- `trees/{treeId}/members/{memberId}`
  - Fields adapted from the standalone `tree.members[]` objects, e.g.:
    - `name`, `nickname`
    - `gender`
    - `position`: `{ x: number, y: number }`
    - `archived`: boolean
    - other flags/metadata used by the builder

- `trees/{treeId}/relationships/{relationshipId}`
  - Fields adapted from the standalone relationships model, e.g.:
    - `sourceId`, `targetId`
    - `type`: `parent` | `child` | `spouse` | `sibling` | `custom`
    - any extra metadata (labels, directionality, etc.)

Existing `customers` documents will **no longer be the source of truth** for family members. Instead:

- Each customer may later reference a tree via a `treeId` field, or
- We may create one tree per user by default (to be decided in a later iteration).

## 5. Implementation Phases

### Phase 1: Environment Setup & Dependencies
- [ ] Ensure `reactflow`, `html-to-image`, `@heroicons/react` are installed in the main app.
- [ ] Align styling (Tailwind / CSS) so ported components visually fit the main app.

### Phase 2: Embed Standalone Builder UI
- [ ] Create a wrapper route in the main app (e.g. `/builder` or `/builder/:treeId`).
- [ ] Mount the standalone builder's root component (from `tree-builder/client/src/App.jsx`) inside this route.
- [ ] Remove/disable the builder's internal auth UI; instead, pass the current Firebase user/context from the main app.

### Phase 3: Firestore Adapter for Builder API
- [ ] Identify the API surface in `tree-builder/client/src/utils/api.js` (`Trees`, `Members`, `Relationships`, `Users`, etc.).
- [ ] Reimplement these functions in the main app (or in a shared module) to talk to Firestore using the schema in Section 4.
- [ ] Ensure that from the builder's perspective, the API behaves the same (same function names and basic semantics), minimizing changes to UI/logic code.

### Phase 4: Tree Initialization & Legacy Data Handling
- [ ] Decide the mapping between main-app users/customers and `trees/{treeId}` (e.g. one tree per user or one per customer).
- [ ] On first visit to the builder for a user/customer, create an initial tree with a single "Self" node derived from the user's or customer's name.
- [ ] Stop using `customers.{familyMembers}` as a source of truth; optionally add a one-time cleanup/migration script to archive or remove it.

### Phase 5: Advanced Features (From Standalone Builder)
- [ ] Keep and verify: member modal (add/edit), relationship picker, connection rules (parent/child/sibling/spouse/custom), archive/restore, auto-layout, export to image, and any admin/kinship tools you choose to enable.
- [ ] Incrementally wire any optional panels (AdminPanel, KinshipPanel) once core CRUD/relationship flows are stable.

### Phase 6: Integration & UX Polish
- [ ] Update Landing Page "Start Your Tree" to navigate directly to the embedded builder route.
- [ ] Optionally link specific customers to specific trees (e.g. "Open Builder" from a customer detail view).
- [ ] Review and remove/retire legacy list-based views once the builder covers all primary workflows.

## 6. Verification Checklist
- [ ] **Canvas Rendering**: Nodes appear at correct coordinates.
- [ ] **Persistence**: Dragging a node and refreshing the page retains position.
- [ ] **Connections**: Drawing a line between nodes creates a valid relationship in Firestore.
- [ ] **New Members**: Dragging from sidebar creates a new node.
- [ ] **Navigation**: Can enter from Landing Page and exit back to Home.

## 7. Notes & Risks
- **Data Loss**: Since we are changing the schema, existing test data in `familyMembers` might break the view. **Mitigation**: We will implement a migration script or simply clear test data as requested.
- **Performance**: Large trees (100+ nodes) might be slow. **Mitigation**: ReactFlow is optimized, but we should limit real-time Firestore writes (debounce drag updates).
