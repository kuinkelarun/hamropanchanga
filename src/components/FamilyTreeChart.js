import React, { useState } from 'react';
import EventMenu from './EventMenu';

// --- Family Tree Chart Component ---
const FamilyTreeChart = ({ familyMembers, onEdit, onDeleteRequest }) => {
    const [openMenuId, setOpenMenuId] = useState(null);

    const handleToggle = (id) => {
        setOpenMenuId(prev => (prev === id ? null : id));
    };

    const handleClose = (id) => {
        setOpenMenuId(prev => (prev === id ? null : prev));
    };

    if (!familyMembers || Object.keys(familyMembers).length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                No family members added yet.
            </div>
        );
    }

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


    return (
        <div className="overflow-x-auto">
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