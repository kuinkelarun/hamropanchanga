import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trees, Members, Relationships, MarriagePoints } from './utils/firestoreTreeApi';
import TreeBoard from './TreeBoard';
import SidebarPanel from './SidebarPanel';
import MemberModal from './MemberModal';
import RelationshipPicker from './RelationshipPicker';
import { displayMemberName } from './utils/format';
import * as htmlToImage from 'html-to-image';
import './styles/TreeBuilder.css';

const RELATIONSHIP_COLORS = {
  parent: '#f97316',
  child: '#f97316',
  spouse: '#ec4899',
  sibling: '#10b981',
  custom: '#8b5cf6',
};

// Group edges that overlap (same type and orientation) and hide duplicate labels.
// This reduces visual clutter while preserving underlying relationships.
function bundleEdges(edgesIn, nodesIn) {
  try {
    if (!Array.isArray(edgesIn) || !edgesIn.length) return [];
    
    const pos = new Map(nodesIn.map(nd => [String(nd.id), nd.position || { x: 0, y: 0 }]));
    const groups = new Map();
    const output = [];

    function quant(v, q = 20) { return Math.round((v || 0) / q) * q; }

    // Separate edges that should not be bundled
    const edgesToBundle = [];
    for (const edge of edgesIn) {
      if (edge.data?.bundle === false) {
        output.push(edge);
      } else {
        edgesToBundle.push(edge);
      }
    }

    // Group the remaining edges
    for (const edge of edgesToBundle) {
      const type = edge?.data?.type || edge?.label || 'custom';
      const sp = pos.get(String(edge.source)) || { x: 0, y: 0 };
      const tp = pos.get(String(edge.target)) || { x: 0, y: 0 };
      const dx = (tp.x || 0) - (sp.x || 0);
      const dy = (tp.y || 0) - (sp.y || 0);
      const orient = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal';
      const midX = (sp.x + tp.x) / 2;
      const midY = (sp.y + tp.y) / 2;
      const key = orient === 'vertical'
        ? `${type}|${orient}|x=${quant(midX, 24)}`
        : `${type}|${orient}|y=${quant(midY, 24)}`;
      
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ edge, midX, midY, orient });
    }

    // Process the groups
    for (const [, arr] of groups) {
      if (arr.length <= 1) {
        output.push(arr[0].edge);
        continue;
      }
      
      const sorted = [...arr].sort((a, b) => (a.orient === 'vertical' ? a.midY - b.midY : a.midX - b.midX));
      const primary = sorted[Math.floor(sorted.length / 2)].edge;
      
      for (const { edge } of arr) {
        if (edge === primary) {
          output.push({ ...edge, data: { ...edge.data, bundlePrimary: true } });
        } else {
          // Hide duplicate labels for bundled edges
          output.push({ ...edge, label: '', data: { ...edge.data, bundleMember: true } });
        }
      }
    }
    
    return output;
  } catch (e) {
    return edgesIn; // Fallback on error
  }
}

