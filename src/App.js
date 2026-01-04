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
            className="group flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-purple-600 font-medium transition-all duration-200 rounded-full hover:bg-purple-50"
        >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Tithi Calculator</span>
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
    
    // Smart home button state
    const [lastLogoClickTime, setLastLogoClickTime] = useState(null);
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);

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
        if (!user) { setTrees([]); return; }

        const colRef = collection(db, 'trees');
        let qRef = colRef;
        
        // If not admin, filter by ownerUid
        if (!isAdmin) {
            qRef = query(colRef, where('ownerUid', '==', user.uid));
        }

        const unsubscribe = onSnapshot(qRef, (snapshot) => {
            const allTrees = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTrees(allTrees.filter(t => !t.deleted));
        }, (error) => {
            console.error('Error listening to trees:', error);
        });

        return () => unsubscribe();
    }, [user, isAdmin]);

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

    // Track scroll position when navigating away from home page
    useEffect(() => {
        // Listen for scroll changes
        const handleScroll = () => {
            setSavedScrollPosition(window.scrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Smart home button handler
    const handleLogoClick = () => {
        const now = Date.now();
        const doubleClickWindow = 500; // 500ms window for double-click

        // Check if this is a double-click (within 500ms)
        if (lastLogoClickTime && (now - lastLogoClickTime) < doubleClickWindow) {
            // Double-click: go to home and scroll to top
            navigate('/');
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 0);
            setLastLogoClickTime(null);
        } else {
            // First click: go to home and restore last scroll position
            navigate('/');
            setTimeout(() => {
                window.scrollTo({ top: savedScrollPosition, behavior: 'smooth' });
            }, 0);
            setLastLogoClickTime(now);
        }
    };

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
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm" role="banner">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo Section */}
                        <div className="flex-shrink-0 flex items-center cursor-pointer group" onClick={handleLogoClick}>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:from-purple-600 group-hover:to-blue-600 transition-all duration-300 pl-2">
                                FamilyTree
                            </span>
                        </div>

                        {/* Navigation Section */}
                        <div className="flex items-center gap-2 sm:gap-4">
                            {user ? (
                                <>
                                    {/* Desktop: Full button with text */}
                                    <div className="hidden sm:block">
                                        <TithiCalculatorButton onClick={handleTithiCalculator} />
                                    </div>
                                    {/* Mobile: Icon-only button */}
                                    <button
                                        onClick={handleTithiCalculator}
                                        className="sm:hidden p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-200"
                                        title="Tithi Calculator"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <div className="pl-2 border-l border-gray-200 ml-2">
                                        <SettingsMenu 
                                            user={user} 
                                            onSignOut={handleSignOut} 
                                            isAdmin={isAdmin}
                                            onAdminEditCards={handleAdminEditCards}
                                            onAdminManagement={handleAdminManagement}
                                            onUserManagement={handleUserManagement}
                                        />
                                    </div>
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
                                    className="text-sm font-medium bg-gray-900 text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    </div>
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
                            isAdmin={isAdmin}
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