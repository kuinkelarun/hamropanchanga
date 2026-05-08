// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your web app's Firebase configuration
// All values must be set via environment variables — see .env.example
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
// Use custom database ID if specified in environment, otherwise use default
const databaseId = process.env.REACT_APP_FIRESTORE_DATABASE_ID;
export const db = getFirestore(app, databaseId);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators only when explicitly opted in via REACT_APP_USE_EMULATOR=true
// (avoids hitting localhost:5001 when emulator is not running)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, "localhost", 5001);
}

// Helper: sign in with Google popup — exported so other components can reuse the same logic
export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Error signing in with Google', error);
        throw error;
    }
}

// Helper: create a new account with email + password, then send a verification email
export async function signUpWithEmail(email, password) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user);
    return user;
}

// Helper: sign in with email + password
export async function signInWithEmail(email, password) {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
}

// Helper: send a password reset email
export async function sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
}

// Helper: check which sign-in methods are registered for an email address.
// Used to detect when an email/password signup collides with an existing Google account.
export async function getSignInMethodsForEmail(email) {
    return fetchSignInMethodsForEmail(auth, email);
}

// Helper: link an email+password credential to the currently signed-in user.
// Called after a Google sign-in when the user previously had an email/password account
// under the same address — merges both providers under one Firebase UID.
export async function linkEmailCredential(user, email, password) {
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(user, credential);
}