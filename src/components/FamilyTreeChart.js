import React, { useState, useEffect, useRef } from 'react';
import EventMenu from './EventMenu';

// --- Family Tree Chart Component ---
const FamilyTreeChart = ({ familyMembers, onEdit, onDeleteRequest }) => {
    const [openMenuId, setOpenMenuId] = useState(null);
    const containerRef = useRef(null);
    const boxRefs = useRef({}); // map id -> DOM element
    const [connectors, setConnectors] = useState([]);

    const handleToggle = (id) => {
        setOpenMenuId(prev => (prev === id ? null : id));
    };

    const handleClose = (id) => {
        setOpenMenuId(prev => (prev === id ? null : prev));
    };


    const membersByGeneration = {};
    Object.values(familyMembers).forEach(member => {
        const gen = member.generation || 0;
        if (!membersByGeneration[gen]) {
            membersByGeneration[gen] = [];
        }
        membersByGeneration[gen].push(member);
    });

    const sortedGenerations = Object.keys(membersByGeneration)
        .map(Number)
        .sort((a, b) => b - a);

    // compute connectors after render
    useEffect(() => {
        function compute() {
            const container = containerRef.current;
            if (!container) return;
            const cRect = container.getBoundingClientRect();
            const lines = [];

            Object.values(familyMembers || {}).forEach(member => {
                const childEl = boxRefs.current[member.id];
                if (!member.parentIds || member.parentIds.length === 0) return;
                if (!childEl) return;
                const childRect = childEl.getBoundingClientRect();
                const childX = childRect.left - cRect.left + childRect.width / 2;
                const childY = childRect.top - cRect.top; // top of child box

                member.parentIds.forEach(pid => {
                    const parentEl = boxRefs.current[pid];
                    if (!parentEl) return;
                    const pRect = parentEl.getBoundingClientRect();
                    const parentX = pRect.left - cRect.left + pRect.width / 2;
                    const parentY = pRect.top - cRect.top + pRect.height; // bottom of parent box

                    // Build a smooth cubic Bezier path from parent's bottom to child's top.
                    // We choose control points vertically offset based on the distance so curves
                    // look natural; this is similar to ER diagram connectors.
                    const dx = childX - parentX;
                    const dy = childY - parentY;
                    const curvature = Math.min(0.5, Math.abs(dy) / 200); // tuneable
                    const controlOffsetY = Math.max(20, Math.abs(dy) * curvature);

                    const c1x = parentX;
                    const c1y = parentY + controlOffsetY;
                    const c2x = childX;
                    const c2y = childY - controlOffsetY;

                    const d = `M ${parentX} ${parentY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${childX} ${childY}`;

                    lines.push({ x1: parentX, y1: parentY, x2: childX, y2: childY, d, id: `${pid}->${member.id}` });
                });
            });

            setConnectors(lines);
        }

        // compute on next frame to ensure layout is settled
        const raf = requestAnimationFrame(compute);
        const onResize = () => requestAnimationFrame(compute);
        window.addEventListener('resize', onResize);
        return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
    }, [familyMembers]);

    if (!familyMembers || Object.keys(familyMembers).length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                No family members added yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto" ref={containerRef} style={{ position: 'relative' }}>
            {/* SVG overlay for connectors */}
            <svg
                aria-hidden
                style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
            >
                {connectors.map(line => (
                    <path
                        key={line.id}
                        d={line.d}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: 'd 200ms ease' }}
                    />
                ))}
            </svg>

            <div className="min-w-full space-y-8 p-4">
                {sortedGenerations.map(generation => (
                    <div key={generation} className="flex flex-col items-center">
                        <div className="text-xs text-gray-500 mb-2 font-semibold">
                            {getGenerationLabel(generation)}
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                            {membersByGeneration[generation].map(member => {
                                const id = member.id;
                                return (
                                    <div
                                        key={id}
                                        ref={(el) => { boxRefs.current[id] = el; }}
                                        className={`relative pr-10 pl-3 py-3 rounded-xl shadow-md border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer min-w-32 text-center max-w-xs break-words flex flex-col items-center justify-center
                                            ${member.isDirectAncestor ? 'bg-white' : 'bg-gray-100'}`}
                                    >
                                        <div className="absolute right-2 top-2 z-20">
                                            <EventMenu
                                                event={member}
                                                isOpen={openMenuId === id}
                                                onToggle={handleToggle}
                                                onClose={handleClose}
                                                onEdit={onEdit}
                                                onDeleteRequest={(m) => onDeleteRequest && onDeleteRequest(m)}
                                                showDelete={member.relation === 'Self' ? false : true}
                                            />
                                        </div>
                                        <div className="font-semibold text-gray-800 text-sm truncate w-full px-2">{member.name}</div>
                                        <div className="text-xs text-gray-500 truncate w-full px-2">({member.relation})</div>
                                    </div>
                                );
                            })}
                        </div>
                        {generation > sortedGenerations[sortedGenerations.length - 1] && (
                            <div className="w-0.5 h-6 bg-gray-300 mt-4"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Helper function to get generation label
const getGenerationLabel = (generation) => {
  const labels = {
    5: 'Great Great Great Grandparents',
    4: 'Great Great Grandparents',
    3: 'Great Grandparents',
    2: 'Grandparents',
    1: 'Parents / Aunts & Uncles',
    0: 'Self / Spouse / Siblings',
    '-1': 'Children',
    '-2': 'Grandchildren'
  };
  return labels[generation] || `Generation ${generation}`;
};


export default FamilyTreeChart;