import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'; // Import Firestore functions
import { db } from '../firebase'; // Import your Firebase db instance
import AddFamilyMemberForm from './AddFamilyMemberForm'; // Import other components
import EditFamilyMemberForm from './EditFamilyMemberForm';
import FamilyTreeChart from './FamilyTreeChart';
import AddEventForm from './AddEventForm';
import EventList from './EventList';
import EditEventForm from './EditEventForm';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';


// --- Helper Function to get relation based on parent's generation ---
const getRelationFromParent = (parentRelation, newMemberGender, parentGeneration) => {
    // Direct descendants of 'Self' or 'Spouse' are always 'Son' or 'Daughter'
    if (parentRelation === 'Self' || parentRelation === 'Spouse') {
        return newMemberGender === 'Son' ? 'Son' : 'Daughter';
    }

    // Handle children of direct ancestors up to generation 1 (parents)
    const directRelationMap = {
        'Father': newMemberGender === 'Son' ? 'Brother' : 'Sister',
        'Mother': newMemberGender === 'Son' ? 'Brother' : 'Sister',
        'Brother': newMemberGender === 'Son' ? 'Nephew' : 'Niece',
        'Sister': newMemberGender === 'Son' ? 'Nephew' : 'Niece',
        'Uncle': newMemberGender === 'Son' ? 'Cousin' : 'Cousin',
        'Aunt': newMemberGender === 'Son' ? 'Cousin' : 'Cousin',
    };

    if (directRelationMap[parentRelation]) {
        return directRelationMap[parentRelation];
    }
    
    const newMemberGeneration = parentGeneration - 1;

    // For generations above 1 (grandparents and up), use a progressive naming scheme
    if (newMemberGeneration >= 1) {
        const extendedPrefixMap = {
            1: '', // Child of grandparent is Uncle/Aunt
            2: 'Grand-', // Child of great-grandparent is Granduncle/Grandaunt
            3: 'Great-Grand-',
            4: 'Great-Great-Grand-',
        };
        const prefix = extendedPrefixMap[newMemberGeneration] || '';
        const suffix = newMemberGender === 'Son' ? 'uncle' : 'aunt';
        return `${prefix}${suffix}`;
    }

    return newMemberGender === 'Son' ? 'Son' : 'Daughter'; // Fallback
};

