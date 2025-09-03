import { useState } from 'react';

// const AddFamilyMemberForm = ({ onAdd, familyMembers }) => {
//     const [name, setName] = useState('');
//     const [relation, setRelation] = useState('');
//     const [selectedParentIds, setSelectedParentIds] = useState([]);

//     const familyMembersArray = Object.values(familyMembers);

//     const handleSubmit = (e) => {
//         e.preventDefault();
//         if (!name.trim() || !relation) return;

//         const newMemberData = {
//             name: name,
//             relation: relation,
//             parentIds: selectedParentIds,
//         };
//         onAdd(newMemberData);
//         setName('');
//         setRelation('');
//         setSelectedParentIds([]);
//     };

//     const directRelations = [
//         'Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt',
//         'Grandfather', 'Grandmother',
//         'Great Grandfather', 'Great Grandmother',
//         'Great Great Grandfather', 'Great Great Grandmother',
//         'Great Great Great Grandfather', 'Great Great Great Grandmother',
//     ];

//     const childRelations = ['Son', 'Daughter'];

//     return (
//         <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
//             <h4 className="text-lg font-bold text-gray-800">Add New Family Member</h4>
//             <form onSubmit={handleSubmit} className="space-y-3">
//                 <div>
//                     <label htmlFor="name" className="block text-gray-700 font-semibold mb-1 text-sm">
//                         Name
//                     </label>
//                     <input
//                         id="name"
//                         type="text"
//                         placeholder="Enter name"
//                         value={name}
//                         onChange={(e) => setName(e.target.value)}
//                         className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
//                         required
//                     />
//                 </div>
//                 <div>
//                     <label htmlFor="relation" className="block text-gray-700 font-semibold mb-1 text-sm">
//                         Relation
//                     </label>
//                     <select
//                         id="relation"
//                         value={relation}
//                         onChange={(e) => setRelation(e.target.value)}
//                         className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
//                         required
//                     >
//                         <option value="" disabled>Select relation...</option>
//                         <optgroup label="Direct Relations">
//                             {directRelations.map(rel => (
//                                 <option key={rel} value={rel}>{rel}</option>
//                             ))}
//                         </optgroup>
//                         <optgroup label="Child">
//                             {childRelations.map(rel => (
//                                 <option key={rel} value={rel}>{rel}</option>
//                             ))}
//                         </optgroup>
//                     </select>
//                 </div>
//                 <div>
//                     <label htmlFor="parents" className="block text-gray-700 font-semibold mb-1 text-sm">
//                         Parents (Optional)
//                     </label>
//                     <select
//                         id="parents"
//                         multiple
//                         value={selectedParentIds}
//                         onChange={(e) => setSelectedParentIds(Array.from(e.target.selectedOptions, option => option.value))}
//                         className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
//                     >
//                         {familyMembersArray.map(member => (
//                             <option key={member.id} value={member.id}>
//                                 {member.name} ({member.relation})
//                             </option>
//                         ))}
//                     </select>
//                 </div>
//                 <div className="flex justify-end">
//                     <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
//                         Add Member
//                     </button>
//                 </div>
//             </form>
//         </div>
//     );
// };

// Component to add a new family member
const AddFamilyMemberForm = ({ onAdd, familyMembers }) => {
    const [relationshipType, setRelationshipType] = useState('');
    const [relation, setRelation] = useState('');
    const [name, setName] = useState('');
    const [selectedParentIds, setSelectedParentIds] = useState([]);

    const directRelations = [
        'Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt',
        'Grandfather', 'Grandmother',
        'Great Grandfather', 'Great Grandmother',
        'Great Great Grandfather', 'Great Great Grandmother',
        'Great Great Great Grandfather', 'Great Great Great Grandmother'
    ];

    const childRelations = ['Son', 'Daughter'];

    const potentialParents = Object.values(familyMembers);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !relation) return;

        onAdd({
            name,
            relation,
            parentIds: selectedParentIds
        });

        setRelationshipType('');
        setRelation('');
        setName('');
        setSelectedParentIds([]);
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <div>
                <label className="block text-gray-700 font-semibold mb-1 text-sm">
                    How do you want to add this person?
                </label>
                <select
                    value={relationshipType}
                    onChange={(e) => {
                        setRelationshipType(e.target.value);
                        setRelation('');
                        setSelectedParentIds([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                >
                    <option value="" disabled>Choose relationship type...</option>
                    <option value="direct">Add as direct relation (Father, Spouse, etc.)</option>
                    <option value="child_of">Add as child of existing member</option>
                </select>
            </div>

            {relationshipType === 'direct' && (
                <div>
                    <label htmlFor="relation" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Select Relation
                    </label>
                    <select
                        id="relation"
                        value={relation}
                        onChange={(e) => {
                            setRelation(e.target.value);
                            setSelectedParentIds([]);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select relation...</option>
                        {directRelations.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                        ))}
                    </select>
                </div>
            )}

            {relationshipType === 'child_of' && (
                <div>
                    <label htmlFor="child-relation" className="block text-gray-700 font-semibold mb-1 text-sm">
                        This person is a...
                    </label>
                    <select
                        id="child-relation"
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select gender...</option>
                        {childRelations.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                />
            </div>

            {relationshipType === 'child_of' && potentialParents.length > 0 && (
                <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-sm">
                        Select Parent(s)
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {potentialParents.map(parent => (
                            <label key={parent.id} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectedParentIds.includes(parent.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedParentIds([...selectedParentIds, parent.id]);
                                        } else {
                                            setSelectedParentIds(selectedParentIds.filter(id => id !== parent.id));
                                        }
                                    }}
                                    className="rounded"
                                />
                                <span className="text-sm">{parent.name} ({parent.relation})</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={handleSubmit}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition"
            >
                Add Member
            </button>
        </div>
    );
};


export default AddFamilyMemberForm;