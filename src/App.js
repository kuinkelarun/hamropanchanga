import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import { collection, query, where, onSnapshot, getDoc, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
// CustomerList is rendered inside LandingPage; App does not use it directly here
import CustomerDetail from './components/CustomerDetail';
import AddCustomerForm from './components/AddCustomerForm';
import LandingPage from './components/LandingPage';
import { deleteDoc } from 'firebase/firestore';

export default function App() {
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [view, setView] = useState('list');
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState(null);

    // --- HOOKS ---
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

    // Open customer details (legacy behavior)
    const handleEditCustomer = (customer) => {
        // Prefer editing the basic customer fields on the AddCustomerForm page
        setSelectedCustomer(customer);
        setView('add');
    };

    const handleDeleteCustomer = async (customer) => {
        const ok = window.confirm(`Delete customer "${customer.name}"? This will remove all their data.`);
        if (!ok) return;
        try {
            await deleteDoc(doc(db, 'customers', customer.id));
        } catch (error) {
            console.error('Error deleting customer', error);
            setError('Failed to delete customer.');
        }
    };

    const handleAddCustomerSuccess = async (newCustomerData) => {
        try {
            const customerCollectionRef = collection(db, 'customers');
            await addDoc(customerCollectionRef, { ...newCustomerData, userId: user.uid });
            setView('list');
        } catch (error) {
            console.error("Error adding customer:", error);
            setError("Failed to add new customer.");
        }
    };

    const handleUpdateCustomer = async (updatedData) => {
        if (!selectedCustomer || !selectedCustomer.id) {
            setError('No customer selected for update.');
            return;
        }
        try {
            const customerDocRef = doc(db, 'customers', selectedCustomer.id);

            // If the update contains events or familyMembers, it's coming from the CustomerDetail
            // and we should stay on the customer's detail view.
            const isDetailUpdate = updatedData && (updatedData.events || updatedData.familyMembers);

            if (isDetailUpdate) {
                // Only update the nested collections provided to avoid overwriting other fields.
                const fieldsToUpdate = {};
                if (updatedData.events) fieldsToUpdate.events = updatedData.events;
                if (updatedData.familyMembers) fieldsToUpdate.familyMembers = updatedData.familyMembers;
                // Apply partial update and keep selected customer
                await updateDoc(customerDocRef, fieldsToUpdate);
                // Update selected customer in state so detail page shows fresh data
                setSelectedCustomer(prev => ({ ...prev, ...fieldsToUpdate }));
                return;
            }

            // Otherwise treat as a top-level edit (name/contact/location) and return to the list after saving
            await updateDoc(customerDocRef, { ...updatedData });
            setSelectedCustomer(null);
            setView('list');
        } catch (error) {
            console.error('Error updating customer', error);
            setError('Failed to update customer.');
        }
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

    const handleDoubleClickEvent = (event) => {
    // Find the customer who owns this event's personId
    const customer = customers.find(c => {
        if (!c.familyMembers) return false;
        return Object.values(c.familyMembers).some(member => member.id === event.personId);
    });

    if (customer) {
        handleSelectCustomer(customer);
    }
    };

    // Combine all events and family members from all customers
    const allEvents = customers.flatMap(customer => customer.events || []);
    const allFamilyMembers = customers.flatMap(customer => Object.values(customer.familyMembers || {}));

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="flex justify-between items-center mb-6">
                {/* <h1 className="text-4xl font-extrabold text-gray-900">Family Tree Management</h1> */}
                <div> </div>
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
                <LandingPage
                    user={user}
                    customers={customers}
                    onSelectCustomer={handleSelectCustomer}
                    onAddCustomer={handleAddCustomer}
                    events={allEvents} // Pass the combined list of events
                    familyMembers={allFamilyMembers} // Pass the combined list of family members
                    onDoubleClickEvent={handleDoubleClickEvent} // Pass the new handler here
                    onEditCustomer={handleEditCustomer}
                    onDeleteCustomer={handleDeleteCustomer}
                />
            )}

            {view === 'details' && selectedCustomer && (
                <CustomerDetail
                    customer={customers.find(c => c.id === selectedCustomer.id) || selectedCustomer}
                    onBack={handleBackToList}
                    onUpdate={handleUpdateCustomer}
                />
            )}

            {view === 'add' && (
                <AddCustomerForm
                    initialData={selectedCustomer}
                    onAddSuccess={handleAddCustomerSuccess}
                    onUpdateSuccess={handleUpdateCustomer}
                    onCancel={handleBackToList}
                />
            )}
        </div>
    );
}