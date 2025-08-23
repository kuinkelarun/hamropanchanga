import { useState } from 'react';

// Component to edit an existing family member
const EditFamilyMemberForm = ({ member, familyMembers, onUpdate, onCancel }) => {
    const [name, setName] = useState(member.name);
    const [relation, setRelation] = useState(member.relation);

    const directRelations = [
        'Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt',
        'Grandfather', 'Grandmother',
        'Great Grandfather', 'Great Grandmother',
        'Great Great Grandfather', 'Great Great Grandmother',
        'Great Great Great Grandfather', 'Great Great Great Grandmother',
    ];
    const childRelations = ['Son', 'Daughter'];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !relation) return;

        onUpdate({
            ...member,
            name,
            relation
        });
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">Edit Member</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="edit-name" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Name
                    </label>
                    <input
                        id="edit-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="edit-relation" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Relation
                    </label>
                    <select
                        id="edit-relation"
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select relation...</option>
                        {directRelations.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                        ))}
                         {childRelations.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-xl hover:bg-gray-200 transition text-sm">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditFamilyMemberForm;