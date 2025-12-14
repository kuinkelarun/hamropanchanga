import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { auth, signInWithGoogle, db } from './firebase';
import { SettingsProvider } from './contexts/SettingsContext';
import SettingsMenu from './components/SettingsMenu';
// CustomerList is rendered inside LandingPage; App does not use it directly here
import CustomerDetail from './components/CustomerDetail';
import AddCustomerForm from './components/AddCustomerForm';
import LandingPage from './components/LandingPage';
import AdminEditCards from './components/AdminEditCards';
import AdminManagement from './components/AdminManagement';
import UserManagement from './components/UserManagement';
import TithiCalculatorPage from './components/TithiCalculatorPage';
import { useUserPermissions } from './hooks/usePermissions';
import { PERMISSIONS } from './constants/roles';

// Tithi Calculator Button Component with visibility control
function TithiCalculatorButton({ onClick }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const fetchVisibility = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'siteSettings', 'block2'));
                if (settingsDoc.exists()) {
                    setVisible(settingsDoc.data().visible !== false);
                }
            } catch (error) {
                console.error('Error fetching Tithi Calculator menu visibility:', error);
            }
        };
        fetchVisibility();
    }, []);

    if (!visible) return null;

    return (
        <button
            onClick={onClick}
            className="text-sm text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg flex items-center gap-2 font-semibold"
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                transform: 'translateY(0)',
                transition: 'all 0.2s ease'
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Tithi Calculator
        </button>
    );
}

export default function App() {
    return (
        <SettingsProvider>
            <Router>
                <AppContent />
            </Router>
        </SettingsProvider>
    );
}

// Wrapper component to handle customer route with URL params
function CustomerDetailWrapper({ customers, selectedCustomer, onBack, onUpdate }) {
    const { customerId } = useParams();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If selectedCustomer is available, use it
        if (selectedCustomer && selectedCustomer.id === customerId) {
            setCustomer(selectedCustomer);
            setLoading(false);
            return;
        }

        // Check if customer is in the customers list
        const foundCustomer = customers.find(c => c.id === customerId);
        if (foundCustomer) {
            setCustomer(foundCustomer);
            setLoading(false);
            return;
        }

        // If not found, fetch from Firestore (for page refresh case)
        const fetchCustomer = async () => {
            try {
                const customerRef = doc(db, 'customers', customerId);
                const customerDoc = await getDoc(customerRef);
                
                if (customerDoc.exists()) {
                    setCustomer({ id: customerDoc.id, ...customerDoc.data() });
                } else {
                    console.error('Customer not found');
                }
            } catch (error) {
                console.error('Error fetching customer:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCustomer();
    }, [customerId, selectedCustomer, customers]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-600">Customer not found</div>
            </div>
        );
    }

    return <CustomerDetail customer={customer} onBack={onBack} onUpdate={onUpdate} />;
}

