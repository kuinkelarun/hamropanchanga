/**
 * Single source of truth for building tree graph data (nodes and edges)
 * Used by both canvas and preview to ensure they display identically
 */

const RELATIONSHIP_COLORS = {
  parent: '#f97316',
  child: '#f97316',
  spouse: '#ec4899',
  sibling: '#10b981',
  custom: '#8b5cf6',
};

function hasPosVal(pos) {
  return pos && typeof pos.x === 'number' && typeof pos.y === 'number';
}

function normalizeParentChildOptionA({ fromMemberId, toMemberId, type, parentId, childId }) {
  // Option A (revised):
  // - UI/graph edge direction is always user-directed: fromMemberId -> toMemberId
  // - canonical hierarchy is stored separately as parentId -> childId
  const t = String(type || '').toLowerCase();
  const from = String(fromMemberId || '');
  const to = String(toMemberId || '');

  const existingParentId = String(parentId || '').trim();
  const existingChildId = String(childId || '').trim();
  if (existingParentId && existingChildId) {
    return { fromMemberId: from, toMemberId: to, type: t, parentId: existingParentId, childId: existingChildId };
  }

  if (!from || !to) {
    return { fromMemberId: from, toMemberId: to, type: t, parentId: existingParentId, childId: existingChildId };
  }

  if (t === 'parent') {
    // from is parent of to
    return { fromMemberId: from, toMemberId: to, type: 'parent', parentId: from, childId: to };
  }
  if (t === 'child') {
    // from is child of to
    return { fromMemberId: from, toMemberId: to, type: 'child', parentId: to, childId: from };
  }
  return { fromMemberId: from, toMemberId: to, type: t, parentId: existingParentId, childId: existingChildId };
}

function getEdgeColor(type) {
  return RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.custom;
}

/**
 * Find children that are connected to both parents
 */
// eslint-disable-next-line no-unused-vars
function getChildrenOfBothParents(p1, p2, relationships) {
  if (!p1 || !p2 || !Array.isArray(relationships)) return new Set();
  
  const connectedToP1 = new Set();
  const connectedToP2 = new Set();
  
  for (const rel of relationships) {
    if (rel.type !== 'parent' && rel.type !== 'child') continue;
    
    const from = String(rel.fromMemberId || '');
    const to = String(rel.toMemberId || '');
    
    if (!from || !to) continue;
    
    if (from === p1 && to !== p1 && to !== p2) {
      connectedToP1.add(to);
    } else if (to === p1 && from !== p1 && from !== p2) {
      connectedToP1.add(from);
    }
    
    if (from === p2 && to !== p1 && to !== p2) {
      connectedToP2.add(to);
    } else if (to === p2 && from !== p1 && from !== p2) {
      connectedToP2.add(from);
    }
  }
  
  const children = new Set();
  connectedToP1.forEach(nodeId => {
    if (connectedToP2.has(nodeId)) {
      children.add(nodeId);
    }
  });
  
  return children;
}

/**
 * Build tree graph data (nodes and edges) from members, relationships, and marriage points
 * This is the single source of truth used by both canvas and preview
 * 
 * @param {Array} members - Array of member objects with id, name, position, gender, etc.
 * @param {Array} relationships - Array of relationship objects
 * @param {Array} marriagePoints - Array of marriage point objects
 * @returns {Object} { nodes, edges }
 */
