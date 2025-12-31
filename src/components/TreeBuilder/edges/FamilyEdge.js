import React, { useMemo, useState } from 'react';
import { getBezierPath, getSmoothStepPath, BaseEdge, EdgeLabelRenderer } from 'reactflow';

// Custom edge component mirroring the standalone FamilyEdge behavior.
// Handles parent-child, spouse, sibling, and virtual connector edges with
// different styles and paths.
export default function FamilyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data = {},
  label: topLabel = '',
  markerEnd,
  selected,
}) {
  const [hovering, setHovering] = useState(false);
  const { type, label: dataLabel, virtual, renderStyle, fromMarriagePoint, bundleMember } = data;

  // Respect bundleMember flag (visual-only) which indicates this edge should hide its label.
  // Choose label from data first (preferred), fall back to the top-level edge label prop,
  // then to the type for non-custom relationships.
  const effectiveLabel = useMemo(() => {
    if (bundleMember) return '';
    // Suppress label on parent-connector edges
    if (type === 'parent-connector') return '';
    if (typeof dataLabel === 'string' && dataLabel.length) return dataLabel;
    if (typeof topLabel === 'string' && topLabel.length) return topLabel;
    if (type && type !== 'custom') return type;
    return '';
  }, [bundleMember, dataLabel, topLabel, type]);

  // Choose rendering strategy based on edge type
  let edgePath, labelX, labelY;

  if (renderStyle === 'orthogonal') {
    // Right-angle connector for virtual marriage points
    [edgePath, labelX, labelY] = getOrthogonalPath(sourceX, sourceY, targetX, targetY);
  } else {
    // Default smooth step for other connections
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }

  // Dynamic styling based on edge type
  const edgeColor = getEdgeColor(type);
  const edgeWidth = type === 'spouse' ? 3 : 2;

  const edgeStyle = {
    ...style,
    stroke: selected ? '#f59e0b' : edgeColor,
    strokeWidth: selected ? edgeWidth + 1 : edgeWidth,
    strokeDasharray: virtual ? '5,5' : 'none',
    opacity: virtual ? 0.4 : 1,
  };

  // markerEnd from ReactFlow is already a string URL (e.g., "url(#react-flow__arrowclosed)")
  // We pass it directly to BaseEdge. For selected state color change, we rely on style.

  // Determine whether to show the hover tooltip: suppress for parent edge from parent to marriage point (not allowed)
  const showHoverHint = useMemo(() => {
    if (virtual) return false;
    if (type === 'parent-connector') return false;
    if (type === 'parent' && !fromMarriagePoint) return false;
    return true;
  }, [virtual, type, fromMarriagePoint]);

  return (
    <g onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} interactionWidth={16} />
      {effectiveLabel && !virtual && (
        <EdgeLabel x={labelX} y={labelY} label={effectiveLabel} color={edgeColor} selected={selected} />
      )}
      {hovering && showHoverHint && <EdgeHoverHint x={labelX} y={labelY - 14} />}
    </g>
  );
}

// Orthogonal path with two 90-degree turns (used for marriage point connectors)
function getOrthogonalPath(sx, sy, tx, ty) {
  const midY = (sy + ty) / 2;
  const path = `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
  const labelX = (sx + tx) / 2;
  const labelY = midY;
  return [path, labelX, labelY];
}

// Straight line path (used for spouse connections)
function getStraightPath(sx, sy, tx, ty) {
  const path = `M ${sx},${sy} L ${tx},${ty}`;
  const labelX = (sx + tx) / 2;
  const labelY = (sy + ty) / 2;
  return [path, labelX, labelY];
}

// Get color based on relationship type
function getEdgeColor(type) {
  const colors = {
    parent: '#f97316',
    child: '#f97316',
    spouse: '#ec4899',
    sibling: '#10b981',
    custom: '#8b5cf6',
    // Use child/parent color for connectors to match child edges
    'parent-connector': '#f97316',
  };
  return colors[type] || colors.custom;
}

// Edge label component with background
function EdgeLabel({ x, y, label, color, selected }) {
  const labelPadding = 6;
  const fontSize = 11;

  const textWidth = label.length * (fontSize * 0.6);
  const rectWidth = textWidth + labelPadding * 2;
  const rectHeight = 18;

  return (
    <g transform={`translate(${x - rectWidth / 2}, ${y - rectHeight / 2})`}>
      <rect
        x={0}
        y={0}
        width={rectWidth}
        height={rectHeight}
        rx={4}
        fill="white"
        stroke={selected ? '#f59e0b' : color}
        strokeWidth={selected ? 2 : 1}
        opacity={0.95}
      />
      <text
        x={rectWidth / 2}
        y={rectHeight / 2 + 4}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={600}
        fill="#111827"
      >
        {label}
      </text>
    </g>
  );
}

function EdgeHoverHint({ x, y }) {
  const label = 'double click to update';
  const fontSize = 10;
  const paddingX = 6;
  const paddingY = 3;
  const width = label.length * (fontSize * 0.6) + paddingX * 2;
  const height = fontSize + paddingY * 2 + 2;
  return (
    <g transform={`translate(${x - width / 2}, ${y - height / 2})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={6}
        fill="rgba(17,24,39,0.86)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={height / 2 + 3}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={600}
        fill="#f1f5f9"
      >
        {label}
      </text>
    </g>
  );
}
