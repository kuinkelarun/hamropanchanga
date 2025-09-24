import { useState, useEffect } from 'react';
import RelationInput from './RelationInput';

// Component to edit an existing family member
const EditFamilyMemberForm = ({ member, familyMembers, onUpdate, onCancel }) => {
    const [name, setName] = useState(member.name);
    const [relation, setRelation] = useState(member.relation);
    const [generationOverride, setGenerationOverride] = useState(
        member.generationOverride !== undefined ? String(member.generationOverride) : (member.generation !== undefined ? String(member.generation) : '')
    );

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
            relation,
            generationOverride // pass through the override so it can be persisted
        });
    };

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
        if (relation && (!generationOverride || generationOverride === '')) {
            const gen = relationToGeneration[relation];
            if (gen !== undefined) setGenerationOverride(String(gen));
        }
    }, [relation]);

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
                    <RelationInput
                        id="edit-relation"
                        value={relation}
                        onChange={setRelation}
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

                <div>
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