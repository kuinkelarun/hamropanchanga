import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login'; // Import the Login component
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { doc, updateDoc, addDoc } from 'firebase/firestore';


// Main App component
// export default function App() {
//   const [user, setUser] = useState(null); // State to hold the logged-in user
//   const [customers, setCustomers] = useState([]);
//   const [customers, setCustomers] = useState([]);
//   const [selectedCustomer, setSelectedCustomer] = useState(null);
//   const [view, setView] = useState('list'); // 'list', 'details', 'add'
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);

// Main App Component
export default function App() {
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [view, setView] = useState('list');
    const [isLoading, setIsLoading] = useState(true); // Start loading until auth is checked

    // --- HOOKS ---

    // Listen for authentication state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setCustomers([]); // Clear data on logout
            }
            setIsLoading(false); // Auth check is complete
        });
        return () => unsubscribe(); // Cleanup subscription
    }, []);

    // Fetch data from Firestore when user logs in
    useEffect(() => {
        if (user) {
            setIsLoading(true);
            const customersCollection = collection(db, 'customers');
            const q = query(customersCollection, where("userId", "==", user.uid));

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const customersData = [];
                querySnapshot.forEach((doc) => {
                    customersData.push({ ...doc.data(), id: doc.id });
                });
                setCustomers(customersData);
                setIsLoading(false);
            });

            return () => unsubscribe(); // Cleanup listener
        }
    }, [user]); // Re-run when user object changes

    // --- HANDLER FUNCTIONS ---

    const handleSignOut = () => {
        signOut(auth);
        setView('list');
        setSelectedCustomer(null);
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setView('details');
    };

    const handleBackToList = () => {
        setSelectedCustomer(null);
        setView('list');
    };

    const handleAddCustomerView = () => {
        setView('add');
    };

    const handleAddNewCustomer = async (customerData) => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'customers'), {
                ...customerData,
                userId: user.uid // Link customer to the current user
            });
            setView('list');
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    };
    
    // --- RENDER LOGIC ---

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans">
            <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-extrabold text-gray-900">
                        Family & Events Manager
                    </h1>
                    <button onClick={handleSignOut} className="text-sm text-blue-600 hover:underline">
                        Sign Out ({user.email})
                    </button>
                </div>

                {view === 'list' && (
                    <CustomerList
                        customers={customers}
                        onSelect={handleSelectCustomer}
                        onAdd={handleAddCustomerView}
                    />
                )}
                {view === 'details' && selectedCustomer && (
                    <CustomerDetail
                        customer={selectedCustomer}
                        onBack={handleBackToList}
                    />
                )}
                {view === 'add' && (
                    <AddCustomerForm
                        onSuccess={handleAddNewCustomer}
                        onCancel={handleBackToList}
                    />
                )}
            </div>
        </div>
    );
}

