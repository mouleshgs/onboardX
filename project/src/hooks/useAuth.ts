import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import type { User } from '../types';

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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();
          
          const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: userData?.role || 'distributor'
          };
          
          setUser(user);
          localStorage.setItem('onboardx_user', JSON.stringify(user));
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
          localStorage.removeItem('onboardx_user');
        }
      } else {
        setUser(null);
        localStorage.removeItem('onboardx_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('onboardx_user');
      setUser(null);
      // Redirect to login page (we'll create this route)
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return { user, loading, logout };
}