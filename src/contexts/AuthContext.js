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
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  isLoading: true,
  needsEmailVerification: false,
  setNeedsEmailVerification: () => {},
  needsPhone: false,
  skipPhone: false,
  setSkipPhone: () => {},
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
    doc(db, COLLECTIONS.USER_INVITATIONS, lowerEmail),
    doc(db, COLLECTIONS.USER_INVITATIONS, rawEmail),
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

    const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
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
        const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, currentUser.uid);
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
    const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
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
 * Auto-claim any pending WhatsApp invitations where the signed-in user's email
 * matches the hintEmail on the invitation. This handles the case where a user
 * signs up after receiving a WhatsApp invitation but doesn't use the invite link.
 */
async function autoClaimPendingInvitations(currentUser) {
  const email = (currentUser.email || '').toLowerCase();
  if (!email) return;

  try {
    const invRef = collection(db, 'invitations');
    const q = query(invRef,
      where('hintEmail', '==', email),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const claimFn = httpsCallable(getFunctions(), 'claimInvitation');
    await Promise.allSettled(
      snap.docs.map((d) => claimFn({ invitationId: d.id }))
    );
    console.log(`[AuthContext] Auto-claimed ${snap.docs.length} pending invitation(s) for ${email}`);
  } catch (err) {
    // Non-fatal — invitation claiming failures shouldn't block sign-in
    console.warn('[AuthContext] Auto-claim invitations failed:', err.message);
  }
}

/**
 * Determine whether the current user is an admin.
 * Check order: adminList/{uid} → token custom claims → users/{uid}.role
 */
async function checkAdminStatus(currentUser) {
  // Check adminList/{uid}
  const adminDocRef = doc(db, COLLECTIONS.ADMIN_LIST, currentUser.uid);
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
  const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  return userDocSnap.exists() && userDocSnap.data().role === 'admin';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // True only for email/password accounts that haven't verified their address yet.
  // Google accounts are always considered verified.
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  // True when the user is signed in, verified, but hasn't added a phone number yet.
  const [needsPhone, setNeedsPhone] = useState(false);
  const [skipPhone, setSkipPhoneState] = useState(
    () => sessionStorage.getItem('skipPhone') === 'true'
  );
  const setSkipPhone = (val) => {
    if (val) sessionStorage.setItem('skipPhone', 'true');
    else sessionStorage.removeItem('skipPhone');
    setSkipPhoneState(val);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Flag email/password users who haven't verified their address yet.
        // Google-linked accounts always have emailVerified = true.
        const isEmailPasswordUser = currentUser.providerData?.some(
          (p) => p.providerId === 'password'
        );
        const unverified = isEmailPasswordUser && !currentUser.emailVerified;
        setNeedsEmailVerification(unverified);

        // Check if the user still needs to add a phone number.
        // Only check after email is verified to avoid a race with the verification gate.
        if (!unverified) {
          try {
            const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            const hasPhone = userDocSnap.exists() && !!userDocSnap.data().phoneNumber;
            setNeedsPhone(!hasPhone);
          } catch (_phoneCheckErr) {
            setNeedsPhone(false);
          }
        } else {
          setNeedsPhone(false);
        }

        // Process invitation (non-blocking for UI but must finish before admin check)
        try {
          await processInvitation(currentUser);
        } catch (err) {
          console.error('Error processing user invitation:', err.code || err.message || err);
        }

        // Auto-claim any pending WhatsApp invitations for this email
        autoClaimPendingInvitations(currentUser).catch(() => {});

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
        setNeedsEmailVerification(false);
        setNeedsPhone(false);
        setSkipPhone(false);
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
    <AuthContext.Provider value={{ user, isAdmin, isLoading, needsEmailVerification, setNeedsEmailVerification, needsPhone, setNeedsPhone, skipPhone, setSkipPhone, logout }}>
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
