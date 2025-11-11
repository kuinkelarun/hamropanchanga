import { useState, useEffect } from 'react';
import RelationInput from './RelationInput';

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
    const [generationOverride, setGenerationOverride] = useState('');

    // Map known relation names to generation numbers so selecting a relation auto-assigns group
    const relationToGeneration = {
        'Great Great Great Grandmother': 5,
        'Great Great Great Grandfather': 5,
        'Great Great Grandmother': 4,
        'Great Great Grandfather': 4,
        'Great Grandmother': 3,
        'Great Grandfather': 3,
        'Grandmother': 2,
        'Grandfather': 2,
        'Mother': 1,
        'Father': 1,
        'Uncle': 1,
        'Aunt': 1,
        'Self': 0,
        'Spouse': 0,
        'Brother': 0,
        'Sister': 0,
        'Son': -1,
        'Daughter': -1,
        'Grandson': -2,
        'Granddaughter': -2
    };

    useEffect(() => {
        // Only auto-set generation when the user is adding a direct relation.
        // When adding as `child_of` the form's selected relation (Son/Daughter) may be
        // rewritten by parent-based logic on submit (e.g. becomes Brother/Sister). If
        // we pre-set the generationOverride for the child_of flow it can conflict with
        // the resolved relation and place the member into the wrong generation group.
        if (relationshipType === 'direct' && relation && (!generationOverride || generationOverride === '')) {
            const gen = relationToGeneration[relation];
            if (gen !== undefined) setGenerationOverride(String(gen));
        }
    }, [relation, relationshipType]);

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
            parentIds: selectedParentIds,
            generationOverride: generationOverride // '' means auto
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
                    <RelationInput
                        id="relation"
                        value={relation}
                        onChange={(val) => { setRelation(val); setSelectedParentIds([]); }}
                        groupedOptions={[
                            { label: 'Current level', options: ['Self','Spouse','Sibling'] },
                            { label: 'Parents', options: ['Father','Mother'] },
                            { label: 'Grandparents', options: ['Grandfather','Grandmother'] },
                            { label: 'Great Grandparents', options: ['Great Grandfather','Great Grandmother'] },
                            { label: 'Children', options: ['Son','Daughter'] }
                        ]}
                        placeholder="Select or type relation..."
                        required
                    />
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

            <div className="mt-2">
                <label className="block text-gray-700 font-semibold mb-1 text-sm">Hierarchy group</label>
                <select
                    value={generationOverride}
                    onChange={e => setGenerationOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                    <option value="">Auto (derive from relation/parents)</option>
                    <option value="5">Great Great Great Grandparents</option>
                    <option value="4">Great Great Grandparents</option>
                    <option value="3">Great Grandparents</option>
                    <option value="2">Grandparents</option>
                    <option value="1">Parents</option>
                    <option value="0">Current level</option>
                    <option value="-1">Children</option>
                    <option value="-2">Grandchildren</option>
                </select>
            </div>

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