// Component to display the list of customers
const CustomerList = ({ customers, onSelect, onAdd }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
                <button
                    onClick={onAdd}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105"
                >
                    Add New Customer
                </button>
            </div>
            {customers.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    No customers found. Click "Add New Customer" to get started!
                </div>
            ) : (
                <ul className="space-y-4">
                    {customers.map(customer => (
                        <li
                            key={customer.id}
                            className="p-4 bg-gray-50 rounded-xl shadow-sm hover:bg-gray-100 transition cursor-pointer flex justify-between items-center"
                            onClick={() => onSelect(customer)}
                        >
                            <div>
                                <span className="text-lg font-medium text-gray-700">{customer.name}</span>
                                <div className="text-sm text-gray-500">{customer.contactInfo}</div>
                            </div>
                            <span className="text-sm text-gray-400">View Details &raquo;</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// Component to add a new customer
const AddCustomerForm = ({ onSuccess, onCancel }) => {
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
        onSuccess(newCustomerData);
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
const CustomerDetail = ({ customer, onBack }) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isAddingEvent, setIsAddingEvent] = useState(false);

    const handleAddFamilyMember = async (memberData) => {
        setIsAddingMember(false);
        const familyMembers = customer.familyMembers || {};
        const newMemberId = crypto.randomUUID();

        let newRelation = memberData.relation;
        let isDirectAncestor = true;

        if (memberData.parentIds.length > 0) {
            const parent = familyMembers[memberData.parentIds[0]];
            const selfMember = Object.values(familyMembers).find(m => m.relation === 'Self');

            const sideLineRelations = ['Brother', 'Sister', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin', 'Granduncle', 'Grandaunt', 'Great-Granduncle', 'Great-Grandaunt'];
            isDirectAncestor = !sideLineRelations.includes(parent.relation) && (parent.relation === 'Self' || parent.relation === 'Spouse' || parent.generation >= selfMember.generation);

            // Use the new helper function to get the correct relation
            newRelation = getRelationFromParent(parent.relation, memberData.relation, parent.generation);
        }

        const newMember = {
            id: newMemberId,
            name: memberData.name,
            relation: newRelation, // Use the new, correct relation
            parentIds: memberData.parentIds || [],
            spouseIds: [],
            generation: calculateGeneration(newRelation, memberData.parentIds, familyMembers),
            isDirectAncestor: isDirectAncestor
        };

        const updatedFamilyMembers = {
            ...familyMembers,
            [newMemberId]: newMember
        };

        try {
            const customerDocRef = doc(db, 'customers', customer.id);
            await updateDoc(customerDocRef, { familyMembers: updatedFamilyMembers });
        } catch (error) {
            console.error("Error adding family member:", error);
        }
    };

    const handleAddEvent = async (eventData) => {
        setIsAddingEvent(false);
        const updatedEvents = [...(customer.events || []), eventData];
        try {
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
                        <button onClick={() => setIsAddingMember(prev => !prev)}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm">
                            {isAddingMember ? 'Cancel' : 'Add Member'}
                        </button>
                    </div>
                    {isAddingMember && <AddFamilyMemberForm onAdd={handleAddFamilyMember} familyMembers={customer.familyMembers || {}} />}
                    <FamilyTreeChart familyMembers={customer.familyMembers || {}} />
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

// Component to list upcoming events
const EventList = ({ events }) => {
    const upcomingEvents = events
        .map(event => ({
            ...event,
            date: new Date(event.date)
        }))
        .filter(event => event.date >= new Date())
        .sort((a, b) => a.date - b.date);
    return (
        <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                    No upcoming events.
                </div>
            ) : (
                <ul className="space-y-2">
                    {upcomingEvents.map((event, index) => (
                        <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                            <div className="flex-1">
                                <div className="text-gray-800 font-medium">{event.name}</div>
                                <div className="text-sm text-gray-500">{event.date.toDateString()}</div>
                                {event.personName && (
                                    <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


// Component to add a new event
const AddEventForm = ({ onAdd, familyMembers }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState(familyMembers[0]?.id || '');
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;
        const selectedPerson = familyMembers.find(member => member.id === selectedPersonId);

        const eventData = {
            id: crypto.randomUUID(),
            name,
            date,
            personId: selectedPerson.id,
            personName: selectedPerson.name,
            personRelation: selectedPerson.relation
        };
        onAdd(eventData);
        setName('');
        setDate('');
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <div>
                <label htmlFor="event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
                    Event for
                </label>
                <select
                    id="event-person"
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                >
                    {familyMembers.length === 0 ? (
                        <option value="" disabled>No family members to select</option>
                    ) : (
                        familyMembers.map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.relation})
                            </option>
                        ))
                    )}
                </select>
            </div>
            <div>
                <input
                    type="text"
                    placeholder="Event Name (e.g., Birthday)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                />
            </div>
            <div>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                />
            </div>
            <button
                onClick={handleSubmit}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition"
            >
                Add Event
            </button>
        </div>
    );
};