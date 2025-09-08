import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login'; // Import the Login component
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';

// Main App component
export default function App() {
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [view, setView] = useState('list');
    const [isLoading, setIsLoading] = useState(true); // Start loading until auth is checked
    const [isAdmin, setIsAdmin] = useState(false); // New state for admin role
    const [error, setError] = useState(null);


    // --- HOOKS ---

    // Listen for authentication state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    setIsAdmin(userDocSnap.data().role === 'admin');
                } else {
                    setIsAdmin(false);
                }
            } else {
                setUser(null);
                setIsAdmin(false);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch data from Firestore
    useEffect(() => {
        if (!user) {
            setCustomers([]);
            return;
        }

        setIsLoading(true);
        let q;
        if (isAdmin) {
            q = collection(db, 'customers');
        } else {
            q = query(collection(db, 'customers'), where('userId', '==', user.uid));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCustomers(customersData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching customers: ", error);
            setError("Failed to load data.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user, isAdmin]);


    // --- HANDLERS ---

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setView('details');
    };

    const handleBackToList = () => {
        setSelectedCustomer(null);
        setView('list');
    };

    const handleAddCustomer = () => {
        setView('add');
    };

    // In App.js
    const handleAddCustomerSuccess = async (newCustomerData) => {
        try {
            // Add the new customer to Firestore
            const customerCollectionRef = collection(db, 'customers');
            const docRef = await addDoc(customerCollectionRef, { ...newCustomerData, userId: user.uid });

            // Update local state with the newly created customer document
            // setCustomers(prev => [...prev, { ...newCustomerData, id: docRef.id }]);
            setView('list');
        } catch (error) {
            console.error("Error adding customer:", error);
            setError("Failed to add new customer.");
        }
    };
    
    // This is the crucial new handler
    const handleUpdateCustomer = (updatedCustomer) => {
        setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
        setSelectedCustomer(updatedCustomer);
    };

    const handleSignOut = () => {
        signOut(auth).catch((error) => {
            console.error("Sign out error: ", error);
        });
    };

    // --- RENDER ---

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-gray-500 text-lg">Loading...</div>
        </div>;
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-extrabold text-gray-900">Customer Management</h1>
                <div className="flex items-center space-x-4">
                    <span className="text-gray-700">Logged in as: {user.email}</span>
                    <button onClick={handleSignOut}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105">
                        Sign Out
                    </button>
                </div>
            </header>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4" role="alert">{error}</div>}

            {view === 'list' && (
                <CustomerList
                    customers={customers}
                    onSelectCustomer={handleSelectCustomer}
                    onAddCustomer={handleAddCustomer}
                />
            )}

            {view === 'details' && selectedCustomer && (
                <CustomerDetail
                    customer={selectedCustomer}
                    onBack={handleBackToList}
                    onUpdate={handleUpdateCustomer}
                />
            )}

            {view === 'add' && (
                <AddCustomerForm
                    onAddSuccess={handleAddCustomerSuccess}
                    onCancel={handleBackToList}
                />
            )}
        </div>
    );
}

// CustomerList.js (Example corrected component)
const CustomerList = ({ customers, onSelectCustomer, onAddCustomer }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Your Customers</h2>
                <button
                    onClick={onAddCustomer} // This now correctly uses the onAddCustomer prop
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105"
                >
                    Add New Customer
                </button>
            </div>
            {customers.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl shadow-md text-center text-gray-500">
                    No customers found. Click "Add New Customer" to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map((customer) => (
                        <div
                            key={customer.id}
                            className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => onSelectCustomer(customer)} // This is the corrected prop name
                        >
                            <h3 className="text-xl font-semibold text-gray-800">{customer.name}</h3>
                            <p className="text-gray-500">ID: {customer.id}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Component to add a new customer
const AddCustomerForm = ({ onAddSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [contactInfo, setContactInfo] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        // The 'Self' member is created with a unique ID for the object key and the member itself
        const selfId = crypto.randomUUID();
        const newCustomerData = {
            name,
            contactInfo,
            familyMembers: {
                [selfId]: {
                    id: selfId,
                    name: name,
                    relation: 'Self',
                    parentIds: [],
                    spouseIds: [],
                    generation: 0
                }
            },
            events: []
        };
        onAddSuccess(newCustomerData);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-gray-700 font-semibold mb-1">Customer Name</label>
                    <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                    <label htmlFor="contact" className="block text-gray-700 font-semibold mb-1">Contact Information</label>
                    <input id="contact" type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-xl hover:bg-gray-200 transition">Cancel</button>
                    <button type="submit" className="px-6 py-2 rounded-xl text-white font-semibold transition bg-blue-600 hover:bg-blue-700">Add Customer</button>
                </div>
            </form>
        </div>
    );
};

// --- New Helper Function to get relation based on parent's generation ---
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

// Component to view customer details
const CustomerDetail = ({ customer, onBack, onUpdate }) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [eventFilter, setEventFilter] = useState('upcoming');
    const [editingEvent, setEditingEvent] = useState(null);

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

            const updatedCustomer = {
                ...customer,
                familyMembers: updatedFamilyMembers
            };
            onUpdate(updatedCustomer);

        } catch (error) {
            console.error("Error adding family member:", error);
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
                    <FamilyTreeChart familyMembers={customer.familyMembers || {}} />
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Events</h3>
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
                                {isAddingEvent ? 'Cancel' : 'Add Event'}
                            </button>
                        </div>
                    </div>
                    {isAddingEvent && <AddEventForm onAdd={handleAddEvent} familyMembers={familyMembersArray} />}
                    {editingEvent && <EditEventForm event={editingEvent} onUpdate={handleUpdateEvent} onCancel={() => setEditingEvent(null)} familyMembers={familyMembersArray} />}
                    {!isAddingEvent && !editingEvent && <EventList events={customer.events || []} eventFilter={eventFilter} onEdit={handleEditEvent} />}
                </div>
            </div>
        </div>
    );
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

// --- Updated Family Tree Chart Component ---
const FamilyTreeChart = ({ familyMembers }) => {
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

// Component to list all events
const EventList = ({ events, eventFilter, onEdit }) => {
    // Helper function to calculate the next occurrence of a repeating event
    const getNextOccurrence = (originalDate, repetition) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(originalDate);

        if (repetition === 'monthly') {
            while (nextDate < today) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (repetition === 'yearly') {
            while (nextDate < today) {
                nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
        }
        return nextDate;
    };

    // Helper dates for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    
    // New date variable for the filter
    const next90Days = new Date(today);
    next90Days.setDate(today.getDate() + 90);

    // Filter and sort events based on the selected filter
    const sortedAndFilteredEvents = events
        .map(event => {
            const originalDate = new Date(event.date);
            const displayDate = (event.repetition && event.repetition !== 'none') ?
                getNextOccurrence(originalDate, event.repetition) :
                originalDate;
            return { ...event, originalDate, displayDate };
        })
        .filter(event => {
            switch (eventFilter) {
                case 'all':
                    return true;
                case 'past':
                    return event.originalDate < today;
                case 'next-week':
                    return event.displayDate >= today && event.displayDate <= nextWeek;
                case 'next-month':
                    return event.displayDate >= today && event.displayDate <= nextMonth;
                case 'next-90-days': // New filter case
                    return event.displayDate >= today && event.displayDate <= next90Days;
                case 'upcoming':
                default:
                    return event.displayDate >= today;
            }
        })
        .sort((a, b) => a.displayDate - b.displayDate);

    const shouldGroup = ['upcoming', 'all', 'next-90-days'].includes(eventFilter);
    const groupedEvents = {};
    if (shouldGroup) {
        sortedAndFilteredEvents.forEach(event => {
            const monthYear = event.displayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groupedEvents[monthYear]) {
                groupedEvents[monthYear] = [];
            }
            groupedEvents[monthYear].push(event);
        });
    }

    return (
        <div className="space-y-3">
            {sortedAndFilteredEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No events found for this filter.
                </div>
            ) : (
                shouldGroup ? (
                    Object.keys(groupedEvents).map(monthYear => (
                        <div key={monthYear}>
                            <h5 className="text-lg font-bold text-gray-700 mb-2 mt-4">{monthYear}</h5>
                            <ul className="space-y-2">
                                {groupedEvents[monthYear].map((event, index) => (
                                    <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="text-gray-800 font-medium">{event.name}</div>
                                            <div className="text-sm text-gray-500">
                                                {event.displayDate.toDateString()}
                                                {event.repetition && event.repetition !== 'none' && (
                                                    <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                                )}
                                            </div>
                                            {event.personName && (
                                                <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <button onClick={() => onEdit(event)} className="p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                ) : (
                    <ul className="space-y-2">
                        {sortedAndFilteredEvents.map((event, index) => (
                            <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="text-gray-800 font-medium">{event.name}</div>
                                    <div className="text-sm text-gray-500">
                                        {event.displayDate.toDateString()}
                                        {event.repetition && event.repetition !== 'none' && (
                                            <span className="text-xs text-gray-400 ml-2">({event.repetition} repeating)</span>
                                        )}
                                    </div>
                                    {event.personName && (
                                        <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
                                    )}
                                </div>
                                <div className="relative">
                                    <button onClick={() => onEdit(event)} className="p-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
};

// Component to add a new event
const AddEventForm = ({ onAdd, familyMembers }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [repetition, setRepetition] = useState('none'); // New state for repetition

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        onAdd({ name, date, personId: selectedPersonId, repetition }); // Pass repetition value
        setName('');
        setDate('');
        setSelectedPersonId('');
        setRepetition('none');
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">Add New Event</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Associated Person
                    </label>
                    <select
                        id="event-person"
                        value={selectedPersonId}
                        onChange={(e) => setSelectedPersonId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select a person...</option>
                        {familyMembers.map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.relation})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="event-name" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Event Name
                    </label>
                    <input
                        id="event-name"
                        type="text"
                        placeholder="Event Name (e.g., Birthday)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="event-date" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Date
                    </label>
                    <input
                        id="event-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="event-repetition" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Repeats
                    </label>
                    <select
                        id="event-repetition"
                        value={repetition}
                        onChange={(e) => setRepetition(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                        <option value="none">Does not repeat</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
                <div className="flex justify-end">
                    <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                        Add Event
                    </button>
                </div>
            </form>
        </div>
    );
};

// Component to edit an existing event
const EditEventForm = ({ event, onUpdate, onCancel, familyMembers }) => {
    const [name, setName] = useState(event.name);
    const [date, setDate] = useState(event.date); // Use the current, most recent date
    const [selectedPersonId, setSelectedPersonId] = useState(event.personId);
    const [repetition, setRepetition] = useState(event.repetition || 'none');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        // Find the associated person to get their name and relation
        const person = familyMembers.find(member => member.id === selectedPersonId);

        // Create the updated event object, adding the new date to the history array
        const updatedEvent = {
            ...event,
            name,
            date, // This is the new, current date
            personId: selectedPersonId,
            personName: person ? person.name : 'Unknown',
            personRelation: person ? person.relation : 'N/A',
            repetition,
            dateHistory: [...event.dateHistory, date] // Append the new date to the history array
        };

        onUpdate(updatedEvent);
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">Edit Event</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="edit-event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Associated Person
                    </label>
                    <select
                        id="edit-event-person"
                        value={selectedPersonId}
                        onChange={(e) => setSelectedPersonId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    >
                        <option value="" disabled>Select a person...</option>
                        {familyMembers.map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.relation})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="edit-event-name" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Event Name
                    </label>
                    <input
                        id="edit-event-name"
                        type="text"
                        placeholder="Event Name (e.g., Birthday)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="edit-event-date" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Date
                    </label>
                    <input
                        id="edit-event-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="edit-event-repetition" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Repeats
                    </label>
                    <select
                        id="edit-event-repetition"
                        value={repetition}
                        onChange={(e) => setRepetition(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                        <option value="none">Does not repeat</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-gray-700 font-semibold transition bg-gray-200 hover:bg-gray-300 text-sm">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                        Update Event
                    </button>
                </div>
            </form>
        </div>
    );
};