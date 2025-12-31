# Tree Builder Integration TODO

This document tracks features that need to be ported from the standalone tree-builder app to the integrated Firebase app.

## High Priority (Core UX Parity) ✅ COMPLETED

- [x] **Node Alignment/Snapping During Drag** - Shows alignment guides and snaps nodes to nearby nodes
  - Implemented in `TreeBoard.js` with `SNAP_THRESHOLD` (12px) and `GUIDE_THRESHOLD` (18px)
  - Visual guides appear when dragging nodes near other nodes' edges/centers
  - Automatic snapping to aligned positions

- [x] **Edge Bundling** - Groups overlapping edges and hides duplicate labels to reduce visual clutter
  - Added `bundleEdges()` function to `EmbeddedBuilderPage.js`
  - Groups edges by type and orientation (vertical/horizontal)
  - Primary edge keeps label, secondary edges hide labels
  - Edges with `data.bundle === false` are excluded from bundling

- [x] **Drag-Drop from Sidebar** - Complete the drag-drop implementation for adding members from pool to canvas
  - Added draggable attribute to pool members in `SidebarPanel.js`
  - Implemented `onDragOver` and `onDrop` handlers in `TreeBoard.js`
  - Uses `rfInstance.project()` to convert screen→flow coordinates
  - Added `handleDropMember()` in `EmbeddedBuilderPage.js` to persist position

## Medium Priority (Enhanced Features)

- [ ] **Auto Layout (ELK)** - Layered Sugiyama layout with revert option
- [ ] **Maximize/Fullscreen Mode** - Expand canvas to full viewport
- [ ] **Color Legend Panel** - Shows relationship type colors
- [ ] **Add Node Button on Canvas** - Direct canvas interaction with smart placement
- [ ] **Photo Upload** - Upload photos directly instead of URL-only
- [ ] **Connected Members List in Sidebar** - Shows who's currently on canvas

## Lower Priority (Advanced)

- [ ] **Export to PNG** - Export canvas as image
- [ ] **Archived Trees Management** - Recovery from deletion
- [ ] **Kinship Panel** - Requires backend kinship calculation
- [ ] **Admin Panel** - Requires admin backend endpoints
- [ ] **Marriage Point Position Persistence** - Save dragged marriage point positions to Firestore

## Completed Features

- [x] Custom FamilyNode with 8 handles (4 positions × 2 types)
- [x] Custom FamilyEdge with multiple path styles
- [x] MarriagePointNode for multi-parent families
- [x] Connection normalization (consistent source→target direction)
- [x] Edge handle adjustment on drag stop
- [x] Preview edge while picking relationship type
- [x] Relationship create/edit/delete via modal
- [x] Member modal with validation
- [x] Member pool in sidebar
- [x] Tree selection/creation page

## Implementation Notes

### Node Alignment/Snapping
- Shows vertical/horizontal guides when dragging near other nodes
- Configurable thresholds: SNAP_THRESHOLD (12px) and GUIDE_THRESHOLD (18px)
- Aligns to left/center/right (X) and top/center/bottom (Y) of other nodes

### Edge Bundling
- Groups edges by type and orientation (vertical/horizontal)
- Primary edge keeps label, secondary edges hide labels
- Edges with `data.bundle === false` are excluded from bundling

### Drag-Drop from Sidebar
- Uses HTML5 drag-and-drop API
- Projects screen coordinates to flow-space using rfInstance.project()
- Updates member position in Firestore on drop
