import React, { useEffect } from 'react';
import ReactFlow, { Background, useNodesState, useEdgesState, ReactFlowProvider, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import FamilyNode from './nodes/FamilyNode';
import MarriagePointNode from './nodes/MarriagePointNode';
import FamilyEdge from './edges/FamilyEdge';

// Color mapping for different relationship types
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

// Define node and edge types outside component to prevent recreation
const nodeTypes = { familyNode: FamilyNode, marriagePoint: MarriagePointNode };
const edgeTypes = { familyEdge: FamilyEdge };

// Inner component that has access to ReactFlow instance
function TreePreviewInner({ treeId, members, relationships, marriagePoints, onClick }) {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!members || members.length === 0) {
      console.log('TreePreview: No members to display');
      return;
    }
    
    // Filter to only show members with positions (on canvas)
    const positionedMembers = members.filter(m => m.position && m.position.x !== undefined && m.position.y !== undefined);
    
    console.log('TreePreview: Building nodes from positioned members:', positionedMembers);
    console.log('TreePreview: Relationships:', relationships);
    console.log('TreePreview: Marriage points:', marriagePoints);
    
    if (positionedMembers.length === 0) {
      console.log('TreePreview: No positioned members to display');
      setNodes([]);
      setEdges([]);
      return;
    }
    
    // Create a position map for positioned members
    const posById = new Map();
    positionedMembers.forEach(m => {
      posById.set(String(m.id), m.position);
    });
    
    // Build nodes from positioned members only
    const memberNodes = positionedMembers.map(m => ({
      id: String(m.id),
      type: 'familyNode',
      position: m.position,
      data: {
        label: m.name || 'Unknown',
        gender: m.gender,
        archived: m.archived,
        connected: true,
        details: m
      },
      draggable: false,
      selectable: false,
    }));

    // Filter and build marriage point nodes - only from those with positions
    const positionedMarriagePoints = (marriagePoints || [])
      .filter(mp => mp.position && mp.position.x !== undefined && mp.position.y !== undefined);
    
    const mpNodes = positionedMarriagePoints.map(mp => ({
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

    const allNodes = [...memberNodes, ...mpNodes];
    const nodeIds = new Set(allNodes.map(n => n.id));
    
    // Track which parent-child pairs are handled via marriage points (to avoid duplicates)
    const processedPairs = new Set();
    
    // Track parent-child pairs to avoid showing both parent and child edges
    const parentChildPairs = new Set(); // 'parentId|childId' - only store in parent->child direction
    
    // Detect parent pairs and their children through relationships
    const parentChildMap = new Map(); // key: 'parent1|parent2' -> Set of childIds
    
    if (Array.isArray(relationships)) {
      // Build adjacency for parent-child relationships
      const adjacency = new Map(); // memberId -> Set(connectedMemberId)
      const relationsMap = new Map(); // 'a|b' -> { type, rels: [] }
      
      for (const rel of relationships) {
        if (rel.type === 'parent' || rel.type === 'child') {
          const a = String(rel.fromMemberId || '');
          const b = String(rel.toMemberId || '');
          if (!a || !b) continue;
          
          if (!adjacency.has(a)) adjacency.set(a, new Set());
          if (!adjacency.has(b)) adjacency.set(b, new Set());
          adjacency.get(a).add(b);
          adjacency.get(b).add(a);
          
          // Track the relationship in sorted key order
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (!relationsMap.has(key)) {
            relationsMap.set(key, { types: new Set(), rels: [] });
          }
          relationsMap.get(key).types.add(rel.type);
          relationsMap.get(key).rels.push({ type: rel.type, rel });
        }
      }
      
      // For each parent-child pair, only show one direction (parent->child)
      relationsMap.forEach(({ types, rels }, key) => {
        if (types.has('parent') || types.has('child')) {
          // If both directions exist, we'll skip the 'child' type edges
          // and only show 'parent' type edges
          const [idA, idB] = key.split('|');
          
          // Find which is the parent and which is the child
          // Prefer the 'parent' type relation if it exists
          const parentRel = rels.find(r => r.type === 'parent');
          if (parentRel) {
            const parentId = String(parentRel.rel.fromMemberId);
            const childId = String(parentRel.rel.toMemberId);
            parentChildPairs.add(`${parentId}|${childId}`);
          } else {
            // Fallback: use child relation but reverse it
            const childRel = rels.find(r => r.type === 'child');
            if (childRel) {
              const childId = String(childRel.rel.fromMemberId);
              const parentId = String(childRel.rel.toMemberId);
              parentChildPairs.add(`${parentId}|${childId}`);
            }
          }
        }
      });
    }
    
    // Find parent pairs for each child
    if (Array.isArray(relationships)) {
      const adjacency = new Map();
      for (const rel of relationships) {
        if (rel.type === 'parent' || rel.type === 'child') {
          const a = String(rel.fromMemberId || '');
          const b = String(rel.toMemberId || '');
          if (!a || !b) continue;
          
          if (!adjacency.has(a)) adjacency.set(a, new Set());
          if (!adjacency.has(b)) adjacency.set(b, new Set());
          adjacency.get(a).add(b);
          adjacency.get(b).add(a);
        }
      }
      
      adjacency.forEach((neighbors, memberId) => {
        const parents = [...neighbors];
        if (parents.length < 2) return;
        
        for (let i = 0; i < parents.length; i++) {
          for (let j = i + 1; j < parents.length; j++) {
            const a = String(parents[i]);
            const b = String(parents[j]);
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (!parentChildMap.has(key)) {
              parentChildMap.set(key, new Set());
            }
            parentChildMap.get(key).add(String(memberId));
          }
        }
      });
    }
    
    // Mark parent-child relationships that go through marriage points
    positionedMarriagePoints.forEach(mp => {
      if (Array.isArray(mp.parents) && mp.parents.length >= 2) {
        const p1 = String(mp.parents[0]);
        const p2 = String(mp.parents[1]);
        const key = p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
        const children = parentChildMap.get(key);
        
        if (children) {
          children.forEach(childId => {
            processedPairs.add(`${p1}-${childId}`);
            processedPairs.add(`${childId}-${p1}`);
            processedPairs.add(`${p2}-${childId}`);
            processedPairs.add(`${childId}-${p2}`);
          });
        }
      }
    });
    
    // Build edges with proper deduplication
    const edgeMap = new Map();
    
    // Add direct relationship edges (excluding parent-child pairs handled via marriage points)
    if (Array.isArray(relationships)) {
      const seenPairs = new Set(); // Track seen node pairs to avoid showing both directions
      
      // First pass: identify all parent-child pair directions
      const parentChildDirections = new Map(); // 'a|b' -> 'a->b' or 'b->a' (direction of parent edge)
      
      relationships.forEach((rel) => {
        const source = String(rel.fromMemberId || '');
        const target = String(rel.toMemberId || '');
        
        if (!source || !target) return;
        if (rel.type !== 'parent' && rel.type !== 'child') return;
        
        const pairKey = source < target ? `${source}|${target}` : `${target}|${source}`;
        
        // Record parent direction (parent type always shows source->target as parent)
        if (rel.type === 'parent') {
          parentChildDirections.set(pairKey, `${source}->${target}`);
        }
        // Record child direction (child type shows source->target, but means target is parent)
        else if (rel.type === 'child') {
          parentChildDirections.set(pairKey, `${source}->${target}`);
        }
      });
      
      relationships.forEach((rel, idx) => {
        const source = String(rel.fromMemberId || '');
        const target = String(rel.toMemberId || '');
        const relType = rel.type || 'custom';
        
        if (!source || !target) return;
        if (!nodeIds.has(source) || !nodeIds.has(target)) return;
        
        // Skip if this pair is handled via marriage point
        if (processedPairs.has(`${source}-${target}`)) {
          console.log(`TreePreview: Skipping direct edge ${source}-${target} (handled via marriage point)`);
          return;
        }
        
        // Skip if we've already shown this node pair in either direction
        const pairKey = source < target ? `${source}|${target}` : `${target}|${source}`;
        if (seenPairs.has(pairKey)) {
          console.log(`TreePreview: Skipping edge ${source}-${target} (pair already shown in other direction)`);
          return;
        }
        
        // For parent-child relationships, skip if this is NOT the canonical direction
        if (relType === 'parent' || relType === 'child') {
          const canonicalDirection = parentChildDirections.get(pairKey);
          const currentDirection = `${source}->${target}`;
          
          if (canonicalDirection && canonicalDirection !== currentDirection) {
            console.log(`TreePreview: Skipping ${relType} edge ${source}-${target} (reverse of canonical direction ${canonicalDirection})`);
            return;
          }
        }
        
        seenPairs.add(pairKey);
        
        const edgeKey = `${source}-${target}-${relType}`;
        if (edgeMap.has(edgeKey)) return;
        
        const color = getEdgeColor(relType);
        let sourceHandle = 'bottom-source';
        let targetHandle = 'top-target';
        
        // Determine handles based on relationship type
        if (relType === 'parent' || relType === 'child') {
          sourceHandle = relType === 'child' ? 'bottom-source' : 'top-source';
          targetHandle = relType === 'child' ? 'top-target' : 'bottom-target';
        } else if (relType === 'spouse' || relType === 'sibling') {
          // Dynamically determine horizontal handles based on node positions
          const sourceNode = allNodes.find(n => n.id === source);
          const targetNode = allNodes.find(n => n.id === target);
          
          if (sourceNode && targetNode) {
            const sourceX = sourceNode.position?.x || 0;
            const targetX = targetNode.position?.x || 0;
            
            // If target is to the right of source, use right->left
            if (targetX > sourceX) {
              sourceHandle = 'right-source';
              targetHandle = 'left-target';
            } 
            // If target is to the left of source, use left->right
            else if (targetX < sourceX) {
              sourceHandle = 'left-source';
              targetHandle = 'right-target';
            } 
            // If at same X position, default to right->left
            else {
              sourceHandle = 'right-source';
              targetHandle = 'left-target';
            }
          }
        }
        
        edgeMap.set(edgeKey, {
          id: rel.id || `rel-${idx}`,
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
    
    // Add marriage point edges
    positionedMarriagePoints.forEach(mp => {
      const mpId = String(mp.id);
      if (!nodeIds.has(mpId)) return;
      
      // Connect parents to marriage point
      if (Array.isArray(mp.parents)) {
        mp.parents.forEach((parentId, idx) => {
          const parentStr = String(parentId);
          if (!nodeIds.has(parentStr)) return;
          
          const edgeKey = `${parentStr}-${mpId}-parent-connector`;
          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, {
              id: `e-parent-${mpId}-${idx}`,
              source: parentStr,
              target: mpId,
              sourceHandle: 'bottom-source',
              targetHandle: 'top-target',
              type: 'familyEdge',
              data: { type: 'parent-connector', virtual: false, renderStyle: 'orthogonal' },
              animated: false,
              selectable: false,
            });
          }
        });
      }
      
      // Find and connect children through relationships
      // A node should only be a child of the marriage point if it's connected to BOTH parents
      const childrenSet = new Set();
      if (Array.isArray(relationships) && mp.parents && mp.parents.length >= 2) {
        const p1 = String(mp.parents[0]);
        const p2 = String(mp.parents[1]);
        
        // Build a map of which nodes connect to each parent
        const connectedToP1 = new Set(); // nodes connected to p1
        const connectedToP2 = new Set(); // nodes connected to p2
        
        for (const rel of relationships) {
          if (rel.type !== 'parent' && rel.type !== 'child') continue;
          
          const from = String(rel.fromMemberId || '');
          const to = String(rel.toMemberId || '');
          
          if (!from || !to) continue;
          
          // Check connections to p1
          if (from === p1 && to !== p1 && to !== p2) {
            connectedToP1.add(to);
          } else if (to === p1 && from !== p1 && from !== p2) {
            connectedToP1.add(from);
          }
          
          // Check connections to p2
          if (from === p2 && to !== p1 && to !== p2) {
            connectedToP2.add(to);
          } else if (to === p2 && from !== p1 && from !== p2) {
            connectedToP2.add(from);
          }
        }
        
        // Only add nodes that are connected to BOTH parents as children
        connectedToP1.forEach(nodeId => {
          if (connectedToP2.has(nodeId)) {
            childrenSet.add(nodeId);
          }
        });
      }
      
      // Create edges from marriage point to children
      childrenSet.forEach((childId, idx) => {
        if (!nodeIds.has(childId)) return;
        
        const edgeKey = `${mpId}-${childId}-child`;
        if (!edgeMap.has(edgeKey)) {
          const color = getEdgeColor('child');
          edgeMap.set(edgeKey, {
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
        }
      });
    });
    
    const allEdges = Array.from(edgeMap.values());
    
    console.log('TreePreview: Total nodes created:', allNodes.length);
    console.log('TreePreview: Member nodes:', memberNodes.length);
    console.log('TreePreview: Marriage point nodes:', mpNodes.length);
    console.log('TreePreview: Total edges:', allEdges.length);
    console.log('TreePreview: Processed pairs (to skip):', processedPairs);
    console.log('TreePreview: Nodes:', allNodes);
    console.log('TreePreview: Edges:', allEdges);

    setNodes(allNodes);
    setEdges(allEdges);

    // Center the view after a brief delay
    setTimeout(() => {
      try {
        fitView({ padding: 0.2, duration: 300 });
        console.log('TreePreview: fitView called');
      } catch (err) {
        console.error('TreePreview: fitView error:', err);
      }
    }, 200);
  }, [members, relationships, marriagePoints, setNodes, setEdges, fitView]);

  return (
    <div 
      className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all group overflow-hidden"
      style={{ aspectRatio: '4/3', minHeight: '300px', width: '100%' }}
    >
      {nodes.length === 0 ? (
        <div 
          onClick={onClick}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
        >
          <svg className="w-16 h-16 text-gray-400 group-hover:text-blue-500 transition-colors mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">
            No members yet
          </p>
          <p className="text-xs text-gray-500 mt-1">Click to start building</p>
        </div>
      ) : (
        <>
          <div onDoubleClick={onClick} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              panOnDrag={true}
              zoomOnScroll={true}
              zoomOnPinch={true}
              zoomOnDoubleClick={false}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              preventScrolling={false}
              minZoom={0.5}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e5e7eb" gap={16} size={1} />
            </ReactFlow>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/10 to-transparent" />
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-blue-600/90 text-white text-xs rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Double-click to edit
          </div>
        </>
      )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export default function TreePreview({ treeId, members, relationships, marriagePoints, onClick }) {
  return (
    <ReactFlowProvider>
      <TreePreviewInner
        treeId={treeId}
        members={members}
        relationships={relationships}
        marriagePoints={marriagePoints}
        onClick={onClick}
      />
    </ReactFlowProvider>
  );
}