function AppContent() {
    const navigate = useNavigate();
    
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState(null);

    // Use the new permissions hook
    const { 
        hasPermission
    } = useUserPermissions(user);

    // --- HOOKS ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                // STEP 1: Check if user has a pending invitation and process it
                try {
                    const rawEmail = currentUser.email || '';
                    const lowerEmail = rawEmail.toLowerCase();
                    console.log('Processing potential invitation for', rawEmail, 'lower:', lowerEmail);

                    // Try both possible document IDs: lowercased email and raw email
                    const invitationRefs = [
                        doc(db, 'userInvitations', lowerEmail),
                        doc(db, 'userInvitations', rawEmail)
                    ];

                    let invitationSnap = null;
                    let invitationRefUsed = null;

                    for (const ref of invitationRefs) {
                        try {
                            const snap = await getDoc(ref);
                            if (snap.exists()) {
                                invitationSnap = snap;
                                invitationRefUsed = ref;
                                break;
                            }
                        } catch (readErr) {
                            // Log read error for diagnostics but continue to try other refs
                            console.warn('Invitation read attempt failed for', ref.path, readErr.code, readErr.message);
                        }
                    }

                    if (invitationSnap && invitationSnap.exists()) {
                        const invitationData = invitationSnap.data();
                        const isProcessed = invitationData.processed;
                        console.log('Found invitation doc (using):', invitationRefUsed.path, 'processed:', isProcessed, invitationData);

                        const userDocRef = doc(db, 'users', currentUser.uid);
                        
                        // Check if user document already exists
                        const existingUserDoc = await getDoc(userDocRef);
                        
                        // Create/update user document if it doesn't exist OR if invitation hasn't been processed yet
                        if (!existingUserDoc.exists() || !isProcessed) {
                            try {
                                if (existingUserDoc.exists()) {
                                    // Update existing user with invitation data
                                    await updateDoc(userDocRef, {
                                        email: currentUser.email,
                                        displayName: currentUser.displayName || invitationData.displayName || existingUserDoc.data().displayName || '',
                                        role: invitationData.role,
                                        permissions: invitationData.permissions,
                                        active: true,
                                        updatedAt: new Date().toISOString()
                                    });
                                    console.log('Updated existing user document with invitation data');
                                } else {
                                    // Create new user document
                                    await setDoc(userDocRef, {
                                        email: currentUser.email,
                                        displayName: currentUser.displayName || invitationData.displayName || '',
                                        role: invitationData.role,
                                        permissions: invitationData.permissions,
                                        active: true,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                    });
                                    console.log('Created new user document from invitation');
                                }

                                // If invited as admin, also add to adminList
                                if (invitationData.role === 'admin') {
                                    const adminDocRef = doc(db, 'adminList', currentUser.uid);
                                    const adminDocSnap = await getDoc(adminDocRef);
                                    if (!adminDocSnap.exists()) {
                                        await setDoc(adminDocRef, {
                                            email: currentUser.email,
                                            addedAt: new Date().toISOString()
                                        });
                                        console.log('Added user to adminList');
                                    }
                                }

                                // Mark invitation as processed (only if not already processed)
                                if (!isProcessed) {
                                    try {
                                        await updateDoc(invitationRefUsed, {
                                            processed: true,
                                            processedAt: new Date().toISOString(),
                                            processedUid: currentUser.uid
                                        });
                                        console.log('User invitation processed successfully for', currentUser.email);
                                    } catch (udErr) {
                                        console.error('Failed to mark invitation processed for', invitationRefUsed.path, udErr.code, udErr.message);
                                    }
                                }
                            } catch (userDocErr) {
                                console.error('Error creating/updating user document:', userDocErr);
                            }
                        } else {
                            console.log('User document already exists and invitation already processed for', rawEmail);
                        }
                    } else {
                        console.log('No invitation found for', rawEmail);
                    }
                } catch (err) {
                    console.error('Error processing user invitation:', err.code || err.message || err);
                }

                // STEP 2: Check adminList collection in Firestore for admin status (no-cost server-side APIs required)
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
        
        // Admins can see all customers (have viewAllCustomers permission)
        // Super Users and regular users can only see their own customers
        if (isAdmin || hasPermission(PERMISSIONS.VIEW_ALL_CUSTOMERS)) {
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
    }, [user, isAdmin, hasPermission]);

    // --- HANDLERS ---
    const handleSelectCustomer = async (customer) => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
        // Save current scroll position before navigating away
        sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
        setSelectedCustomer(customer);
        navigate(`/customer/${customer.id}`);
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
        navigate('/');
    };

    const handleAddCustomer = async () => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
        navigate('/add-customer');
    };

    // Open customer details (legacy behavior)
    const handleEditCustomer = async (customer) => {
        const ok = await requireAuthOrPrompt();
        if (!ok) return;
        // Prefer editing the basic customer fields on the AddCustomerForm page
        setSelectedCustomer(customer);
        navigate('/add-customer');
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
            navigate('/');
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
            // If the customer name is being updated, also update the "Self" member's name
            if (updatedData.name && selectedCustomer.familyMembers) {
                const updatedFamilyMembers = { ...selectedCustomer.familyMembers };
                // Find and update the Self member
                Object.keys(updatedFamilyMembers).forEach(memberId => {
                    if (updatedFamilyMembers[memberId].relation === 'Self') {
                        updatedFamilyMembers[memberId] = {
                            ...updatedFamilyMembers[memberId],
                            name: updatedData.name
                        };
                    }
                });
                await updateDoc(customerDocRef, { ...updatedData, familyMembers: updatedFamilyMembers });
            } else {
                await updateDoc(customerDocRef, { ...updatedData });
            }
            setSelectedCustomer(null);
            navigate('/');
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
        navigate('/admin/edit-cards');
    };

    const handleAdminManagement = () => {
        navigate('/admin/management');
    };

    const handleUserManagement = () => {
        navigate('/user-management');
    };

    const handleTithiCalculator = () => {
        navigate('/tithi-calculator');
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
        <div className="min-h-screen bg-gray-100">
            <header className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white shadow-md" role="banner">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200"
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
                        Home
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <TithiCalculatorButton onClick={handleTithiCalculator} />
                            <SettingsMenu 
                                user={user} 
                                onSignOut={handleSignOut} 
                                isAdmin={isAdmin}
                                onAdminEditCards={handleAdminEditCards}
                                onAdminManagement={handleAdminManagement}
                                onUserManagement={handleUserManagement}
                            />
                        </>
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

            <main role="main">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4" role="alert">{error}</div>}

                <Routes>
                    <Route path="/" element={
                        <LandingPage
                            user={user}
                            isAdmin={isAdmin}
                            customers={customers}
                            onSelectCustomer={handleSelectCustomer}
                            onAddCustomer={handleAddCustomer}
                            events={allEvents}
                            familyMembers={allFamilyMembers}
                            onDoubleClickEvent={handleDoubleClickEvent}
                            onEditCustomer={handleEditCustomer}
                            onDeleteCustomer={handleDeleteCustomer}
                        />
                    } />

                    <Route path="/customer/:customerId" element={
                        <CustomerDetailWrapper
                            customers={customers}
                            selectedCustomer={selectedCustomer}
                            onBack={handleBackToList}
                            onUpdate={handleUpdateCustomer}
                        />
                    } />

                    <Route path="/add-customer" element={
                        <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                            <AddCustomerForm
                                initialData={selectedCustomer}
                                onAddSuccess={handleAddCustomerSuccess}
                                onUpdateSuccess={handleUpdateCustomer}
                                onCancel={handleBackToList}
                            />
                        </div>
                    } />

                    <Route path="/admin/edit-cards" element={
                        <AdminEditCards
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/admin/management" element={
                        <AdminManagement
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/user-management" element={
                        <UserManagement
                            currentUser={user}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/tithi-calculator" element={
                        <TithiCalculatorPage
                            onBack={handleBackToList}
                        />
                    } />
                </Routes>
            </main>
        </div>
    );
}