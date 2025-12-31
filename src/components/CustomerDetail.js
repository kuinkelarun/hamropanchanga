import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'; // Import Firestore functions
import { db } from '../firebase'; // Import your Firebase db instance
import AddFamilyMemberForm from './AddFamilyMemberForm'; // Import other components
import EditFamilyMemberForm from './EditFamilyMemberForm';
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

// Component to view customer details
const CustomerDetail = ({ customer: propCustomer, onBack, onUpdate }) => {
    const navigate = useNavigate();
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
        
        // Validate event data
        const eventName = eventData.name || eventData.title;
        if (!eventName || !eventName.trim()) {
            alert('Please enter an event name');
            setIsAddingEvent(true); // Re-open the form
            return;
        }
        
        if (!eventData.personId) {
            alert('Please select a person');
            setIsAddingEvent(true); // Re-open the form
            return;
        }
        
        if (!eventData.date) {
            alert('Please select a date');
            setIsAddingEvent(true); // Re-open the form
            return;
        }
        
        try {
            const familyMembers = customer.familyMembers || {};
            const person = Object.values(familyMembers).find(
                (member) => member.id === eventData.personId
            );
            const newEvent = {
                ...eventData,
                title: eventName.trim(), // Use the validated and trimmed name
                name: eventName.trim(), // Keep for backward compatibility
                personName: person ? person.name : 'Unknown',
                personRelation: person ? person.relation : 'N/A',
                id: crypto.randomUUID(),
                repetition: eventData.repetition || 'none', // Default to 'none' if not provided
                dateHistory: [eventData.date], // Initialize dateHistory with the first date
                createdAt: Date.now()
            };

            const currentEvents = customer.events || [];
            const updatedEvents = [...currentEvents, newEvent];
            const updatedCustomer = {
                ...customer,
                events: updatedEvents
            };
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { events: updatedEvents });
            onUpdate(updatedCustomer);
        } catch (error) {
            console.error("Error adding event:", error);
            alert(`Error adding event: ${error.message}`);
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
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-transform transform hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800">{customer.name}</h2>
                </div>
                <button
                    onClick={() => navigate(`/builder/${customer.id}`)}
                    className="text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all text-sm"
                    style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                    }}
                >
                    Open Visual Tree Builder
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Family Members</h3>
                        <button 
                            onClick={() => setIsAddingMember(prev => !prev)} 
                            className="text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all text-sm"
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                            }}
                        >
                            {isAddingMember ? 'Cancel' : '+ Add Member'}
                        </button>
                    </div>
                    
                    {isAddingMember && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <AddFamilyMemberForm onAdd={handleAddFamilyMember} familyMembers={customer.familyMembers || {}} />
                        </div>
                    )}
                    
                    {editingMember && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <EditFamilyMemberForm 
                                member={editingMember}
                                familyMembers={customer.familyMembers || {}}
                                onUpdate={handleUpdateFamilyMember}
                                onCancel={() => setEditingMember(null)}
                            />
                        </div>
                    )}
                    
                    {/* Family Members List */}
                    <div className="space-y-3">
                        {familyMembersArray.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-gray-500 mb-4">No family members added yet</p>
                                <button 
                                    onClick={() => setIsAddingMember(true)}
                                    className="text-purple-600 hover:text-purple-700 font-semibold"
                                >
                                    Add your first family member
                                </button>
                            </div>
                        ) : (
                            familyMembersArray
                                .sort((a, b) => (b.generation || 0) - (a.generation || 0))
                                .map((member) => (
                                    <div 
                                        key={member.id} 
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
                                    >
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-800">{member.name}</h4>
                                            <p className="text-sm text-gray-600">{member.relation}</p>
                                            {member.generation !== undefined && (
                                                <p className="text-xs text-gray-500 mt-1">Generation: {member.generation}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEditFamilyMember(member)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit member"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMemberRequest(member)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete member"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Events</h3>
                        {/* When adding or editing an event, hide the filter and top toggle; the form shows Add/Cancel */}
                        {!isAddingEvent && !editingEvent && (
                            <div className="flex items-center space-x-2">
                                <select
                                    value={eventFilter}
                                    onChange={(e) => setEventFilter(e.target.value)}
                                    className="border-2 border-gray-300 rounded-lg p-2 text-sm focus:border-purple-500 focus:outline-none"
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="all">All Events</option>
                                    <option value="past">Past Events</option>
                                    <option value="next-week">Next 7 Days</option>
                                    <option value="next-month">Next 30 Days</option>
                                    <option value="next-90-days">Next 90 Days</option>
                                </select>
                                <button 
                                    onClick={() => { setIsAddingEvent(prev => !prev); setEditingEvent(null); }} 
                                    className="text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all text-sm"
                                    style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    + Add Event
                                </button>
                            </div>
                        )}
                    </div>
                    {isAddingEvent && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <AddEventForm onAdd={handleAddEvent} onCancel={() => setIsAddingEvent(false)} familyMembers={familyMembersArray} />
                        </div>
                    )}
                    {editingEvent && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <EditEventForm event={editingEvent} onUpdate={handleUpdateEvent} onCancel={() => setEditingEvent(null)} familyMembers={familyMembersArray} />
                        </div>
                    )}
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