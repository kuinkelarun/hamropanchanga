import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { auth, signInWithGoogle, db } from './firebase';
import { SettingsProvider } from './contexts/SettingsContext';
import SettingsMenu from './components/SettingsMenu';
import LandingPage from './components/LandingPage';
import AdminEditCards from './components/AdminEditCards';
import AdminManagement from './components/AdminManagement';
import AdminTithisPage from './components/Admin/AdminTithisPage';
import AdminEventsPage from './components/Admin/AdminEventsPage';
import AdminCalendarPage from './components/Admin/AdminCalendarPage';
import AdminDataManagementPage from './components/Admin/AdminDataManagementPage';
import UserManagement from './components/UserManagement';
import TithiCalculatorPage from './components/TithiCalculatorPage';
import EmbeddedBuilderPage from './components/TreeBuilder/EmbeddedBuilderPage';
import TreeSelectionPage from './components/TreeBuilder/TreeSelectionPage';
import TreeDetailPage from './components/TreeBuilder/TreeDetailPage';
import { Trees } from './components/TreeBuilder/utils/firestoreTreeApi';
import { useUserPermissions } from './hooks/usePermissions';

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

function AppContent() {
    const navigate = useNavigate();
    
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [trees, setTrees] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [treeMembers, setTreeMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Use the new permissions hook
    useUserPermissions(user);

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
                setTrees([]);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load trees for current user
    useEffect(() => {
        const loadTrees = async () => {
            try {
                if (!user) { setTrees([]); return; }
                const all = await Trees.list(user.uid);
                setTrees((all || []).filter(t => !t.deleted));
            } catch (err) {
                console.error('Error loading trees:', err);
            }
        };
        loadTrees();
    }, [user]);

    // Load calendar events (including tree member events)
    useEffect(() => {
        if (!user) {
            setCalendarEvents([]);
            return;
        }

        const eventsCollection = collection(db, 'calendarEvents');
        const eventsQuery = query(eventsCollection, where('treeId', '!=', null));
        
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCalendarEvents(events);
        }, (error) => {
            console.error("Error fetching calendar events: ", error);
        });

        return () => unsubscribe();
    }, [user]);

    // Load tree members for all user's trees
    useEffect(() => {
        const loadTreeMembers = async () => {
            if (!user || !trees || trees.length === 0) {
                setTreeMembers([]);
                return;
            }

            try {
                const allMembers = [];
                for (const tree of trees) {
                    const membersRef = collection(db, 'trees', tree.id, 'members');
                    const membersSnapshot = await getDocs(membersRef);
                    const members = membersSnapshot.docs.map(doc => ({
                        id: doc.id,
                        treeId: tree.id,
                        ...doc.data()
                    }));
                    allMembers.push(...members);
                }
                setTreeMembers(allMembers);
            } catch (err) {
                console.error('Error loading tree members:', err);
            }
        };

        loadTreeMembers();
    }, [user, trees]);

    // --- HANDLERS ---
    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const handleBackToList = () => {
        navigate('/');
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
        // Save scroll position before navigating
        sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
        
        // Navigate to tree detail page
        if (event.treeId) {
            navigate(`/tree/${event.treeId}`);
        }
    };

    // Only tree member events
    const allEvents = calendarEvents.map(event => ({
        id: event.id,
        name: event.title,
        date: event.dateKey,
        personId: event.memberId,
        repetition: event.repetition || 'none',
        treeId: event.treeId
    }));
    
    const allFamilyMembers = treeMembers.map(member => ({
        id: member.id,
        name: member.name,
        relation: 'Tree Member'
    }));

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
                <Routes>
                    <Route path="/" element={
                        <LandingPage
                            user={user}
                            isAdmin={isAdmin}
                            trees={trees}
                            treeMembers={treeMembers}
                            events={allEvents}
                            familyMembers={allFamilyMembers}
                            onDoubleClickEvent={handleDoubleClickEvent}
                        />
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

                    <Route path="/admin/management/:tab" element={
                        <AdminManagement
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/admin/tithis" element={
                        <AdminTithisPage
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/admin/events" element={
                        <AdminEventsPage
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/admin/calendar" element={
                        <AdminCalendarPage
                            user={user}
                            isAdmin={isAdmin}
                            onBack={handleBackToList}
                        />
                    } />

                    <Route path="/admin/data-management" element={
                        <AdminDataManagementPage
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

                    <Route path="/trees" element={
                        <TreeSelectionPage
                            user={user}
                        />
                    } />

                    <Route path="/tree/:treeId" element={
                        <TreeDetailPage
                            user={user}
                        />
                    } />

                    <Route path="/builder/:customerId" element={
                        <div className="min-h-screen flex items-center justify-center bg-gray-100">
                            <div className="text-gray-600">This route is deprecated. Please use /trees instead.</div>
                        </div>
                    } />

                    {/* New embedded Tree Builder route backed by Firestore trees */}
                    <Route path="/builder" element={
                        <EmbeddedBuilderPage
                            user={user}
                        />
                    } />
                </Routes>
            </main>
        </div>
    );
}