// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your web app's Firebase configuration
// Uses environment variables to support multiple projects (old: family-tree-crm, new: hamropanchanga)
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCXGSkSwyKJa8bcPsHO0ZqcjkeiwnaJaXE",
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "hamropanchanga.firebaseapp.com",
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "hamropanchanga",
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "hamropanchanga.firebasestorage.app",
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "731963474318",
    appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:731963474318:web:aca4b6176a901ad1d9e4df",
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-PBXQT4DW3R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
// Use custom database ID if specified in environment, otherwise use default
const databaseId = process.env.REACT_APP_FIRESTORE_DATABASE_ID || 'hamropanchanga-db';
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