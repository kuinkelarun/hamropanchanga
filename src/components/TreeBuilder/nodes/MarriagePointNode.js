import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

// Virtual connector node for multi-parent (family unit) connections.
// Appears as a small circle between parents, connecting down to children.
export default function MarriagePointNode({ data, selected }) {
  const [hovering, setHovering] = useState(false);
  const { label, verified } = data || {};

  return (
    <div
      style={{
        position: 'relative',
        width: 20,
        height: 20,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        style={{
          background: '#94a3b8',
          border: '2px solid white',
          width: 8,
          height: 8,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        style={{
          background: '#94a3b8',
          border: '2px solid white',
          width: 8,
          height: 8,
        }}
      />

      {/* Marriage point indicator */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: verified ? '#10b981' : '#94a3b8',
          border: `2px solid ${selected ? '#f59e0b' : 'white'}`,
          boxShadow: selected
            ? '0 0 0 3px rgba(245, 158, 11, 0.3)'
            : '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          cursor: 'grab',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ opacity: 0.8 }}>{label || '⚭'}</span>
      </div>

      {hovering && false && (
        <div
          style={{
            position: 'absolute',
            top: -26,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(17,24,39,0.82)',
            color: '#f1f5f9',
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 6px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            letterSpacing: '0.3px',
            zIndex: 30,
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          double click to update
        </div>
      )}
    </div>
  );
}
