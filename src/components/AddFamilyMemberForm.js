import { useState } from 'react';

const AddFamilyMemberForm = ({ onAdd, familyMembers }) => {
    const [name, setName] = useState('');
    const [relation, setRelation] = useState('');
    const [selectedParentIds, setSelectedParentIds] = useState([]);

    const familyMembersArray = Object.values(familyMembers);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !relation) return;

        const newMemberData = {
            name: name,
            relation: relation,
            parentIds: selectedParentIds,
        };
        onAdd(newMemberData);
        setName('');
        setRelation('');
        setSelectedParentIds([]);
    };

    const directRelations = [
        'Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt',
        'Grandfather', 'Grandmother',
        'Great Grandfather', 'Great Grandmother',
        'Great Great Grandfather', 'Great Great Grandmother',
        'Great Great Great Grandfather', 'Great Great Great Grandmother',
    ];

    const childRelations = ['Son', 'Daughter'];

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">Add New Family Member</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="name" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        placeholder="Enter name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="relation" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Relation
                    </label>
                    <select
                        id="relation"
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select relation...</option>
                        <optgroup label="Direct Relations">
                            {directRelations.map(rel => (
                                <option key={rel} value={rel}>{rel}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Child">
                            {childRelations.map(rel => (
                                <option key={rel} value={rel}>{rel}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
                <div>
                    <label htmlFor="parents" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Parents (Optional)
                    </label>
                    <select
                        id="parents"
                        multiple
                        value={selectedParentIds}
                        onChange={(e) => setSelectedParentIds(Array.from(e.target.selectedOptions, option => option.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                        {familyMembersArray.map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.relation})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                        Add Member
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddFamilyMemberForm;