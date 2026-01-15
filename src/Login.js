// src/Login.js
import { signInWithGoogle } from './firebase';
import { useLanguage } from './contexts/LanguageContext';

export default function Login() {
  const { t } = useLanguage();
  
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      // already logged in by helper; log for debug
      console.error("Error signing in with Google", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-2xl shadow-lg text-center">
        <h1 className="text-3xl font-bold mb-6">{t('login.welcome')}</h1>
        <p className="text-gray-600 mb-8">{t('login.pleaseSignIn')}</p>
        <button
          onClick={handleGoogleSignIn}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105"
        >
          {t('auth.signInWithGoogle')}
        </button>
        {/* Phone sign-in button can be added here later */}
      </div>
    </div>
  );
}