// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC7efS6Z_S3VGreV1jp6NHD7R_MADi5I44",
    authDomain: "family-tree-crm.firebaseapp.com",
    projectId: "family-tree-crm",
    storageBucket: "family-tree-crm.firebasestorage.app",
    messagingSenderId: "598903597042",
    appId: "1:598903597042:web:dceef91c35b6880df0ed6b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

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