export function buildTreeGraphData(members = [], relationships = [], marriagePoints = []) {
  const nodes = [];
  const edges = [];
  
  // Filter to only show members with positions (on canvas)
  const positionedMembers = members.filter(m => m.position && m.position.x !== undefined && m.position.y !== undefined);
  
  if (positionedMembers.length === 0) {
    return { nodes: [], edges: [] };
  }
  
  // Build member nodes from positioned members only
  const memberNodes = positionedMembers.map(m => ({
    id: String(m.id),
    type: 'familyNode',
    position: m.position,
    data: {
      label: m.name || 'Unknown',
      gender: m.gender,
      archived: m.archived,
      connected: false,
    },
    draggable: false,
    selectable: false,
  }));

  nodes.push(...memberNodes);

  const nodeIds = new Set(nodes.map(n => n.id));

  // Reproduce canvas marriage-point derivation:
  // - marriagePoints are used ONLY for saved positions (id: mp-${a|b})
  // - actual marriage point nodes are derived from spouse pairs + shared children
  const posById = new Map();
  positionedMembers.forEach(m => {
    if (hasPosVal(m.position)) {
      posById.set(String(m.id), m.position);
    }
  });

  const savedMpPos = new Map((marriagePoints || [])
    .map(mp => [String(mp.id), mp.position])
    .filter(([, pos]) => hasPosVal(pos))
  );

  const adjacency = new Map(); // memberId -> Set(connectedMemberId) for parent/child relations
  const relByPair = new Map(); // 'a|b' (sorted) -> relationship doc (first seen)
  const spousePairs = new Set(); // 'a|b' (sorted)

  if (Array.isArray(relationships) && relationships.length > 0) {
    for (const r of relationships) {
      const a = String(r.fromMemberId || '');
      const b = String(r.toMemberId || '');
      if (!a || !b) continue;

      if (r.type === 'spouse') {
        const spouseKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        spousePairs.add(spouseKey);
      }

      if (r.type !== 'parent' && r.type !== 'child') continue;
      const normalized = normalizeParentChildOptionA({
        fromMemberId: r.fromMemberId,
        toMemberId: r.toMemberId,
        type: r.type,
        parentId: r.parentId,
        childId: r.childId,
      });
      const parentId = String(normalized.parentId || '');
      const childId = String(normalized.childId || '');
      if (!parentId || !childId) continue;

      if (!adjacency.has(parentId)) adjacency.set(parentId, new Set());
      if (!adjacency.has(childId)) adjacency.set(childId, new Set());
      adjacency.get(parentId).add(childId);
      adjacency.get(childId).add(parentId);

      const key = parentId < childId ? `${parentId}|${childId}` : `${childId}|${parentId}`;
      if (!relByPair.has(key)) {
        relByPair.set(key, r);
      }
    }
  }

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

  const nodesWithMarriage = [...nodes];
  const marriageEdges = [];
  const processedPairs = new Set(); // parent-child directional pairs handled via marriage points

  parentPairs.forEach(({ parents, children }, key) => {
    const [p1Id, p2Id] = parents;
    const commonChildren = [...children];
    if (!commonChildren.length) return;

    // Only create a marriage point when the two parents are spouses
    if (!spousePairs.has(key)) return;

    // Only render when both parents exist as positioned nodes
    if (!nodeIds.has(String(p1Id)) || !nodeIds.has(String(p2Id))) return;

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
      draggable: false,
      selectable: false,
    });
    nodeIds.add(String(marriagePointId));

    // Parent -> marriage point connector edges (visual only, no arrowheads)
    [p1Id, p2Id].forEach(parentId => {
      marriageEdges.push({
        id: `e-${parentId}-${marriagePointId}`,
        source: parentId,
        target: marriagePointId,
        type: 'familyEdge',
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        data: { type: 'parent-connector', virtual: false },
        animated: false,
        selectable: false,
      });
    });

    // Marriage point -> children edges (single logical parent-child with arrow)
    commonChildren.forEach(childId => {
      if (!nodeIds.has(String(childId))) return;
      const color = getEdgeColor('child');

      const key1 = p1Id < childId ? `${p1Id}|${childId}` : `${childId}|${p1Id}`;
      const key2 = p2Id < childId ? `${p2Id}|${childId}` : `${childId}|${p2Id}`;
      const relForChild = relByPair.get(key1) || relByPair.get(key2) || null;
      const optionalLabel = (relForChild && typeof relForChild.label === 'string') ? relForChild.label : '';
      const labelText = (optionalLabel || 'child');

      marriageEdges.push({
        id: `e-${marriagePointId}-${childId}`,
        source: marriagePointId,
        target: String(childId),
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        type: 'familyEdge',
        data: { type: 'child', label: optionalLabel, fromMarriagePoint: true, relationshipId: relForChild ? relForChild.id : undefined },
        label: labelText,
        animated: false,
        selectable: false,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color },
      });

      processedPairs.add(`${p1Id}-${childId}`);
      processedPairs.add(`${childId}-${p1Id}`);
      processedPairs.add(`${p2Id}-${childId}`);
      processedPairs.add(`${childId}-${p2Id}`);
    });
  });
  
  // Track processed node pairs to avoid duplicate edges
  // Use Map to store edge metadata for intelligent deduplication (matches canvas preview behavior)
  const pairMap = new Map();
  
  // Add direct relationship edges
  if (Array.isArray(relationships)) {
    relationships.forEach((rel) => {
      const source = String(rel.fromMemberId || '');
      const target = String(rel.toMemberId || '');
      
      if (!source || !target) return;
      if (!nodeIds.has(source) || !nodeIds.has(target)) return;
      
      // Skip if this pair is handled via marriage point
      if (processedPairs.has(`${source}-${target}`)) return;
      
      const relType = rel.type || 'custom';
      
      // Deduplicate by sorted pair (same as canvas) so we don't render multiple edges between the same two nodes.
      const pairKey = source < target ? `${source}|${target}` : `${target}|${source}`;
      
      const color = getEdgeColor(relType);
      
      let sourceHandle = 'bottom-source';
      let targetHandle = 'top-target';
      
      // Determine handles based on relationship type
      if (relType === 'parent' || relType === 'child') {
        sourceHandle = relType === 'child' ? 'bottom-source' : 'top-source';
        targetHandle = relType === 'child' ? 'top-target' : 'bottom-target';
      } else if (relType === 'spouse' || relType === 'sibling') {
        // Dynamically determine horizontal handles based on node positions
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);
        
        if (sourceNode && targetNode) {
          const sourceX = sourceNode.position?.x || 0;
          const targetX = targetNode.position?.x || 0;
          
          if (targetX > sourceX) {
            sourceHandle = 'right-source';
            targetHandle = 'left-target';
          } else if (targetX < sourceX) {
            sourceHandle = 'left-source';
            targetHandle = 'right-target';
          } else {
            sourceHandle = 'right-source';
            targetHandle = 'left-target';
          }
        }
      }
      
      const candidate = {
        id: `${source}-${target}-${relType}-${rel.id || 'noid'}`,
        source: source,
        target: target,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: 'familyEdge',
        data: {
          type: relType,
          label: rel.label || relType,
          relationshipId: rel.id,
        },
        label: rel.label || relType,
        animated: false,
        selectable: false,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color },
      };
      
      const current = pairMap.get(pairKey);
      const hasLabel = !!rel.label;
      
      if (!current) {
        // First edge for this pair
        pairMap.set(pairKey, { edge: candidate, hasLabel, type: relType });
      } else {
        // Decide which edge to keep based on preference:
        // 1. Custom label beats default label
        // 2. For parent/child: keep the one that respects visual hierarchy
        let preferThis = false;
        
        if (relType === 'parent' || relType === 'child') {
          // For parent/child, prefer the one with custom label, or keep existing
          if (hasLabel && !current.hasLabel) preferThis = true;
          else preferThis = false;
        } else if (relType === 'sibling' || relType === 'spouse') {
          // For sibling/spouse, prefer custom labels
          if (hasLabel && !current.hasLabel) preferThis = true;
          else if (!hasLabel && current.hasLabel) preferThis = false;
          else preferThis = false; // Keep existing if both have or don't have labels
        } else {
          // For custom relationships, prefer custom labels
          preferThis = hasLabel && !current.hasLabel;
        }
        
        if (preferThis) {
          pairMap.set(pairKey, { edge: candidate, hasLabel, type: relType });
        }
      }
    });
  }
  
  // Add all edges from pairMap
  pairMap.forEach((value) => {
    edges.push(value.edge);
  });

  // Prepend marriage-derived nodes/edges so preview matches canvas
  const allEdges = [...marriageEdges, ...edges];

  // Mark nodes as connected if they appear in any edge (source or target)
  const connectedSet = new Set();
  for (const e of allEdges) {
    if (e && e.source) connectedSet.add(String(e.source));
    if (e && e.target) connectedSet.add(String(e.target));
  }

  const finalNodes = nodesWithMarriage.map(n => ({
    ...n,
    data: {
      ...(n.data || {}),
      connected: connectedSet.has(String(n.id)),
    },
  }));

  return { nodes: finalNodes, edges: allEdges };
}
