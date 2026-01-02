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

function getEdgeColor(type) {
  return RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.custom;
}

/**
 * Find children that are connected to both parents
 */
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
      connected: true,
    },
    draggable: false,
    selectable: false,
  }));
  
  // Build marriage point nodes - only from those with positions
  const mpNodes = (marriagePoints || [])
    .filter(mp => mp.position && mp.position.x !== undefined && mp.position.y !== undefined)
    .map(mp => ({
      id: String(mp.id),
      type: 'marriagePoint',
      position: mp.position,
      data: { 
        label: '',
        spouses: mp.spouses || [],
        parents: mp.parents || []
      },
      draggable: false,
      selectable: false,
    }));

  nodes.push(...memberNodes, ...mpNodes);
  
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // Mark parent-child relationships that go through marriage points
  const processedPairs = new Set();
  (marriagePoints || []).forEach(mp => {
    if (Array.isArray(mp.parents) && mp.parents.length >= 2) {
      const p1 = String(mp.parents[0]);
      const p2 = String(mp.parents[1]);
      
      const children = getChildrenOfBothParents(p1, p2, relationships);
      children.forEach(childId => {
        processedPairs.add(`${p1}-${childId}`);
        processedPairs.add(`${childId}-${p1}`);
        processedPairs.add(`${p2}-${childId}`);
        processedPairs.add(`${childId}-${p2}`);
      });
    }
  });
  
  // Track processed node pairs to avoid duplicate edges
  const seenPairs = new Set();
  
  // Add direct relationship edges
  if (Array.isArray(relationships)) {
    relationships.forEach((rel) => {
      const source = String(rel.fromMemberId || '');
      const target = String(rel.toMemberId || '');
      
      if (!source || !target) return;
      if (!nodeIds.has(source) || !nodeIds.has(target)) return;
      
      // Skip if this pair is handled via marriage point
      if (processedPairs.has(`${source}-${target}`)) return;
      
      // Skip if we've already shown this node pair
      const pairKey = source < target ? `${source}|${target}` : `${target}|${source}`;
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);
      
      const relType = rel.type || 'custom';
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
      
      edges.push({
        id: rel.id || `rel-${source}-${target}`,
        source: source,
        target: target,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: 'familyEdge',
        data: {
          type: relType,
          label: rel.label || relType,
        },
        label: rel.label || relType,
        animated: false,
        selectable: false,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color },
      });
    });
  }
  
  // Add marriage point edges (parent connectors and child edges)
  (marriagePoints || []).forEach(mp => {
    const mpId = String(mp.id);
    if (!nodeIds.has(mpId)) return;
    
    // Connect parents to marriage point
    if (Array.isArray(mp.parents)) {
      mp.parents.forEach((parentId, idx) => {
        const parentStr = String(parentId);
        if (!nodeIds.has(parentStr)) return;
        
        edges.push({
          id: `e-parent-${mpId}-${idx}`,
          source: parentStr,
          target: mpId,
          sourceHandle: 'bottom-source',
          targetHandle: 'top-target',
          type: 'familyEdge',
          data: { type: 'parent-connector', virtual: false },
          animated: false,
          selectable: false,
        });
      });
    }
    
    // Find and connect children through relationships
    // A node should only be a child of the marriage point if it's connected to BOTH parents
    const childrenSet = new Set();
    if (Array.isArray(relationships) && mp.parents && mp.parents.length >= 2) {
      const p1 = String(mp.parents[0]);
      const p2 = String(mp.parents[1]);
      
      childrenSet.forEach(childId => {
        if (!nodeIds.has(childId)) return;
        
        const color = getEdgeColor('child');
        edges.push({
          id: `e-child-${mpId}-${Array.from(childrenSet).indexOf(childId)}`,
          source: mpId,
          target: childId,
          sourceHandle: 'bottom-source',
          targetHandle: 'top-target',
          type: 'familyEdge',
          data: { type: 'child', label: 'child', fromMarriagePoint: true },
          label: 'child',
          animated: false,
          selectable: false,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color },
        });
      });
      
      const children = getChildrenOfBothParents(p1, p2, relationships);
      children.forEach((childId, idx) => {
        if (!nodeIds.has(childId)) return;
        
        const color = getEdgeColor('child');
        edges.push({
          id: `e-child-${mpId}-${idx}`,
          source: mpId,
          target: childId,
          sourceHandle: 'bottom-source',
          targetHandle: 'top-target',
          type: 'familyEdge',
          data: { type: 'child', label: 'child', fromMarriagePoint: true },
          label: 'child',
          animated: false,
          selectable: false,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color },
        });
      });
    }
  });
  
  return { nodes, edges };
}
