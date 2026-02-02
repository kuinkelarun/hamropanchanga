import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { auth, signInWithGoogle, db } from './firebase';
import { SettingsProvider } from './contexts/SettingsContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import SettingsMenu from './components/SettingsMenu';
import LanguageSelector from './components/LanguageSelector';
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
import { useUserPermissions } from './hooks/usePermissions';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from './constants/roles';
import { convertAdToBs, convertBsToAd, getTithiIndexByName, getTithiLunarMonthName } from './utils/nepaliDateUtils';

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
        <LanguageProvider>
            <SettingsProvider>
                <Router>
                    <AppContent />
                </Router>
            </SettingsProvider>
        </LanguageProvider>
    );
}

function AppContent() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    
    // STATE MANAGEMENT
    const [user, setUser] = useState(null);
    const [trees, setTrees] = useState([]);
    const [treeCalendarEvents, setTreeCalendarEvents] = useState([]);
    const [personalCalendarEvents, setPersonalCalendarEvents] = useState([]);
    const [treeMembers, setTreeMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const hamburgerButtonRef = useRef(null);
    const mobileMenuPanelRef = useRef(null);
    
    // Smart home button state
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);

    // Use the new permissions hook
    useUserPermissions(user);

    const isHomePage = location.pathname === '/';

    const getHeaderPageName = (pathname) => {
        if (pathname === '/' || !pathname) return '';
        if (pathname.startsWith('/tithi-calculator')) return 'Tithi Calculator';
        if (pathname.startsWith('/trees')) return 'Tree View';
        if (pathname.startsWith('/tree/')) return 'Tree';
        if (pathname.startsWith('/admin/edit-cards')) return 'Admin';
        if (pathname.startsWith('/admin/management')) return 'Admin';
        if (pathname.startsWith('/admin/tithis')) return 'Admin';
        if (pathname.startsWith('/admin/events')) return 'Admin';
        if (pathname.startsWith('/admin/calendar')) return 'Admin';
        if (pathname.startsWith('/admin/data-management')) return 'Admin';
        if (pathname.startsWith('/user-management')) return 'User Management';
        if (pathname.startsWith('/builder')) return 'Builder';

        const clean = pathname.replace(/^\//, '').split('/')[0] || '';
        return clean
            ? clean
                .split('-')
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(' ')
            : '';
    };

    const headerPageName = getHeaderPageName(location.pathname);

    const handleBrandClick = () => {
        // User requested a hard refresh when returning home.
        if (location.pathname === '/') {
            window.location.reload();
            return;
        }
        window.location.href = '/';
    };

    const handleBreadcrumbClick = () => {
        // Breadcrumb represents the CURRENT page; clicking should refresh.
        window.location.reload();
    };

    // Close menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Close menu on outside click; also scroll to top
    useEffect(() => {
        if (!mobileMenuOpen) return undefined;

        const onPointerDown = (event) => {
            const target = event.target;
            const menuEl = mobileMenuPanelRef.current;
            const buttonEl = hamburgerButtonRef.current;

            const clickedInsideMenu = menuEl && menuEl.contains(target);
            const clickedHamburgerButton = buttonEl && buttonEl.contains(target);

            if (!clickedInsideMenu && !clickedHamburgerButton) {
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [mobileMenuOpen]);

    // --- HOOKS ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                // STEP 1: Check if user has a pending invitation and process it
                try {
                    const rawEmail = currentUser.email || '';
                    const lowerEmail = rawEmail.toLowerCase();
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Processing potential invitation for signed-in user');
                    }

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
                            if (process.env.NODE_ENV !== 'production') {
                                console.warn('Invitation read attempt failed for', ref.path, readErr.code, readErr.message);
                            }
                        }
                    }

                    if (invitationSnap && invitationSnap.exists()) {
                        const invitationData = invitationSnap.data();
                        const isProcessed = invitationData.processed;
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Found invitation doc (using):', invitationRefUsed.path, 'processed:', isProcessed);
                        }

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
                                    if (process.env.NODE_ENV !== 'production') {
                                        console.log('Updated existing user document with invitation data');
                                    }
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
                                    if (process.env.NODE_ENV !== 'production') {
                                        console.log('Created new user document from invitation');
                                    }
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
                                        if (process.env.NODE_ENV !== 'production') {
                                            console.log('Added user to adminList');
                                        }
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
                                        if (process.env.NODE_ENV !== 'production') {
                                            console.log('User invitation processed successfully');
                                        }
                                    } catch (udErr) {
                                        console.error('Failed to mark invitation processed for', invitationRefUsed.path, udErr.code, udErr.message);
                                    }
                                }
                            } catch (userDocErr) {
                                console.error('Error creating/updating user document:', userDocErr);
                            }
                        } else {
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('User document already exists and invitation already processed');
                            }
                        }
                    } else {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('No invitation found for signed-in user');
                        }
                        // User signed in without invitation - create default user document
                        try {
                            const userDocRef = doc(db, 'users', currentUser.uid);
                            const existingUserDoc = await getDoc(userDocRef);
                            
                            if (!existingUserDoc.exists()) {
                                if (process.env.NODE_ENV !== 'production') {
                                    console.log('Creating default user document for signed-in user');
                                }
                                await setDoc(userDocRef, {
                                    email: currentUser.email,
                                    displayName: currentUser.displayName || '',
                                    role: USER_ROLES.USER,
                                    permissions: DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER],
                                    active: true,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                });
                                if (process.env.NODE_ENV !== 'production') {
                                    console.log('Successfully created default user document');
                                }
                            }
                        } catch (defaultUserErr) {
                            console.error('Error creating default user document:', defaultUserErr);
                        }
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

    // Load calendar events for the landing-page feed:
    // - tree-linked events (treeId != null)
    // - user's own private calendar events (treeId == null)
    useEffect(() => {
        if (!user) {
            setTreeCalendarEvents([]);
            setPersonalCalendarEvents([]);
            return;
        }

        const eventsCollection = collection(db, 'calendarEvents');
        
        // FIX: Regular users cannot query ALL tree events because some might be private to other users.
        // We must restrict the query to what the user is allowed to see.
        // Since we can't easily do "OR" queries (public OR mine) in a single listener without composite indexes,
        // we'll fetch based on the user's role.
        
        let treeEventsQuery;
        if (isAdmin) {
            // Admins can see all tree-linked events
            treeEventsQuery = query(eventsCollection, where('treeId', '!=', null));
        } else {
            // Avoid `treeId != null` + `createdBy == uid` which requires a composite index.
            // Fetch the user's events and keep only tree-linked ones client-side.
            treeEventsQuery = query(eventsCollection, where('createdBy', '==', user.uid));
        }

        // User's own private events (includes calendar day-card private events).
        // Avoid relying on `treeId == null` since the field can be missing.
        const personalEventsQuery = query(
            eventsCollection,
            where('createdBy', '==', user.uid),
            where('isPublic', '==', false)
        );

        const unsubscribeTree = onSnapshot(treeEventsQuery, (snapshot) => {
            const events = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter((e) => !!e.treeId);

            setTreeCalendarEvents(events);
        }, (error) => {
            console.error("Error fetching tree calendar events: ", error);
        });

        const unsubscribePersonal = onSnapshot(personalEventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPersonalCalendarEvents(events);
        }, (error) => {
            console.error("Error fetching personal calendar events: ", error);
        });

        return () => {
            unsubscribeTree();
            unsubscribePersonal();
        };
    }, [user, isAdmin]);

    // Load tree members for all user's trees (realtime)
    useEffect(() => {
        if (!user || !trees || trees.length === 0) {
            setTreeMembers([]);
            return;
        }

        const unsubs = [];
        const byTreeId = new Map();

        const publish = () => {
            const merged = [];
            byTreeId.forEach((members) => {
                merged.push(...members);
            });
            setTreeMembers(merged);
        };

        trees.forEach((tree) => {
            const membersRef = collection(db, 'trees', tree.id, 'members');
            const unsub = onSnapshot(
                membersRef,
                (snap) => {
                    const members = snap.docs.map((docSnap) => ({
                        id: docSnap.id,
                        treeId: tree.id,
                        ...docSnap.data(),
                    }));
                    byTreeId.set(tree.id, members);
                    publish();
                },
                (err) => {
                    console.error('Error loading tree members:', err);
                }
            );
            unsubs.push(unsub);
        });

        return () => {
            unsubs.forEach((u) => {
                try {
                    u();
                } catch (e) {
                    // ignore
                }
            });
        };
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
        const isOnHomePage = location.pathname === '/';

        if (isOnHomePage) {
            // Already on home page: scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Not on home page: navigate to home and restore scroll position
            navigate('/');
            setTimeout(() => {
                window.scrollTo({ top: savedScrollPosition, behavior: 'smooth' });
            }, 0);
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
        signOut(auth)
            .then(() => {
                // Redirect to home page after successful logout
                navigate('/');
            })
            .catch((error) => {
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
        setMobileMenuOpen(false);
    };

    const handleNepaliCalendarClick = () => {
        if (location.pathname !== '/') {
            navigate('/');
            // Wait for navigation, then scroll
            setTimeout(() => {
                const calendarSection = document.getElementById('nepali-calendar-section');
                if (calendarSection) {
                    calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        } else {
            const calendarSection = document.getElementById('nepali-calendar-section');
            if (calendarSection) {
                calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        setMobileMenuOpen(false);
    };

    const handleTreeViewClick = () => {
        navigate('/trees');
        setMobileMenuOpen(false);
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
        
        // Navigate to tree detail page with event ID to highlight
        if (event.treeId) {
            navigate(`/tree/${event.treeId}`, { state: { highlightEventId: event.id } });
        }
    };

    const handleEventClick = (event) => {
        // Save scroll position before navigating
        sessionStorage.setItem('landingPageScrollPosition', window.scrollY.toString());
        
        // Navigate to tree detail page with event ID to highlight
        if (event.treeId) {
            navigate(`/tree/${event.treeId}`, { state: { highlightEventId: event.id } });
        }
    };

    const mergedCalendarEventsById = new Map();
    [...treeCalendarEvents, ...personalCalendarEvents].forEach((event) => {
        if (event?.id) mergedCalendarEventsById.set(event.id, event);
    });

    // Events for LandingPageEventsSection
    const allEvents = Array.from(mergedCalendarEventsById.values()).map(event => ({
        id: event.id,
        name: event.title,
        date: event.dateKey,
        dateKey: event.dateKey,
        personId: event.memberId || event.personId || '',
        repetition: event.repetition || 'none',
        treeId: event.treeId || null,
        tithi: event.tithi || null
    }));
    
    const getCreatedAtMillis = (createdAt) => {
        if (!createdAt) return Number.POSITIVE_INFINITY;
        // Firestore Timestamp
        if (typeof createdAt === 'object' && createdAt.seconds != null) {
            const seconds = Number(createdAt.seconds) || 0;
            const nanos = Number(createdAt.nanoseconds) || 0;
            return seconds * 1000 + Math.floor(nanos / 1e6);
        }
        // ISO string or Date-parsable
        const ms = new Date(createdAt).getTime();
        return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };

    const derivedPrimaryMemberByTreeId = new Map();
    (treeMembers || []).forEach((m) => {
        if (!m?.treeId || !m?.name) return;
        const ms = getCreatedAtMillis(m.createdAt);
        const existing = derivedPrimaryMemberByTreeId.get(m.treeId);
        if (!existing || ms < existing.ms) {
            derivedPrimaryMemberByTreeId.set(m.treeId, { name: m.name, ms });
        }
    });

    const treePrimaryMemberNameById = new Map();
    (trees || []).forEach((t) => {
        const fromTree = (t.primaryMemberName || '').trim();
        const fromMembers = (derivedPrimaryMemberByTreeId.get(t.id)?.name || '').trim();
        treePrimaryMemberNameById.set(t.id, fromTree || fromMembers || 'Tree Member');
    });

    const allFamilyMembers = treeMembers.map(member => ({
        id: member.id,
        name: member.name,
        relation: treePrimaryMemberNameById.get(member.treeId) || 'Tree Member',
        treeId: member.treeId,
    }));

    return (
        <div className="min-h-screen bg-gray-50">
            <header
                className={
                    !isHomePage
                        ? 'sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm'
                        : mobileMenuOpen
                            ? 'relative z-50 bg-white border-b border-gray-200 shadow-sm'
                            : 'sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm'
                }
                role="banner"
            >
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        {/* Left Section: Hamburger (mobile) + Logo */}
                        <div className="flex items-center gap-3">
                            {/* Hamburger Menu Button - Mobile Only */}
                            {isHomePage && (
                                <button
                                    ref={hamburgerButtonRef}
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-all duration-200"
                                    aria-label="Toggle menu"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {mobileMenuOpen ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        )}
                                    </svg>
                                </button>
                            )}

                            {/* Logo */}
                            <div className="flex-shrink-0 flex items-center">
                                <button
                                    type="button"
                                    onClick={handleBrandClick}
                                    className="brand-link"
                                    aria-label="Go to home"
                                >
                                    FamilyTree
                                </button>
                                {!isHomePage && headerPageName ? (
                                    <>
                                        <span className="mx-2 text-gray-400">|</span>
                                        <button
                                            type="button"
                                            onClick={handleBreadcrumbClick}
                                            className="breadcrumb-title"
                                            aria-label={`Refresh ${headerPageName}`}
                                        >
                                            {headerPageName}
                                        </button>
                                    </>
                                ) : null}
                            </div>

                            {/* Desktop Navigation Menu (home only) */}
                            {isHomePage && (
                                <nav className="hidden lg:flex items-center gap-1 ml-6">
                                    <button
                                        onClick={handleNepaliCalendarClick}
                                        className="nav-menu-item"
                                    >
                                        <span className="nav-menu-text">Nepali Calendar</span>
                                    </button>
                                    <button
                                        onClick={handleTithiCalculator}
                                        className="nav-menu-item"
                                    >
                                        <span className="nav-menu-text">Tithi Calculator</span>
                                    </button>
                                    <button
                                        onClick={handleTreeViewClick}
                                        className="nav-menu-item"
                                    >
                                        <span className="nav-menu-text">Tree View</span>
                                    </button>
                                </nav>
                            )}
                        </div>

                        {/* Right Section: Language Selector + Sign In/Settings */}
                        <div className="flex items-center gap-3">
                            <LanguageSelector compact={true} />
                            {user ? (
                                <div className="border-l border-gray-200 pl-3">
                                    <SettingsMenu 
                                        user={user} 
                                        onSignOut={handleSignOut} 
                                        isAdmin={isAdmin}
                                        onAdminEditCards={handleAdminEditCards}
                                        onAdminManagement={handleAdminManagement}
                                        onUserManagement={handleUserManagement}
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={async () => {
                                        try {
                                            await signInWithGoogle();
                                        } catch (err) {
                                            // logged in helper handles logging
                                        }
                                    }}
                                    className="flex items-center gap-2 text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 transition-all"
                                >
                                    {t('auth.signIn')}
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Menu (dropdown attached to header; does not push content) */}
                {isHomePage && mobileMenuOpen && (
                    <div
                        ref={mobileMenuPanelRef}
                        className="absolute left-0 right-0 top-full z-50 bg-white border-b border-gray-200 shadow-lg lg:hidden"
                    >
                        <nav className="flex flex-col items-start px-4 py-3 gap-2">
                            <button
                                onClick={handleNepaliCalendarClick}
                                className="mobile-nav-item"
                            >
                                Nepali Calendar
                            </button>
                            <button
                                onClick={handleTithiCalculator}
                                className="mobile-nav-item"
                            >
                                Tithi Calculator
                            </button>
                            <button
                                onClick={handleTreeViewClick}
                                className="mobile-nav-item"
                            >
                                Tree View
                            </button>
                        </nav>
                    </div>
                )}
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
                            onEventClick={handleEventClick}
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
                            isAdmin={isAdmin}
                        />
                    } />
                </Routes>
            </main>
        </div>
    );
}