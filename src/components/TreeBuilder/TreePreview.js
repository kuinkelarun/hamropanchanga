import React, { useEffect } from 'react';
import ReactFlow, { Background, useNodesState, useEdgesState, ReactFlowProvider, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import FamilyNode from './nodes/FamilyNode';
import MarriagePointNode from './nodes/MarriagePointNode';
import FamilyEdge from './edges/FamilyEdge';
import { buildTreeGraphData } from './utils/buildTreeGraphData';

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
      setNodes([]);
      setEdges([]);
      return;
    }
    
    // Use shared utility to build graph data (single source of truth)
    const { nodes: graphNodes, edges: graphEdges } = buildTreeGraphData(
      members,
      relationships,
      marriagePoints
    );

    setNodes(graphNodes);
    setEdges(graphEdges);

    // Center the view after a brief delay
    setTimeout(() => {
      try {
        fitView({ padding: 0.2, duration: 300 });
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
