import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import FullLogo from './FullLogo-png.png';

// Firebase config - you should move this to environment variables
const firebaseConfig = {
  apiKey: "AIzaSyChHZzycxzAT_z_iQ4NKDFj95tqekeD-A4",
  authDomain: "onboardx-1234.firebaseapp.com",
  projectId: "onboardx-1234",
  storageBucket: "onboardx-1234.firebasestorage.app",
  messagingSenderId: "85849489997",
  appId: "1:85849489997:web:b4c10d1d5cd942c2539204"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'vendor' | 'distributor'>('distributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleBasedRedirect = (userRole: string) => {
    if (userRole === 'vendor') {
      window.location.href = '/';
    } else {
      window.location.href = '/distributor';
    }
  };

  const resolveRoleAndStore = async (uid: string, email: string, chosenRole: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        const roleFromDoc = data.role || chosenRole;
        
        // Update user record
        await setDoc(userRef, { 
          email, 
          role: roleFromDoc, 
          updatedAt: new Date() 
        }, { merge: true });
        
        localStorage.setItem('onboardx_user', JSON.stringify({ uid, role: roleFromDoc, email }));
        return roleFromDoc;
      } else {
        // Create new user record
        await setDoc(userRef, { 
          email, 
          role: chosenRole, 
          createdAt: new Date() 
        });
        
        localStorage.setItem('onboardx_user', JSON.stringify({ uid, role: chosenRole, email }));
        return chosenRole;
      }
    } catch (error) {
      console.warn('resolveRole failed', error);
      localStorage.setItem('onboardx_user', JSON.stringify({ uid, role: chosenRole, email }));
      return chosenRole;
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const userEmail = result.user.email || '';
      const userRole = await resolveRoleAndStore(result.user.uid, userEmail, role);
      
      // Optional: inform server about identity
      try {
        const api = (await import('../../api')).default;
        await api.postIdentify(idToken, userRole);
      } catch (e) {
        console.warn('Failed to notify server:', e);
      }
      
      handleRoleBasedRedirect(userRole);
    } catch (error: any) {
      setError('Google sign-in failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      const userEmail = result.user.email || email;
      const userRole = await resolveRoleAndStore(result.user.uid, userEmail, role);
      
      try {
        const api = (await import('../../api')).default;
        await api.postIdentify(idToken, userRole);
      } catch (e) {
        console.warn('Failed to notify server:', e);
      }
      
      handleRoleBasedRedirect(userRole);
    } catch (error: any) {
      setError('Sign up failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      const userEmail = result.user.email || email;
      const userRole = await resolveRoleAndStore(result.user.uid, userEmail, role);
      
      try {
        const api = (await import('../../api')).default;
        await api.postIdentify(idToken, userRole);
      } catch (e) {
        console.warn('Failed to notify server:', e);
      }
      
      handleRoleBasedRedirect(userRole);
    } catch (error: any) {
      setError('Sign in failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="flex max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Visual Side */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 to-red-700 p-12 items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 text-center text-white">
                  {/* Use FullLogo.jpg from public root; try an alternate path if the first fails, then hide on final failure. */}
                  <img
                    src={FullLogo}
                    alt="OnboardX"
                    className="w-40 mx-auto mb-10 rounded-xl object-contain"
                  />
            <p className="text-red-100 text-lg">Streamline your contract signing and onboarding process</p>
          </div>
          <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full"></div>
          <div className="absolute bottom-10 left-10 w-24 h-24 bg-white/10 rounded-full"></div>
        </div>

        {/* Form Side */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Sign in to review and manage contracts</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">I am a:</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="distributor"
                    checked={role === 'distributor'}
                    onChange={(e) => setRole(e.target.value as 'vendor' | 'distributor')}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Distributor</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="vendor"
                    checked={role === 'vendor'}
                    onChange={(e) => setRole(e.target.value as 'vendor' | 'distributor')}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Vendor</span>
                </label>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <div className="space-y-4 mb-6">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
                disabled={loading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign Up
              </button>
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}