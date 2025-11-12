import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { auth, signInWithGoogle } from './firebase';
import { SettingsProvider } from './contexts/SettingsContext';
import SettingsMenu from './components/SettingsMenu';
import { collection, query, where, onSnapshot, getDoc, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
// CustomerList is rendered inside LandingPage; App does not use it directly here
import CustomerDetail from './components/CustomerDetail';
import AddCustomerForm from './components/AddCustomerForm';
import LandingPage from './components/LandingPage';
import AdminEditCards from './components/AdminEditCards';
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

                // Check adminList collection in Firestore for admin status (no-cost server-side APIs required)
                try {
                    // First check adminList/{uid} doc existence (admin bootstrap: create this doc via Firestore console for initial admin)
                    const adminDocRef = doc(db, 'adminList', currentUser.uid);
                    const adminDocSnap = await getDoc(adminDocRef);
                    if (adminDocSnap.exists()) {
                        setIsAdmin(true);
                    } else {
                        // Optional: also check token claims if you used custom claims previously
                        try {
                            const idTokenResult = await getIdTokenResult(currentUser);
                            const tokenAdmin = !!(idTokenResult && idTokenResult.claims && idTokenResult.claims.admin);
                            if (tokenAdmin) {
                                setIsAdmin(true);
                            }
                        } catch (tErr) {
                            // ignore token errors and fallback to users doc
                        }

                        // Final fallback: check users/{uid}.role if present (useful for auditing or legacy data)
                        const userDocRef = doc(db, 'users', currentUser.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        setIsAdmin(userDocSnap.exists() && userDocSnap.data().role === 'admin');
                    }
                } catch (err) {
                    console.error('Error checking admin status:', err);
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
    const handleSelectCustomer = async (customer) => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
        setSelectedCustomer(customer);
        setView('details');
    };
    const requireAuthOrPrompt = async () => {
        if (!user) {
            try {
                await signInWithGoogle();
            } catch (err) {
                // ignore — sign-in helper already logs
            }
            return false;
        }
        return true;
    };

    const handleBackToList = () => {
        setSelectedCustomer(null);
        setView('list');
    };

    const handleAddCustomer = async () => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
        setView('add');
    };

    // Open customer details (legacy behavior)
    const handleEditCustomer = async (customer) => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
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

    const handleAdminEditCards = () => {
        setView('adminEditCards');
    };

    // --- RENDER ---
    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-gray-500 text-lg">Loading...</div>
        </div>;
    }

    // Do not force-navigation to Login; allow landing page to be public.
    // The Login UI is available via header button or the explicit /login route (Login component still exists).

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
        <SettingsProvider>
            <div className="min-h-screen bg-gray-100">
                <header className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white shadow-md">
                    <div />
                    <div>
                        {user ? (
                            <SettingsMenu 
                                user={user} 
                                onSignOut={handleSignOut} 
                                isAdmin={isAdmin}
                                onAdminEditCards={handleAdminEditCards}
                            />
                        ) : (
                            <button
                                onClick={async () => {
                                    try {
                                        await signInWithGoogle();
                                    } catch (err) {
                                        // logged in helper handles logging
                                    }
                                }}
                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md shadow-sm"
                            >
                                Login
                            </button>
                        )}
                    </div>
                </header>

                <main className="p-4">
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4" role="alert">{error}</div>}

                    {view === 'list' && (
                        <LandingPage
                            user={user}
                            customers={customers}
                            onSelectCustomer={handleSelectCustomer}
                            onAddCustomer={handleAddCustomer}
                            events={allEvents}
                            familyMembers={allFamilyMembers}
                            onDoubleClickEvent={handleDoubleClickEvent}
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

                    {view === 'adminEditCards' && (
                        <AdminEditCards
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    )}
                </main>
            </div>
        </SettingsProvider>
    );
}