// Helper function to get the generation label
const getGenerationLabel = (generation) => {
    if (generation < 0) return `${Math.abs(generation)} Generations Below`;
    if (generation > 0) return `${generation} Generations Above`;
    return 'Your Generation';
};

// Updated Family Tree Chart Component
const FamilyTreeChart = ({ familyMembers, onEdit }) => {
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
                            {membersByGeneration[generation].map(member => (
                                <div
                                    key={member.id}
                                    className={`p-3 rounded-xl shadow-md border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer min-w-32 text-center
                                        ${member.isDirectAncestor ? 'bg-white' : 'bg-gray-100'}`}
                                    onClick={() => onEdit(member)}
                                >
                                    <div className="font-semibold text-gray-800 text-sm">{member.name}</div>
                                    <div className="text-xs text-gray-500">({member.relation})</div>
                                </div>
                            ))}
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

export default FamilyTreeChart;