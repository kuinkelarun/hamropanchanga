// src/Login.js
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export default function Login() {
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-2xl shadow-lg text-center">
        <h1 className="text-3xl font-bold mb-6">Welcome to Family Tree CRM</h1>
        <p className="text-gray-600 mb-8">Please sign in to continue.</p>
        <button
          onClick={handleGoogleSignIn}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105"
        >
          Sign In with Google
        </button>
        {/* Phone sign-in button can be added here later */}
      </div>
    </div>
  );
}