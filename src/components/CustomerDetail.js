import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore'; // Import Firestore functions
import { db } from '../firebase'; // Import your Firebase db instance
import AddFamilyMemberForm from './AddFamilyMemberForm'; // Import other components
import EditFamilyMemberForm from './EditFamilyMemberForm';
import FamilyTreeChart from './FamilyTreeChart';
import AddEventForm from './AddEventForm';
import EventList from './EventList';

// Helper functions (assuming these are defined elsewhere or you will add them)
const getRelationFromParent = (parentRelation, childRelation, parentGeneration) => {
    // Your logic for getting the relation
    return childRelation;
};

const calculateGeneration = (relation, parentIds, familyMembers) => {
    // Your logic for calculating generation
    return 0;
};


// Component to view customer details
const CustomerDetail = ({ customer, onBack, onUpdate }) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [editingMember, setEditingMember] = useState(null);

    const handleAddFamilyMember = async (memberData) => {
        setIsAddingMember(false);
        try {
            const familyMembers = customer.familyMembers || {};
            const newMemberId = crypto.randomUUID();

            let newRelation = memberData.relation;
            let isDirectAncestor = true;

            if (memberData.parentIds.length > 0) {
                const parent = familyMembers[memberData.parentIds[0]];
                if (parent) {
                    const sideLineRelations = ['Brother', 'Sister', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin', 'Granduncle', 'Grandaunt', 'Great-Granduncle', 'Great-Grandaunt'];
                    isDirectAncestor = !sideLineRelations.includes(parent.relation) && (parent.relation === 'Self' || parent.relation === 'Spouse');
                    newRelation = getRelationFromParent(parent.relation, memberData.relation, parent.generation);
                }
            }

            const newMember = {
                id: newMemberId,
                name: memberData.name,
                relation: newRelation,
                parentIds: memberData.parentIds || [],
                spouseIds: [],
                generation: calculateGeneration(newRelation, memberData.parentIds, familyMembers),
                isDirectAncestor: isDirectAncestor
            };

            const updatedFamilyMembers = {
                ...familyMembers,
                [newMemberId]: newMember
            };

            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });

        } catch (error) {
            console.error("Error adding family member:", error);
        }
    };
    
    const handleEditFamilyMember = (member) => {
        setIsAddingMember(false);
        setEditingMember(member);
    };

    const handleUpdateFamilyMember = async (updatedMember) => {
        setEditingMember(null);
        try {
            const updatedFamilyMembers = {
                ...customer.familyMembers,
                [updatedMember.id]: updatedMember
            };

            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });

        } catch (error) {
            console.error("Error updating family member:", error);
        }
    };

    const handleAddEvent = async (eventData) => {
        setIsAddingEvent(false);
        try {
            const updatedEvents = [...customer.events, eventData];
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { events: updatedEvents });
        } catch (error) {
            console.error("Error adding event:", error);
        }
    };

    const familyMembersArray = Object.values(customer.familyMembers || {});

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-transform transform hover:scale-105">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-3xl font-bold text-gray-800">{customer.name}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Family Tree</h3>
                        <button onClick={() => { setIsAddingMember(prev => !prev); setEditingMember(null); }}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
                            {isAddingMember ? 'Cancel' : 'Add Member'}
                        </button>
                    </div>
                    {isAddingMember && <AddFamilyMemberForm onAdd={handleAddFamilyMember} familyMembers={customer.familyMembers || {}} />}
                    {editingMember && (
                        <EditFamilyMemberForm 
                            member={editingMember}
                            familyMembers={customer.familyMembers || {}}
                            onUpdate={handleUpdateFamilyMember}
                            onCancel={() => setEditingMember(null)}
                        />
                    )}
                    <FamilyTreeChart familyMembers={customer.familyMembers || {}} onEdit={handleEditFamilyMember} />
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Events</h3>
                        <button onClick={() => setIsAddingEvent(prev => !prev)}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
                            {isAddingEvent ? 'Cancel' : 'Add Event'}
                        </button>
                    </div>
                    {isAddingEvent && <AddEventForm onAdd={handleAddEvent} familyMembers={familyMembersArray} />}
                    <EventList events={customer.events || []} />
                </div>
            </div>
        </div>
    );
};

export default CustomerDetail; // Don't forget to export your component