// Helper function to calculate generation (no change needed here)
const calculateGeneration = (relation, parentIds, familyMembers) => {
    if (relation === 'Self') return 0;
    
    if (parentIds && parentIds.length > 0) {
        const parent = familyMembers[parentIds[0]];
        if (parent) {
            return parent.generation - 1;
        }
    }
    
    const generationMap = {
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
    return generationMap[relation] ?? 0;
};

// // Component to view customer details
// const CustomerDetail = ({ customer, onBack, onUpdate }) => {
//     const [isAddingMember, setIsAddingMember] = useState(false);
//     const [isAddingEvent, setIsAddingEvent] = useState(false);
//     const [editingMember, setEditingMember] = useState(null);

//     const handleAddFamilyMember = async (memberData) => {
//         setIsAddingMember(false);
//         try {
//             const familyMembers = customer.familyMembers || {};
//             const newMemberId = crypto.randomUUID();

//             let newRelation = memberData.relation;
//             let isDirectAncestor = true;

//             if (memberData.parentIds.length > 0) {
//                 const parent = familyMembers[memberData.parentIds[0]];
//                 if (parent) {
//                     const sideLineRelations = ['Brother', 'Sister', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin', 'Granduncle', 'Grandaunt', 'Great-Granduncle', 'Great-Grandaunt'];
//                     isDirectAncestor = !sideLineRelations.includes(parent.relation) && (parent.relation === 'Self' || parent.relation === 'Spouse');
//                     newRelation = getRelationFromParent(parent.relation, memberData.relation, parent.generation);
//                 }
//             }

//             const newMember = {
//                 id: newMemberId,
//                 name: memberData.name,
//                 relation: newRelation,
//                 parentIds: memberData.parentIds || [],
//                 spouseIds: [],
//                 generation: calculateGeneration(newRelation, memberData.parentIds, familyMembers),
//                 isDirectAncestor: isDirectAncestor
//             };

//             const updatedFamilyMembers = {
//                 ...familyMembers,
//                 [newMemberId]: newMember
//             };

//             const customerDocRef = doc(db, 'customers', customer.id);
//             await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });

//         } catch (error) {
//             console.error("Error adding family member:", error);
//         }
//     };
    
//     const handleEditFamilyMember = (member) => {
//         setIsAddingMember(false);
//         setEditingMember(member);
//     };

//     const handleUpdateFamilyMember = async (updatedMember) => {
//         setEditingMember(null);
//         try {
//             const updatedFamilyMembers = {
//                 ...customer.familyMembers,
//                 [updatedMember.id]: updatedMember
//             };

//             const customerDocRef = doc(db, 'customers', customer.id);
//             await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });

//         } catch (error) {
//             console.error("Error updating family member:", error);
//         }
//     };

//     const handleAddEvent = async (eventData) => {
//         setIsAddingEvent(false);
//         try {
//             const updatedEvents = [...customer.events, eventData];
//             const customerDocRef = doc(db, 'customers', customer.id);
//             await updateDoc(customerDocRef, { events: updatedEvents });
//         } catch (error) {
//             console.error("Error adding event:", error);
//         }
//     };

//     const familyMembersArray = Object.values(customer.familyMembers || {});

//     return (
//         <div className="space-y-6">
//             <div className="flex items-center space-x-4 mb-6">
//                 <button onClick={onBack}
//                     className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-transform transform hover:scale-105">
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6"
//                         fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
//                     </svg>
//                 </button>
//                 <h2 className="text-3xl font-bold text-gray-800">{customer.name}</h2>
//             </div>
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                 <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
//                     <div className="flex justify-between items-center mb-4">
//                         <h3 className="text-xl font-bold text-gray-800">Family Tree</h3>
//                         <button onClick={() => { setIsAddingMember(prev => !prev); setEditingMember(null); }}
//                             className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
//                             {isAddingMember ? 'Cancel' : 'Add Member'}
//                         </button>
//                     </div>
//                     {isAddingMember && <AddFamilyMemberForm onAdd={handleAddFamilyMember} familyMembers={customer.familyMembers || {}} />}
//                     {editingMember && (
//                         <EditFamilyMemberForm 
//                             member={editingMember}
//                             familyMembers={customer.familyMembers || {}}
//                             onUpdate={handleUpdateFamilyMember}
//                             onCancel={() => setEditingMember(null)}
//                         />
//                     )}
//                     <FamilyTreeChart familyMembers={customer.familyMembers || {}} onEdit={handleEditFamilyMember} />
//                 </div>
//                 <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
//                     <div className="flex justify-between items-center mb-4">
//                         <h3 className="text-xl font-bold text-gray-800">Events</h3>
//                         <button onClick={() => setIsAddingEvent(prev => !prev)}
//                             className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
//                             {isAddingEvent ? 'Cancel' : 'Add Event'}
//                         </button>
//                     </div>
//                     {isAddingEvent && <AddEventForm onAdd={handleAddEvent} familyMembers={familyMembersArray} />}
//                     <EventList events={customer.events || []} />
//                 </div>
//             </div>
//         </div>
//     );
// };



// Component to view customer details
const CustomerDetail = ({ customer: propCustomer, onBack, onUpdate }) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [eventFilter, setEventFilter] = useState('upcoming');
    const [editingEvent, setEditingEvent] = useState(null);
    const [deleteRequestEvent, setDeleteRequestEvent] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [editingMember, setEditingMember] = useState(null);
    const [deleteRequestMember, setDeleteRequestMember] = useState(null);

    // Local doc-level state to keep this view in sync with Firestore in real-time.
    const [localCustomer, setLocalCustomer] = useState(propCustomer);

    const customerId = propCustomer ? propCustomer.id : null;

    useEffect(() => {
        // If propCustomer changes, reset local state and (re)subscribe to its doc.
        setLocalCustomer(propCustomer);
        if (!customerId) return;

        const customerDocRef = doc(db, 'customers', customerId);
        const unsubscribe = onSnapshot(customerDocRef, (snap) => {
            if (snap.exists()) {
                setLocalCustomer({ id: snap.id, ...snap.data() });
            }
        }, (err) => {
            console.error('Error listening to customer doc:', err);
        });

        return () => unsubscribe();
    }, [customerId, propCustomer]);

    // Use localCustomer for all rendering and updates when available
    const customer = localCustomer || propCustomer;

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

            const computedGeneration = (memberData.generationOverride !== undefined && memberData.generationOverride !== '')
                ? Number(memberData.generationOverride)
                : calculateGeneration(newRelation, memberData.parentIds, familyMembers);

            const newMember = {
                id: newMemberId,
                name: memberData.name,
                relation: newRelation,
                parentIds: memberData.parentIds || [],
                spouseIds: [],
                generation: computedGeneration,
                isDirectAncestor: isDirectAncestor,
                generationOverride: (memberData.generationOverride !== undefined && memberData.generationOverride !== '') ? Number(memberData.generationOverride) : undefined
            };
            const updatedFamilyMembers = {
                ...familyMembers,
                [newMemberId]: newMember
            };
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });

            const updatedCustomer = {
                ...customer,
                familyMembers: updatedFamilyMembers
            };
            onUpdate(updatedCustomer);

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
            // Use generationOverride if provided on the updatedMember object
            const computedGeneration = (updatedMember.generationOverride !== undefined && updatedMember.generationOverride !== '')
                ? Number(updatedMember.generationOverride)
                : calculateGeneration(updatedMember.relation, updatedMember.parentIds, customer.familyMembers || {});

            const memberToSave = {
                ...updatedMember,
                generation: computedGeneration,
                generationOverride: (updatedMember.generationOverride !== undefined && updatedMember.generationOverride !== '') ? Number(updatedMember.generationOverride) : undefined
            };

            const updatedFamilyMembers = {
                ...customer.familyMembers,
                [updatedMember.id]: memberToSave
            };

            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });
            onUpdate({ ...customer, familyMembers: updatedFamilyMembers });
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'success', message: 'Member updated' }]);
        } catch (error) {
            console.error("Error updating family member:", error);
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'error', message: 'Failed to update member' }]);
        }
    };

    const handleDeleteMemberRequest = (member) => {
        setDeleteRequestMember(member);
    };

    const handleDeleteMember = async (memberId) => {
        try {
            const updatedFamilyMembers = { ...customer.familyMembers };
            delete updatedFamilyMembers[memberId];
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });
            onUpdate({ ...customer, familyMembers: updatedFamilyMembers });
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'success', message: 'Member deleted' }]);
        } catch (error) {
            console.error('Error deleting member', error);
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'error', message: 'Failed to delete member' }]);
        } finally {
            setDeleteRequestMember(null);
        }
    };

    const handleAddEvent = async (eventData) => {
        setIsAddingEvent(false);
        try {
            const person = Object.values(customer.familyMembers).find(
                (member) => member.id === eventData.personId
            );
            const newEvent = {
                ...eventData,
                personName: person ? person.name : 'Unknown',
                personRelation: person ? person.relation : 'N/A',
                id: crypto.randomUUID(),
                dateHistory: [eventData.date] // Initialize dateHistory with the first date
            };

            const updatedEvents = [...customer.events, newEvent];
            const updatedCustomer = {
                ...customer,
                events: updatedEvents
            };
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { events: updatedEvents });
            onUpdate(updatedCustomer);
        } catch (error) {
            console.error("Error adding event:", error);
        }
    };

    const handleEditEvent = (event) => {
        setEditingEvent(event);
        setIsAddingEvent(false);
    };

    // Request a delete (opens confirm modal)
    const handleDeleteRequest = (event) => {
        setDeleteRequestEvent(event);
    };

    // Delete an event by id (after confirmation)
    const handleDeleteEvent = async (eventId) => {
        try {
            const updatedEvents = (customer.events || []).filter(ev => ev.id !== eventId);
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { events: updatedEvents });
            onUpdate({ ...customer, events: updatedEvents });
            if (editingEvent && editingEvent.id === eventId) {
                setEditingEvent(null);
            }
            // show success toast
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'success', message: 'Event deleted' }]);
        } catch (error) {
            console.error("Error deleting event:", error);
            const id = crypto.randomUUID();
            setToasts(prev => [...prev, { id, type: 'error', message: 'Failed to delete event' }]);
        } finally {
            setDeleteRequestEvent(null);
        }
    };

    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleUpdateEvent = async (updatedEventData) => {
        try {
            const updatedEvents = customer.events.map(event =>
                event.id === updatedEventData.id ? updatedEventData : event
            );
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { events: updatedEvents });
            onUpdate({ ...customer, events: updatedEvents });
            setEditingEvent(null);
        } catch (error) {
            console.error("Error updating event:", error);
        }
    };

    const familyMembersArray = Object.values(customer.familyMembers || {});
    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-transform transform hover:scale-105">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-3xl font-bold text-gray-800">{customer.name}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Family Tree</h3>
                        <button onClick={() => setIsAddingMember(prev => !prev)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
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
                    <FamilyTreeChart familyMembers={customer.familyMembers || {}} onEdit={handleEditFamilyMember} onDeleteRequest={handleDeleteMemberRequest} />
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Events</h3>
                        {/* When adding or editing an event, hide the filter and top toggle; the form shows Add/Cancel */}
                        {!isAddingEvent && !editingEvent && (
                            <div className="flex items-center space-x-2">
                                <select
                                    value={eventFilter}
                                    onChange={(e) => setEventFilter(e.target.value)}
                                    className="border rounded-xl p-1 text-sm"
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="all">All Events</option>
                                    <option value="past">Past Events</option>
                                    <option value="next-week">Next 7 Days</option>
                                    <option value="next-month">Next 30 Days</option>
                                    <option value="next-90-days">Next 90 Days</option>
                                </select>
                                <button onClick={() => { setIsAddingEvent(prev => !prev); setEditingEvent(null); }} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
                                    Add Event
                                </button>
                            </div>
                        )}
                    </div>
                    {isAddingEvent && <AddEventForm onAdd={handleAddEvent} onCancel={() => setIsAddingEvent(false)} familyMembers={familyMembersArray} />}
                    {editingEvent && <EditEventForm event={editingEvent} onUpdate={handleUpdateEvent} onCancel={() => setEditingEvent(null)} familyMembers={familyMembersArray} />}
                    {!isAddingEvent && !editingEvent && <EventList events={customer.events || []} eventFilter={eventFilter} onEdit={handleEditEvent} onDelete={handleDeleteRequest} />}
                </div>
            </div>
            {/* Confirm modal for delete */}
            <ConfirmModal
                open={!!deleteRequestEvent}
                title="Delete event"
                message={deleteRequestEvent ? `Delete "${deleteRequestEvent.name}"? This action cannot be undone.` : ''}
                onCancel={() => setDeleteRequestEvent(null)}
                onConfirm={() => handleDeleteEvent(deleteRequestEvent.id)}
            />

            {/* Confirm modal for deleting a family member */}
            <ConfirmModal
                open={!!deleteRequestMember}
                title="Delete member"
                message={deleteRequestMember ? `Delete "${deleteRequestMember.name}"? This will remove them from the family tree.` : ''}
                onCancel={() => setDeleteRequestMember(null)}
                onConfirm={() => handleDeleteMember(deleteRequestMember.id)}
            />

            {/* Toasts */}
            {toasts.map(t => (
                <Toast key={t.id} id={t.id} type={t.type} message={t.message} onClose={removeToast} />
            ))}
        </div>
    );
};




export default CustomerDetail; // Don't forget to export your component