// Helper function to create filename with tree title and date
function makeFilename(treeTitle, ext) {
  const title = (treeTitle || 'family-tree').trim();
  const safeTitle = title.replace(/[^a-z0-9\- _.]/gi, '').replace(/\s+/g, ' ').trim();
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${safeTitle} ${y}-${m}-${d}.${ext}`;
}

// Helper function to convert SVG data URL to PNG
function svgDataUrlToPng(svgUrl, pixelRatio = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      canvas.width = Math.max(1, Math.floor(w * pixelRatio));
      canvas.height = Math.max(1, Math.floor(h * pixelRatio));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = svgUrl;
  });
}

// Temporary shell component that will host the ported standalone Tree Builder UI.
// For now, it simply ensures a tree exists for the current user and displays its id.
export default function EmbeddedBuilderPage({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tree, setTree] = useState(null);
  const [members, setMembers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const exportRef = useRef(null);
  const [relPicker, setRelPicker] = useState({ open: false, source: '', target: '', sourceHandle: '', targetHandle: '' });
  const [editPicker, setEditPicker] = useState({ open: false, relationshipId: '', type: 'custom', label: '' });
  const [previewEdge, setPreviewEdge] = useState(null);
  const [relAdj, setRelAdj] = useState(new Map());
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Auto-show sidebar when the canvas is ready, then auto-hide after 3s on mobile
  useEffect(() => {
    if (!tree || loading) return;

    if (window.innerWidth < 1024) {
      setSidebarVisible(true);
      const timer = setTimeout(() => {
        setSidebarVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // On larger screens keep sidebar always visible
    setSidebarVisible(true);
  }, [tree, loading]);

  useEffect(() => {
    async function ensureTree() {
      if (!user) {
        setError('You must be signed in to use the tree builder.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const treeIdParam = searchParams.get('treeId');

        if (treeIdParam) {
          // If a specific treeId is provided (from the selection page),
          // load that tree directly.
          const selectedTree = await Trees.get(treeIdParam);
          if (selectedTree.deleted) {
            throw new Error('This tree has been archived.');
          }
          if (selectedTree.ownerUid && selectedTree.ownerUid !== user.uid) {
            throw new Error('You do not have access to this tree.');
          }
          setTree(selectedTree);
        } else {
          // Fallback: try to find an existing tree for this user, or
          // create a default one if none exists.
          const existing = await Trees.list(user.uid);
          let activeTree = existing && existing.length > 0 ? existing[0] : null;

          if (!activeTree) {
            activeTree = await Trees.create('My Family Tree', user.uid);

            // Seed the new tree with a single "Self" member so the
            // builder has an initial node to work with.
            try {
              await Members.create({
                treeId: activeTree.id,
                name: user.displayName || 'Self',
                nickname: '',
                gender: 'unknown',
                position: { x: 0, y: 0 },
                archived: false,
              });
            } catch (seedErr) {
              console.error('Error seeding initial member:', seedErr);
            }
          }

          setTree(activeTree);
        }
      } catch (err) {
        console.error('Error initializing tree:', err);
        setError(err.message || 'Failed to initialize tree');
      } finally {
        setLoading(false);
      }
    }
    ensureTree();
  }, [user, searchParams]);

  function hasPosVal(pos) {
    return pos && typeof pos.x === 'number' && typeof pos.y === 'number';
  }

  function fallbackPosForIndex(idx) {
    return { x: (idx % 6) * 180, y: Math.floor(idx / 6) * 140 };
  }

  function nextAvailablePersonName(currentMembers) {
    const used = new Set();
    for (const m of currentMembers || []) {
      const nm = (m.name || '').trim();
      const match = /^Person\s+(\d+)$/.exec(nm);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > 0) used.add(n);
      }
    }
    let candidate = 1;
    while (used.has(candidate)) candidate++;
    return `Person ${candidate}`;
  }

  async function loadGraph(activeTree) {
    if (!activeTree) return;
    try {
      const memberList = await Members.list(activeTree.id);
      const rels = await Relationships.list(activeTree.id).catch(() => []);
      const savedMarriagePoints = await MarriagePoints.list(activeTree.id).catch(() => []);

      setMembers(memberList);
      const baseNodes = memberList
        .filter(m => hasPosVal(m.position))
        .map(m => ({
          id: m.id,
          type: 'familyNode',
          position: m.position,
          data: { label: displayMemberName(m) },
        }));

      const posById = new Map();
      memberList.forEach(m => {
        if (hasPosVal(m.position)) {
          posById.set(String(m.id), m.position);
        }
      });

      // Build adjacency for parent/child relationships (independent of drag direction
      // or whether the user picked "parent" vs "child" in the picker). This matches
      // the standalone builder's behavior where multi-parent detection only cares
      // that a child is connected to two parents, not which endpoint authored the edge.
      const adjacency = new Map(); // memberId -> Set(connectedMemberId) for parent/child relations
      const relByPair = new Map(); // 'a|b' (sorted) -> relationship doc (first seen)
      const spousePairs = new Set(); // 'a|b' (sorted) representing spouse connections

      if (Array.isArray(rels) && rels.length > 0) {
        for (const r of rels) {
          const a = String(r.fromMemberId || '');
          const b = String(r.toMemberId || '');
          if (!a || !b) continue;

          // Track spouse connections for marriage-point gating
          if (r.type === 'spouse') {
            const spouseKey = a < b ? `${a}|${b}` : `${b}|${a}`;
            spousePairs.add(spouseKey);
          }

          // Only parent/child contribute to adjacency
          if (r.type !== 'parent' && r.type !== 'child') continue;

          if (!adjacency.has(a)) adjacency.set(a, new Set());
          if (!adjacency.has(b)) adjacency.set(b, new Set());
          adjacency.get(a).add(b);
          adjacency.get(b).add(a);

          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (!relByPair.has(key)) {
            relByPair.set(key, r);
          }
        }
      }

      // Persist parent/child adjacency for highlighting
      setRelAdj(adjacency);

      // Derive parent pairs from members that share a common child. Here we
      // treat the member that has 2+ parent/child connections as the child,
      // and its neighbors as parents, matching the multi-parent semantics of
      // the standalone builder.
      const parentPairs = new Map(); // 'id1|id2' -> { parents:[id1,id2], children:Set(childIds) }
      adjacency.forEach((neighbors, memberId) => {
        const parents = [...neighbors];
        if (parents.length < 2) return;
        for (let i = 0; i < parents.length; i++) {
          for (let j = i + 1; j < parents.length; j++) {
            const a = String(parents[i]);
            const b = String(parents[j]);
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (!parentPairs.has(key)) {
              parentPairs.set(key, { parents: [a, b], children: new Set() });
            }
            parentPairs.get(key).children.add(String(memberId));
          }
        }
      });

      const savedMpPos = new Map((savedMarriagePoints || [])
        .map(mp => [String(mp.id), mp.position])
        .filter(([, pos]) => hasPosVal(pos))
      );

      const nodesWithMarriage = [...baseNodes];
      const marriageEdges = [];
      const processedPairs = new Set(); // track parent-child pairs handled via marriage points

      parentPairs.forEach(({ parents, children }, key) => {
        const [p1Id, p2Id] = parents;
        const commonChildren = [...children];
        if (!commonChildren.length) return;

        // Only create a marriage point when the two parents are spouses
        if (!spousePairs.has(key)) return;

        const marriagePointId = `mp-${key}`;

        const p1Pos = posById.get(p1Id) || { x: 0, y: 0 };
        const p2Pos = posById.get(p2Id) || { x: 0, y: 0 };
        const defaultPos = {
          x: (p1Pos.x + p2Pos.x) / 2,
          y: Math.max(p1Pos.y, p2Pos.y) + 50,
        };
        const savedPos = savedMpPos.get(marriagePointId);
        const marriagePointPos = savedPos && hasPosVal(savedPos) ? savedPos : defaultPos;

        nodesWithMarriage.push({
          id: marriagePointId,
          type: 'marriagePoint',
          position: marriagePointPos,
          data: { parents: [p1Id, p2Id], type: 'marriage', hasSavedPosition: !!savedPos },
          draggable: true,
          selectable: false,
        });

        // Parent -> marriage point connector edges (visual only, no arrowheads)
        [p1Id, p2Id].forEach(parentId => {
          marriageEdges.push({
            id: `e-${parentId}-${marriagePointId}`,
            source: parentId,
            target: marriagePointId,
            type: 'familyEdge',
            sourceHandle: 'bottom-source',
            targetHandle: 'top-target',
            data: { type: 'parent-connector', virtual: false, renderStyle: 'orthogonal' },
          });
        });

        // Marriage point -> children edges (single logical parent-child with arrow)
        commonChildren.forEach(childId => {
          const edgeId = `e-${marriagePointId}-${childId}`;
          const labelText = 'child';
          const color = RELATIONSHIP_COLORS.child || RELATIONSHIP_COLORS.parent;
          // Prefer the first parent's relationship doc for editing/deletion
          const key1 = p1Id < childId ? `${p1Id}|${childId}` : `${childId}|${p1Id}`;
          const key2 = p2Id < childId ? `${p2Id}|${childId}` : `${childId}|${p2Id}`;
          const relForChild = relByPair.get(key1) || relByPair.get(key2) || null;
          marriageEdges.push({
            id: edgeId,
            source: marriagePointId,
            target: childId,
            type: 'familyEdge',
            sourceHandle: 'bottom-source',
            targetHandle: 'top-target',
            label: labelText,
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color },
            data: {
              type: 'child',
              label: labelText,
              fromMarriagePoint: true,
              relationshipId: relForChild ? relForChild.id : undefined,
            },
          });

          // Mark parent-child pairs as processed so we don't create separate direct edges
          processedPairs.add(`${p1Id}-${childId}`);
          processedPairs.add(`${childId}-${p1Id}`);
          processedPairs.add(`${p2Id}-${childId}`);
          processedPairs.add(`${childId}-${p2Id}`);
        });
      });

      let nextEdges = [...marriageEdges];
      if (Array.isArray(rels) && rels.length > 0) {
        const pairMap = new Map();

        for (const r of rels) {
          const src = r.fromMemberId;
          const dst = r.toMemberId;
          if (!src || !dst) continue;

          const pairKey = `${String(src)}-${String(dst)}`;
          if (processedPairs.has(pairKey)) continue;

          const a = String(src);
          const b = String(dst);
          const sortedKey = a < b ? `${a}|${b}` : `${b}|${a}`;
          const current = pairMap.get(sortedKey);

          const type = r.type || 'custom';
          const label = r.label || type;
          console.log('[loadGraph] Processing relationship:', { id: r.id, type: r.type, resolved: type, label, fromMemberId: src, toMemberId: dst });
          const edgeColor = RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.custom;

          const srcPos = posById.get(String(src)) || { x: 0, y: 0 };
          const dstPos = posById.get(String(dst)) || { x: 0, y: 0 };
          const dx = (dstPos.x || 0) - (srcPos.x || 0);
          const dy = (dstPos.y || 0) - (srcPos.y || 0);

          let sourceHandle;
          let targetHandle;

          const displaySourceId = String(src);
          const displayTargetId = String(dst);

          let edgeSourceId = displaySourceId;
          let edgeTargetId = displayTargetId;
          let edgeType = type;
          let edgeLabel = label;

          if (type === 'parent' || type === 'child') {
            if (type === 'child') {
              sourceHandle = 'bottom-source';
              targetHandle = 'top-target';
            } else {
              sourceHandle = 'top-source';
              targetHandle = 'bottom-target';
            }
          } else if (type === 'spouse' || type === 'sibling') {
            const srcRight = dx >= 0;
            sourceHandle = `${srcRight ? 'right' : 'left'}-source`;
            targetHandle = `${srcRight ? 'left' : 'right'}-target`;
          } else {
            if (Math.abs(dx) >= Math.abs(dy)) {
              const srcRight = dx >= 0;
              sourceHandle = `${srcRight ? 'right' : 'left'}-source`;
              targetHandle = `${srcRight ? 'left' : 'right'}-target`;
            } else {
              const srcDown = dy >= 0;
              sourceHandle = `${srcDown ? 'bottom' : 'top'}-source`;
              targetHandle = `${srcDown ? 'top' : 'bottom'}-target`;
            }
          }

          const edgeId = `${edgeSourceId}-${edgeTargetId}-${edgeType}-${r.id}`;

          const candidate = {
            id: edgeId,
            source: edgeSourceId,
            target: edgeTargetId,
            type: 'familyEdge',
            label: edgeLabel,
            sourceHandle,
            targetHandle,
            style: { stroke: edgeColor, strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color: edgeColor },
            data: { type: edgeType, label: edgeLabel, relationshipId: r.id },
          };

          if (!current) {
            pairMap.set(sortedKey, {
              edge: candidate,
              hasLabel: !!r.label,
              type,
              src: String(src),
              dst: String(dst),
            });
          } else {
            let preferThis = false;
            if (type === 'sibling' || type === 'spouse') {
              if (!!r.label && !current.hasLabel) preferThis = true;
              else preferThis = false;
            } else {
              preferThis = !!r.label && !current.hasLabel;
            }

            if (preferThis) {
              pairMap.set(sortedKey, {
                edge: candidate,
                hasLabel: !!r.label,
                type,
                src: String(src),
                dst: String(dst),
              });
            }
          }
        }

        // Combine marriage-derived edges with direct relationship edges.
        // pairMap only holds direct member-to-member relationships; it never
        // contains the virtual marriage edges we generated above.
        const directEdges = Array.from(pairMap.values()).map(v => v.edge);
        nextEdges = [...marriageEdges, ...directEdges];
      }

      // Mark nodes as connected if they appear in any edge (source or target)
      const connectedSet = new Set();
      for (const e of nextEdges) {
        if (e && e.source) connectedSet.add(String(e.source));
        if (e && e.target) connectedSet.add(String(e.target));
      }

      const nextNodes = nodesWithMarriage.map(node => ({
        ...node,
        data: {
          ...(node.data || {}),
          connected: connectedSet.has(String(node.id)),
        },
      }));

      setNodes(nextNodes.length > 0 ? nextNodes : []);
      // Apply edge bundling to reduce visual clutter from overlapping edges
      setEdges(bundleEdges(nextEdges, nextNodes));
    } catch (err) {
      console.error('Error loading graph for tree', activeTree.id, err);
    }
  }

  // Once we have a tree, load its members and relationships into React Flow
  useEffect(() => {
    if (!tree) return;
    loadGraph(tree);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const handleNodeDragStop = async (event, node) => {
    try {
      if (!tree) return;
      if (node.type === 'marriagePoint') {
        // Persist marriage point position
        await MarriagePoints.upsert(tree.id, String(node.id), {
          position: node.position,
          parents: node.data?.parents || [],
        });
        // Mark as user-positioned so it won't recenter later in this session
        setNodes(prev => prev.map(n => {
          if (String(n.id) !== String(node.id)) return n;
          return { ...n, data: { ...(n.data || {}), hasSavedPosition: true } };
        }));
      } else {
        await Members.update(node.id, {
          treeId: tree.id,
          position: node.position,
        });
      }

      // After position change, update edge handles so spouse/sibling edges stay on
      // the correct left/right sides relative to node positions, and enforce
      // vertical handles for parent/child.
      const pos = new Map(nodes.map(n => [String(n.id), n.position || { x: 0, y: 0 }]));
      setEdges(prevEdges =>
        prevEdges.map(e => {
          const relType = String(e?.data?.type || e?.label || '').toLowerCase();
          const sp = pos.get(String(e.source));
          const tp = pos.get(String(e.target));
          if (!sp || !tp) return e;

          if (relType === 'spouse' || relType === 'sibling') {
            const dx = (tp.x || 0) - (sp.x || 0);
            const srcRight = dx >= 0;
            const sourceHandle = `${srcRight ? 'right' : 'left'}-source`;
            const targetHandle = `${srcRight ? 'left' : 'right'}-target`;
            if (e.sourceHandle === sourceHandle && e.targetHandle === targetHandle) return e;
            return { ...e, sourceHandle, targetHandle };
          }

          if (relType === 'parent' || relType === 'child') {
            const sourceHandle = relType === 'child' ? 'bottom-source' : 'top-source';
            const targetHandle = relType === 'child' ? 'top-target' : 'bottom-target';
            if (e.sourceHandle === sourceHandle && e.targetHandle === targetHandle) return e;
            return { ...e, sourceHandle, targetHandle };
          }

          return e;
        })
      );

      // Re-center only marriage points WITHOUT saved positions when a family node moves
      if (node.type !== 'marriagePoint') {
        setNodes(prevNodes => {
          const posMap = new Map(prevNodes.map(n => [String(n.id), n.position || { x: 0, y: 0 }]));
          return prevNodes.map(n => {
            if (n.type !== 'marriagePoint' || !n.data?.parents) return n;
            if (n.data?.hasSavedPosition) return n; // user has moved it; keep as-is
            const [p1Id, p2Id] = n.data.parents;
            const p1Pos = posMap.get(String(p1Id));
            const p2Pos = posMap.get(String(p2Id));
            if (!p1Pos || !p2Pos) return n;
            const newPos = {
              x: (p1Pos.x + p2Pos.x) / 2,
              y: Math.max(p1Pos.y, p2Pos.y) + 50,
            };
            if (n.position && n.position.x === newPos.x && n.position.y === newPos.y) return n;
            return { ...n, position: newPos };
          });
        });
      }
    } catch (err) {
      console.error('Error saving node position:', err);
    }
  };

  const handleConnect = async params => {
    if (!tree) return;
    const { source, target, sourceHandle, targetHandle } = params || {};
    if (!source || !target || source === target) return;
    // Avoid opening the picker if a relationship already exists between these two
    // Check both directions to handle normalized connections properly
    const hasEdge = edges.some(e => 
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
    );
    if (hasEdge) return;
    setRelPicker({ open: true, source, target, sourceHandle: sourceHandle || '', targetHandle: targetHandle || '' });
    setPreviewEdge(null);
  };

  const handleAddNodeToCanvas = async () => {
    if (!tree) return;
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  // Handle drag-drop from sidebar - member is placed at drop position
  const handleDropMember = async (memberId, position) => {
    if (!tree || !memberId) return;
    try {
      await Members.update(memberId, {
        treeId: tree.id,
        position,
      });
      await loadGraph(tree);
    } catch (err) {
      console.error('Error dropping member to canvas:', err);
    }
  };

  const handleSelectMember = memberId => {
    const m = members.find(mem => mem.id === memberId);
    if (!m) return;
    setEditingMember(m);
    setMemberModalOpen(true);
  };

  const handleNodeDoubleClick = (_event, node) => {
    if (!node || node.type !== 'familyNode') return;
    if (!node.id) return;
    handleSelectMember(node.id);
  };

  const handleCloseMemberModal = () => {
    setMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleSaveMember = async form => {
    if (!tree) return;
    try {
      if (editingMember && editingMember.id) {
        await Members.update(editingMember.id, {
          treeId: tree.id,
          ...form,
        });
      } else {
        // Create new member directly on canvas at default position
        const incomingName = (form?.name || '').trim();
        const name = incomingName || nextAvailablePersonName(members);
        const index = nodes.length;
        const position = fallbackPosForIndex(index);
        await Members.create({
          treeId: tree.id,
          ...form,
          name,
          position,
          archived: false,
        });
      }
      await loadGraph(tree);
      handleCloseMemberModal();
    } catch (err) {
      console.error('Error saving member:', err);
    }
  };

  const handleAddMemberToCanvas = async member => {
    if (!tree || !member) return;
    try {
      const index = nodes.length;
      const position = fallbackPosForIndex(index);
      await Members.update(member.id, {
        treeId: tree.id,
        position,
      });
      await loadGraph(tree);
    } catch (err) {
      console.error('Error adding member to canvas:', err);
    }
  };

  const handleMoveMemberToPool = async memberId => {
    if (!tree || !memberId) return;
    const member = members.find(m => m.id === memberId);
    const name = member ? displayMemberName(member) : 'this member';
    const ok = window.confirm(
      `Remove "${name}" from canvas?\n\nThe member will be moved to the Member Pool and can be added back to the canvas later.`
    );
    if (!ok) return;
    try {
      await Members.update(memberId, {
        treeId: tree.id,
        position: null,
      });
      await loadGraph(tree);
      handleCloseMemberModal();
    } catch (err) {
      console.error('Error moving member to pool:', err);
    }
  };

  const handleDeleteMember = async memberId => {
    if (!tree || !memberId) return;
    const member = members.find(m => m.id === memberId);
    const name = member ? displayMemberName(member) : 'this member';
    const ok = window.confirm(
      `Are you sure you want to permanently delete "${name}"?\n\nThis will remove the member and all their relationships from the tree. This action cannot be undone.`
    );
    if (!ok) return;
    try {
      await Relationships.removeByMember(tree.id, memberId);
      await Members.delete(memberId, tree.id);
      await loadGraph(tree);
      handleCloseMemberModal();
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  };

  const handleConfirmRelationship = async (type, label) => {
    console.log('[handleConfirmRelationship] Received:', { type, label, source: relPicker.source, target: relPicker.target });
    if (!tree || !relPicker.source || !relPicker.target) {
      setRelPicker({ open: false, source: '', target: '', sourceHandle: '', targetHandle: '' });
      return;
    }
    try {
      const relationshipData = {
        treeId: tree.id,
        fromMemberId: relPicker.source,
        toMemberId: relPicker.target,
        type: type || 'custom',
        label,
      };
      console.log('[handleConfirmRelationship] Creating relationship:', relationshipData);
      const result = await Relationships.create(relationshipData);
      console.log('[handleConfirmRelationship] Created relationship:', result);
      setRelPicker({ open: false, source: '', target: '', sourceHandle: '', targetHandle: '' });
      setPreviewEdge(null);
      await loadGraph(tree);
    } catch (err) {
      console.error('Error saving relationship:', err);
      setRelPicker({ open: false, source: '', target: '', sourceHandle: '', targetHandle: '' });
    }
  };

  const handleCancelRelationship = () => {
    setRelPicker({ open: false, source: '', target: '', sourceHandle: '', targetHandle: '' });
    setPreviewEdge(null);
  };

  const handleExportPng = async () => {
    try {
      if (!exportRef.current) return;
      
      // If we have a React Flow instance, fitView first so all nodes/edges are visible in the export
      const inst = exportRef.current._reactFlowInstance;
      let prevViewport = null;
      try {
        if (inst && typeof inst.getViewport === 'function') {
          prevViewport = inst.getViewport();
        }
      } catch (err) {}

      try {
        if (inst && typeof inst.fitView === 'function') {
          inst.fitView({ padding: 0.1 });
          // allow a short delay for layout/paint
          await new Promise(r => setTimeout(r, 180));
        }
      } catch (err) {
        // ignore
      }

      // Use SVG render path first (captures React Flow edges reliably), then rasterize to PNG
      const svgUrl = await htmlToImage.toSvg(exportRef.current, { backgroundColor: '#ffffff' });

      // Decide pixel ratio based on current viewport zoom so labels remain readable on large graphs
      const MIN_ZOOM = 0.12; // below this, increase pixel ratio
      const MAX_PIXEL_RATIO = 6; // do not exceed this to avoid insane memory usage
      let pixelRatio = 2;
      try {
        if (inst && typeof inst.getViewport === 'function') {
          const vp = inst.getViewport();
          const zoom = vp?.zoom || 1;
          if (zoom < MIN_ZOOM) {
            pixelRatio = Math.min(MAX_PIXEL_RATIO, Math.ceil(MIN_ZOOM / zoom) * 2);
          }
        }
      } catch (err) {
        // fallback to default pixelRatio
        pixelRatio = 2;
      }

      // Safety cap based on resulting raster size (browser canvas limits)
      const MAX_CANVAS_DIM = 16000; // conservative cap to avoid OOM or browser failures
      const tempImg = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = svgUrl;
      });
      const naturalW = tempImg.naturalWidth || tempImg.width || 0;
      const naturalH = tempImg.naturalHeight || tempImg.height || 0;
      if (naturalW > 0 && naturalH > 0) {
        const maxDim = Math.max(naturalW, naturalH);
        if (maxDim * pixelRatio > MAX_CANVAS_DIM) {
          const cap = Math.floor(MAX_CANVAS_DIM / maxDim) || 1;
          if (cap < pixelRatio) {
            console.warn(`Large tree detected — reducing export resolution to ${cap}× to avoid browser limits`);
            pixelRatio = cap;
          }
        }
      }

      const pngUrl = await svgDataUrlToPng(svgUrl, pixelRatio);

      // Restore previous viewport if possible
      try {
        if (inst && prevViewport) {
          if (typeof inst.setViewport === 'function') {
            inst.setViewport(prevViewport, { duration: 0 });
          } else if (typeof inst.setCenter === 'function') {
            inst.setCenter(prevViewport.x, prevViewport.y, { duration: 0 });
          }
        }
      } catch (err) {
        // ignore restore errors
      }

      const link = document.createElement('a');
      link.download = makeFilename(tree?.title, 'png');
      link.href = pngUrl;
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed: ' + (e.message || 'unknown error'));
    }
  };

  const handleTypePreview = type => {
    try {
      if (!relPicker.source || !relPicker.target) return;
      const from = String(relPicker.source);
      const to = String(relPicker.target);

      let sourceHandle;
      let targetHandle;
      if (type === 'parent') {
        sourceHandle = 'top-source';
        targetHandle = 'bottom-target';
      } else if (type === 'child') {
        sourceHandle = 'bottom-source';
        targetHandle = 'top-target';
      } else {
        const a = (nodes.find(n => String(n.id) === from) || {}).position || { x: 0, y: 0 };
        const b = (nodes.find(n => String(n.id) === to) || {}).position || { x: 0, y: 0 };
        const right = (b.x - a.x) >= 0;
        sourceHandle = `${right ? 'right' : 'left'}-source`;
        targetHandle = `${right ? 'left' : 'right'}-target`;
      }

      const edgeColor = RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.custom;
      const id = `preview-${from}-${to}`;
      setPreviewEdge({
        id,
        source: from,
        target: to,
        type: 'familyEdge',
        label: type !== 'custom' ? type : '',
        sourceHandle,
        targetHandle,
        style: { stroke: edgeColor, strokeWidth: 2, opacity: 0.8, strokeDasharray: '4,4' },
        markerEnd: { type: 'arrowclosed', color: edgeColor },
        data: {
          type,
          label: type !== 'custom' ? type : '',
          from,
          to,
          preview: true,
        },
      });
    } catch (err) {
      console.error('Error building relationship preview edge:', err);
    }
  };

  const handleEdgeDoubleClick = edge => {
    if (!edge || !edge.data) return;
    const { relationshipId, type, label } = edge.data;
    if (!relationshipId) return;
    // Clear highlight when entering edit mode
    clearSelection();
    setEditPicker({
      open: true,
      relationshipId,
      type: type || 'custom',
      label: label || '',
      source: String(edge.source || ''),
      target: String(edge.target || ''),
      fromMarriagePoint: !!edge.data.fromMarriagePoint,
    });
  };

  const handleConfirmEditRelationship = async (type, label) => {
    if (!tree || !editPicker.relationshipId) {
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
      return;
    }
    try {
      await Relationships.update(editPicker.relationshipId, {
        treeId: tree.id,
        type: type || 'custom',
        label,
      });
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
      await loadGraph(tree);
    } catch (err) {
      console.error('Error updating relationship:', err);
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
    }
  };

  const handleCancelEditRelationship = () => {
    setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
  };

  const handleDeleteRelationship = async () => {
    if (!tree || !editPicker.relationshipId) {
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
      return;
    }
    const ok = window.confirm('Delete this relationship? This cannot be undone.');
    if (!ok) return;
    try {
      // If deleting a child edge from a marriage point, also remove both parent-child docs
      if (editPicker.fromMarriagePoint && editPicker.target && editPicker.source && String(editPicker.source).startsWith('mp-')) {
        const childId = String(editPicker.target);
        const pairStr = String(editPicker.source).slice(3); // after 'mp-'
        const [p1Id, p2Id] = pairStr.split('|');
        // Remove any relationships between the child and both parents (both directions, any type)
        await Promise.all([
          Relationships.removeBetweenEndpoints(tree.id, p1Id, childId),
          Relationships.removeBetweenEndpoints(tree.id, p2Id, childId),
        ]);
      }
      // Also delete the specific relationship by id if present
      await Relationships.delete(editPicker.relationshipId, tree.id);
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
      await loadGraph(tree);
    } catch (err) {
      console.error('Error deleting relationship:', err);
      setEditPicker({ open: false, relationshipId: '', type: 'custom', label: '' });
    }
  };

  // Highlight parent/child chain starting from a clicked edge
  const handleEdgeClick = (edge) => {
    try {
      if (!edge) return;
      const type = edge?.data?.type || edge?.label || 'custom';
      const sourceId = String(edge.source || '');
      const targetId = String(edge.target || '');

      const seeds = new Set();

      const addMemberSeed = (id) => {
        if (!id) return;
        const s = String(id);
        if (!s.startsWith('mp-')) seeds.add(s);
      };

      if (type === 'parent-connector') {
        // Use parent and both parents of the marriage point as seeds
        addMemberSeed(sourceId);
        const mpNode = nodes.find(n => String(n.id) === targetId && n.type === 'marriagePoint');
        const parents = (mpNode && Array.isArray(mpNode.data?.parents)) ? mpNode.data.parents : [];
        parents.forEach(p => addMemberSeed(p));
      } else {
        // For parent/child/custom edges, seed from member endpoints
        addMemberSeed(sourceId);
        addMemberSeed(targetId);
        // If edge originates from a marriage point to a child, ensure child is a seed
        if (edge?.data?.fromMarriagePoint) addMemberSeed(targetId);
      }

      // BFS over parent/child adjacency (compute distance by levels)
      const dist = new Map();
      const queue = Array.from(seeds);
      queue.forEach(s => dist.set(String(s), 0));
      while (queue.length) {
        const cur = String(queue.shift());
        const curDist = dist.get(cur) ?? 0;
        const neigh = relAdj.get(cur);
        if (neigh && neigh.size) {
          for (const n of neigh) {
            const nn = String(n);
            if (!dist.has(nn)) {
              dist.set(nn, curDist + 1);
              queue.push(nn);
            }
          }
        }
      }

      // Select nodes: members in visited; marriage points that touch selected parents
      setNodes(prev => prev.map(n => {
        const id = String(n.id);
        if (n.type === 'marriagePoint') {
          const parents = (n.data && Array.isArray(n.data.parents)) ? n.data.parents.map(String) : [];
          const select = parents.some(p => dist.has(p));
          return { ...n, selected: !!select };
        }
        return { ...n, selected: dist.has(id) };
      }));

      // Select edges along the parent/child chain and assign animation delay by phase
      const PHASE_MS = 140; // delay between levels
      setEdges(prev => prev.map(e => {
        const et = e?.data?.type || e?.label || 'custom';
        const s = String(e.source || '');
        const t = String(e.target || '');
        let select = false;
        let animDelayMs = null;
        if (et === 'parent' || et === 'child') {
          const sMember = !s.startsWith('mp-');
          const tMember = !t.startsWith('mp-');
          if (sMember && tMember) {
            const ds = dist.get(s);
            const dt = dist.get(t);
            select = dist.has(s) && dist.has(t);
            if (select) animDelayMs = Math.min(ds ?? 0, dt ?? 0) * PHASE_MS;
          } else if (!sMember && tMember && e?.data?.fromMarriagePoint) {
            // mp -> child edge: select if child is visited
            const dt = dist.get(t);
            select = dist.has(t);
            if (select) animDelayMs = (dt ?? 0) * PHASE_MS;
          }
        } else if (et === 'parent-connector') {
          // select if parent endpoint is visited
          const parentId = !s.startsWith('mp-') ? s : (!t.startsWith('mp-') ? t : '');
          const dp = parentId ? dist.get(parentId) : null;
          select = !!parentId && dist.has(parentId);
          if (select) animDelayMs = (dp ?? 0) * PHASE_MS;
        }
        const nextData = { ...(e.data || {}) };
        if (animDelayMs != null) nextData.animDelayMs = animDelayMs;
        return { ...e, selected: !!select, data: nextData };
      }));
    } catch (err) {
      // Fail-safe: ignore highlight errors
    }
  };

  const clearSelection = () => {
    setNodes(prev => prev.map(n => ({ ...n, selected: false })));
    setEdges(prev => prev.map(e => ({ ...e, selected: false, data: { ...(e.data || {}), animDelayMs: null } })));
  };

  const handlePaneClick = () => {
    // Clear all selections
    clearSelection();
  };

  if (loading) {
    return <div className="builder-loading">Loading Tree Builder...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
        <button
          className="mt-2 px-4 py-2 bg-gray-200 rounded"
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="p-4">
        <p>No tree available.</p>
        <button
          className="mt-2 px-4 py-2 bg-gray-200 rounded"
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-gray-100 flex">
      {/* Sidebar Panel - Fixed on the left, full height */}
      <div className="h-full flex-shrink-0 bg-white border-r border-gray-200 z-20">
        <SidebarPanel
          members={members}
          onAddNewMember={handleAddNodeToCanvas}
          onAddMemberToCanvas={handleAddMemberToCanvas}
          onSelectMember={handleSelectMember}
          canAddMember={!!tree}
          isVisible={sidebarVisible}
          onToggle={() => setSidebarVisible(!sidebarVisible)}
          modalOpen={memberModalOpen}
        />
      </div>
      
      {/* Canvas Area - Takes remaining space */}
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        {/* Canvas Header */}
        <div 
          className="h-14 bg-white border-b border-gray-200 flex items-center justify-center gap-4 shadow-sm px-4 shrink-0 z-10"
          onClick={() => {
            // Hide sidebar on click (mobile-friendly auto-hide)
            if (window.innerWidth < 1024) {
              setSidebarVisible(false);
            }
          }}
        >
          <button
            onClick={handleAddNodeToCanvas}
            disabled={!tree}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg shadow font-medium text-sm transition-all"
            title="Add a new node to the canvas"
          >
            + Add Node
          </button>
          <div className="text-center flex-1">
            <h1 className="text-lg font-semibold text-gray-800">{tree.title || 'Untitled Tree'}</h1>
            <p className="text-xs text-gray-500">Tree ID: {tree.id}</p>
          </div>
          <button
            onClick={handleExportPng}
            disabled={!tree || !nodes || nodes.length === 0}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white rounded-lg shadow font-medium text-sm transition-all"
            title="Export the tree as PNG"
          >
            Export PNG
          </button>
        </div>

        {/* Canvas Area - Takes remaining height */}
        <div 
          className="flex-1"
          onClick={() => {
            // Hide sidebar on click (mobile-friendly auto-hide)
            if (window.innerWidth < 1024) {
              setSidebarVisible(false);
            }
          }}
        >
          {/** Include a temporary preview edge when the relationship picker is open */}
          <TreeBoard
            nodes={nodes}
            edges={previewEdge ? [...edges, previewEdge] : edges}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onDropMember={handleDropMember}
            exportRef={exportRef}
            onExport={handleExportPng}
          />
        </div>
      </div>
      
      <MemberModal
        open={memberModalOpen}
        member={editingMember}
        allMembers={members}
        onSave={handleSaveMember}
        onClose={handleCloseMemberModal}
        canSave
        onMoveToPool={handleMoveMemberToPool}
        onDelete={handleDeleteMember}
      />
      <RelationshipPicker
        open={relPicker.open}
        fromName={displayMemberName(members.find(m => m.id === relPicker.source))}
        toName={displayMemberName(members.find(m => m.id === relPicker.target))}
        onCancel={handleCancelRelationship}
        onConfirm={handleConfirmRelationship}
        onTypePreview={handleTypePreview}
      />
      <RelationshipPicker
        open={editPicker.open}
        fromName=""
        toName=""
        mode="edit"
        initialType={editPicker.type}
        initialLabel={editPicker.label}
        title="Edit relationship"
        confirmText="Save"
        onCancel={handleCancelEditRelationship}
        onConfirm={handleConfirmEditRelationship}
        onDelete={handleDeleteRelationship}
      />
    </div>
  );
}
