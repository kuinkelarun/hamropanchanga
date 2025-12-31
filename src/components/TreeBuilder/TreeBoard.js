import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import FamilyNode from './nodes/FamilyNode';
import MarriagePointNode from './nodes/MarriagePointNode';
import FamilyEdge from './edges/FamilyEdge';

// Alignment/snapping thresholds (in pixels before zoom adjustment)
const SNAP_THRESHOLD = 12;  // Distance at which we actually snap
const GUIDE_THRESHOLD = 18; // Distance at which we show alignment guides

// Initial placeholder data
const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Start Adding Members' }, type: 'familyNode' },
];
const initialEdges = [];

export default function TreeBoard({ 
  nodes: extNodes, 
  edges: extEdges, 
  setNodes: setNodesExt, 
  setEdges: setEdgesExt, 
  onNodeDragStop,
  onConnect: onConnectExt,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onEdgeClick,
  onPaneClick,
  onDropMember, // Callback when a member is dropped from sidebar
  exportRef, // Reference for export functionality
}) {
  // If external state is provided, use it; otherwise use local state
  const controlled = Array.isArray(extNodes) && Array.isArray(extEdges);
  
  const [nodesLocal, setNodesLocal, onNodesChangeLocal] = useNodesState(initialNodes);
  const [edgesLocal, setEdgesLocal, onEdgesChangeLocal] = useEdgesState(initialEdges);

  const connectStartRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  // Alignment guide state (flow-space coordinates)
  const [alignGuides, setAlignGuides] = useState({ x: null, y: null });
  // Track viewport to convert flow-space guide coordinates to screen-space
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const nodes = controlled ? extNodes : nodesLocal;
  const edges = controlled ? extEdges : edgesLocal;
  const setNodes = controlled && setNodesExt ? setNodesExt : setNodesLocal;
  
  // Memoize node and edge types
  const nodeTypes = useMemo(() => ({ familyNode: FamilyNode, marriagePoint: MarriagePointNode }), []);
  const edgeTypes = useMemo(() => ({ familyEdge: FamilyEdge }), []);

  // Handlers
  const onNodesChange = useCallback(
    (changes) => {
      if (controlled && setNodesExt) {
        setNodesExt((nds) => applyNodeChanges(changes, nds));
      } else {
        onNodesChangeLocal(changes);
      }
    },
    [controlled, setNodesExt, onNodesChangeLocal]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      if (controlled && setEdgesExt) {
        setEdgesExt((eds) => applyEdgeChanges(changes, eds));
      } else {
        onEdgesChangeLocal(changes);
      }
    },
    [controlled, setEdgesExt, onEdgesChangeLocal]
  );

  const onConnectStart = useCallback((_, { nodeId, handleId, handleType }) => {
    connectStartRef.current = { nodeId, handleId, handleType };
  }, []);

  const onConnectEnd = useCallback(() => {
    connectStartRef.current = null;
  }, []);

  const normalizeConnection = useCallback((connection) => {
    const start = connectStartRef.current;
    if (!start) return connection;

    const { nodeId: startNodeId } = start;
    const { source, sourceHandle, target, targetHandle } = connection;
    if (!source || !target) return connection;

    if (source === startNodeId) {
      const [sourceSide] = (sourceHandle || '').split('-');
      const [targetSide] = (targetHandle || '').split('-');
      return {
        ...connection,
        source,
        target,
        sourceHandle: `${sourceSide}-source`,
        targetHandle: `${targetSide}-target`,
      };
    }

    if (target === startNodeId) {
      const [sourceSide] = (sourceHandle || '').split('-');
      const [targetSide] = (targetHandle || '').split('-');
      return {
        ...connection,
        source: target,
        target: source,
        sourceHandle: `${targetSide}-source`,
        targetHandle: `${sourceSide}-target`,
      };
    }

    return connection;
  }, []);

  const onConnect = useCallback(
    (rawParams) => {
      const params = normalizeConnection(rawParams);
      if (onConnectExt) {
        onConnectExt(params);
      } else if (!controlled) {
        setEdgesLocal((eds) => addEdge(params, eds));
      }
    },
    [onConnectExt, controlled, setEdgesLocal, normalizeConnection]
  );

  // Node drag start - clear alignment guides
  const onNodeDragStart = useCallback(() => {
    setAlignGuides({ x: null, y: null });
  }, []);

  // Throttle node drag updates via requestAnimationFrame to reduce UI lag
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const processDrag = useCallback(() => {
    const payload = pendingRef.current;
    rafRef.current = null;
    pendingRef.current = null;
    if (!payload) return;
    const { node } = payload;
    try {
      if (!node?.id) return;
      const curId = String(node.id);
      const curPos = node.position || { x: 0, y: 0 };
      let curW = Number.isFinite(node.width) ? node.width : undefined;
      let curH = Number.isFinite(node.height) ? node.height : undefined;

      // Convert pixel thresholds to flow-space thresholds based on current zoom
      const z = Math.max(0.01, viewport?.zoom || 1);
      const snapTh = SNAP_THRESHOLD / z;
      const guideTh = GUIDE_THRESHOLD / z;

      // Prefer measured nodes from React Flow instance
      const rfNodes = (rfInstance && typeof rfInstance.getNodes === 'function') ? rfInstance.getNodes() : nodes;
      const others = (rfNodes || []).filter((n) => String(n.id) !== curId);

      // If current node dimensions are missing, try to read from rfInstance
      if ((curW == null || curH == null) && Array.isArray(rfNodes)) {
        const self = rfNodes.find((n) => String(n.id) === curId);
        if (self) {
          if (curW == null && Number.isFinite(self.width)) curW = self.width;
          if (curH == null && Number.isFinite(self.height)) curH = self.height;
        }
      }

      const anchorsX = [];
      const anchorsY = [];

      // Current node anchor values
      const curLeft = curPos.x;
      const curTop = curPos.y;
      const curCenterX = (curW != null) ? (curLeft + curW / 2) : undefined;
      const curCenterY = (curH != null) ? (curTop + curH / 2) : undefined;
      const curRight = (curW != null) ? (curLeft + curW) : undefined;
      const curBottom = (curH != null) ? (curTop + curH) : undefined;

      // Collect target anchors from other nodes
      others.forEach((n) => {
        const p = n.position || { x: 0, y: 0 };
        const w = Number.isFinite(n.width) ? n.width : undefined;
        const h = Number.isFinite(n.height) ? n.height : undefined;

        // X anchors: left, center, right
        anchorsX.push(p.x);
        if (w != null) {
          anchorsX.push(p.x + w / 2);
          anchorsX.push(p.x + w);
        }

        // Y anchors: top, center, bottom
        anchorsY.push(p.y);
        if (h != null) {
          anchorsY.push(p.y + h / 2);
          anchorsY.push(p.y + h);
        }
      });

      // Find closest X anchor
      let snapX = curLeft;
      let bestDx = Infinity;
      let bestAnchorX = null;
      anchorsX.forEach((ax) => {
        // Try aligning our left -> ax
        const dxLeft = Math.abs(ax - curLeft);
        if (dxLeft < bestDx) {
          bestDx = dxLeft;
          if (dxLeft <= snapTh) snapX = ax;
          bestAnchorX = ax;
        }
        // Try aligning our center -> ax
        if (curCenterX != null && curW != null) {
          const dxCenter = Math.abs(ax - curCenterX);
          if (dxCenter < bestDx) {
            bestDx = dxCenter;
            if (dxCenter <= snapTh) snapX = ax - curW / 2;
            bestAnchorX = ax;
          }
        }
        // Try aligning our right -> ax
        if (curRight != null && curW != null) {
          const dxRight = Math.abs(ax - curRight);
          if (dxRight < bestDx) {
            bestDx = dxRight;
            if (dxRight <= snapTh) snapX = ax - curW;
            bestAnchorX = ax;
          }
        }
      });

      // Find closest Y anchor
      let snapY = curTop;
      let bestDy = Infinity;
      let bestAnchorY = null;
      anchorsY.forEach((ay) => {
        const dyTop = Math.abs(ay - curTop);
        if (dyTop < bestDy) {
          bestDy = dyTop;
          if (dyTop <= snapTh) snapY = ay;
          bestAnchorY = ay;
        }
        if (curCenterY != null && curH != null) {
          const dyCenter = Math.abs(ay - curCenterY);
          if (dyCenter < bestDy) {
            bestDy = dyCenter;
            if (dyCenter <= snapTh) snapY = ay - curH / 2;
            bestAnchorY = ay;
          }
        }
        if (curBottom != null && curH != null) {
          const dyBottom = Math.abs(ay - curBottom);
          if (dyBottom < bestDy) {
            bestDy = dyBottom;
            if (dyBottom <= snapTh) snapY = ay - curH;
            bestAnchorY = ay;
          }
        }
      });

      // Show guides when within guide threshold
      const showXGuide = bestAnchorX != null && bestDx <= guideTh;
      const showYGuide = bestAnchorY != null && bestDy <= guideTh;
      setAlignGuides({ x: showXGuide ? bestAnchorX : null, y: showYGuide ? bestAnchorY : null });

      // Snap when within snap threshold
      const shouldSnapX = bestDx <= snapTh;
      const shouldSnapY = bestDy <= snapTh;
      if (shouldSnapX || shouldSnapY) {
        setNodes((nds) => nds.map((n) => 
          (String(n.id) === curId 
            ? { ...n, position: { x: shouldSnapX ? snapX : curLeft, y: shouldSnapY ? snapY : curTop } } 
            : n)
        ));
      }
    } catch (err) {
      // Fail-safe: ignore snapping if calculation fails
    }
  }, [setNodes, viewport, rfInstance, nodes]);

  const onNodeDrag = useCallback((event, node) => {
    pendingRef.current = { event, node };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(processDrag);
    }
  }, [processDrag]);

  // Node drag stop - clear guides and call external handler
  const onNodeDragStopLocal = useCallback((event, node) => {
    setAlignGuides({ x: null, y: null });
    if (onNodeDragStop) onNodeDragStop(event, node);
  }, [onNodeDragStop]);

  // Drag and drop handlers for sidebar members
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    const memberId = e.dataTransfer.getData('memberId');

    if (type === 'member' && memberId && rfInstance && onDropMember) {
      const reactFlowBounds = e.target.getBoundingClientRect();
      const position = rfInstance.project({
        x: e.clientX - reactFlowBounds.left,
        y: e.clientY - reactFlowBounds.top,
      });
      onDropMember(memberId, position);
    }
  }, [rfInstance, onDropMember]);

  return (
    <div ref={exportRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStopLocal}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick ? (_e, edge) => onEdgeDoubleClick(edge) : undefined}
        onEdgeClick={onEdgeClick ? (_e, edge) => onEdgeClick(edge) : undefined}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        connectionLineType="smoothstep"
        connectionMode="loose"
        onInit={(inst) => {
          setRfInstance(inst);
          try {
            const vp = inst?.getViewport?.();
            if (vp) setViewport(vp);
          } catch {}
        }}
        onMove={(_evt, vp) => { try { if (vp) setViewport(vp); } catch {} }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
      {/* Alignment guides overlay */}
      {(() => {
        const z = viewport?.zoom || 1;
        const vx = viewport?.x || 0;
        const vy = viewport?.y || 0;
        const hasX = alignGuides.x != null;
        const hasY = alignGuides.y != null;
        const vLeft = hasX ? Math.round(vx + (alignGuides.x * z)) : null;
        const hTop = hasY ? Math.round(vy + (alignGuides.y * z)) : null;
        const hasAny = hasX || hasY;

        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: hasAny ? 1 : 0,
              transition: 'opacity 140ms ease-in-out',
              zIndex: 50,
            }}
          >
            {hasX && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: vLeft,
                  width: 1,
                  background: 'rgba(59,130,246,0.45)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {hasY && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: hTop,
                  height: 1,
                  background: 'rgba(59,130,246,0.45)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
