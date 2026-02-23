/**
 * AuthContext.js
 *
 * Provides authentication state and admin status to the entire app
 * via React Context, eliminating the need to prop-drill `user` and `isAdmin`.
 *
 * Extracted from the monolithic onAuthStateChanged handler in App.js.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  isLoading: true,
  logout: async () => {},
});

/**
 * Process a pending user invitation when a user signs in.
 * Creates or updates the users/{uid} document based on invitation data.
 */
async function processInvitation(currentUser) {
  const rawEmail = currentUser.email || '';
  const lowerEmail = rawEmail.toLowerCase();

  // Try both possible document IDs: lowercased email and raw email
  const invitationRefs = [
    doc(db, 'userInvitations', lowerEmail),
    doc(db, 'userInvitations', rawEmail),
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
    } catch (_readErr) {
      // Continue to try the next ref
    }
  }

  if (invitationSnap && invitationSnap.exists()) {
    const invitationData = invitationSnap.data();
    const isProcessed = invitationData.processed;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const existingUserDoc = await getDoc(userDocRef);

    // Create/update user document if it doesn't exist OR if invitation hasn't been processed yet
    if (!existingUserDoc.exists() || !isProcessed) {
      if (existingUserDoc.exists()) {
        await updateDoc(userDocRef, {
          email: currentUser.email,
          displayName: currentUser.displayName || invitationData.displayName || existingUserDoc.data().displayName || '',
          role: invitationData.role,
          permissions: invitationData.permissions,
          active: true,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await setDoc(userDocRef, {
          email: currentUser.email,
          displayName: currentUser.displayName || invitationData.displayName || '',
          role: invitationData.role,
          permissions: invitationData.permissions,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // If invited as admin, also add to adminList
      if (invitationData.role === 'admin') {
        const adminDocRef = doc(db, 'adminList', currentUser.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (!adminDocSnap.exists()) {
          await setDoc(adminDocRef, {
            email: currentUser.email,
            addedAt: new Date().toISOString(),
          });
        }
      }

      // Mark invitation as processed
      if (!isProcessed) {
        try {
          await updateDoc(invitationRefUsed, {
            processed: true,
            processedAt: new Date().toISOString(),
            processedUid: currentUser.uid,
          });
        } catch (udErr) {
          console.error('Failed to mark invitation processed:', udErr.code, udErr.message);
        }
      }
    }
  } else {
    // No invitation — create default user document
    const userDocRef = doc(db, 'users', currentUser.uid);
    const existingUserDoc = await getDoc(userDocRef);

    if (!existingUserDoc.exists()) {
      await setDoc(userDocRef, {
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        role: USER_ROLES.USER,
        permissions: DEFAULT_ROLE_PERMISSIONS[USER_ROLES.USER],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Determine whether the current user is an admin.
 * Check order: adminList/{uid} → token custom claims → users/{uid}.role
 */
async function checkAdminStatus(currentUser) {
  // Check adminList/{uid}
  const adminDocRef = doc(db, 'adminList', currentUser.uid);
  const adminDocSnap = await getDoc(adminDocRef);
  if (adminDocSnap.exists()) return true;

  // Fallback: check token claims
  try {
    const idTokenResult = await getIdTokenResult(currentUser);
    if (idTokenResult?.claims?.admin) return true;
  } catch (_tErr) {
    // ignore token errors
  }

  // Final fallback: check users/{uid}.role
  const userDocRef = doc(db, 'users', currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  return userDocSnap.exists() && userDocSnap.data().role === 'admin';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Process invitation (non-blocking for UI but must finish before admin check)
        try {
          await processInvitation(currentUser);
        } catch (err) {
          console.error('Error processing user invitation:', err.code || err.message || err);
        }

        // Check admin status
        try {
          const adminResult = await checkAdminStatus(currentUser);
          setIsAdmin(adminResult);
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from any component.
 * 
 * @returns {{ user: import('firebase/auth').User | null, isAdmin: boolean, isLoading: boolean, logout: () => Promise<void> }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
