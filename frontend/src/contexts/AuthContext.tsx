import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { User } from '@/types'
import { apiClient } from '@/api/client'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string, role: string) => Promise<void>
  signUp: (email: string, password: string, role: string) => Promise<void>
  signInWithGoogle: (role: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const resolveRoleAndStore = async (
    firebaseUser: FirebaseUser,
    chosenRole: string
  ): Promise<string> => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid)
      const userSnap = await getDoc(userRef)

      let finalRole = chosenRole
      if (userSnap.exists()) {
        const userData = userSnap.data()
        finalRole = userData.role || chosenRole
        // Update user record
        await setDoc(
          userRef,
          {
            email: firebaseUser.email,
            role: finalRole,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } else {
        // Create new user record
        await setDoc(userRef, {
          email: firebaseUser.email,
          role: finalRole,
          createdAt: serverTimestamp(),
        })
      }

      return finalRole
    } catch (error) {
      console.warn('Failed to resolve role from Firestore:', error)
      return chosenRole
    }
  }

  const updateUserSession = async (
    firebaseUser: FirebaseUser,
    role: string
  ) => {
    try {
      const idToken = await firebaseUser.getIdToken()
      const userData: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        role: role as 'vendor' | 'distributor',
        idToken,
      }

      setUser(userData)
      apiClient.setToken(idToken)

      // Store in localStorage
      localStorage.setItem('onboardx_user', JSON.stringify(userData))

      // Notify backend
      try {
        await apiClient.identifyUser(idToken, role)
      } catch (error) {
        console.warn('Failed to identify user to backend:', error)
      }
    } catch (error) {
      console.error('Failed to update user session:', error)
      throw error
    }
  }

  const signIn = async (email: string, password: string, role: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    const finalRole = await resolveRoleAndStore(result.user, role)
    await updateUserSession(result.user, finalRole)
  }

  const signUp = async (email: string, password: string, role: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    const finalRole = await resolveRoleAndStore(result.user, role)
    await updateUserSession(result.user, finalRole)
  }

  const signInWithGoogle = async (role: string) => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    const finalRole = await resolveRoleAndStore(result.user, role)
    await updateUserSession(result.user, finalRole)
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    apiClient.setToken(null)
    localStorage.removeItem('onboardx_user')
  }

  const refreshToken = async () => {
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true)
      if (user) {
        const updatedUser = { ...user, idToken }
        setUser(updatedUser)
        apiClient.setToken(idToken)
        localStorage.setItem('onboardx_user', JSON.stringify(updatedUser))
      }
    }
  }

  useEffect(() => {
    // Try to restore user from localStorage
    const storedUser = localStorage.getItem('onboardx_user')
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setUser(userData)
        apiClient.setToken(userData.idToken)
      } catch (error) {
        console.warn('Failed to parse stored user data:', error)
        localStorage.removeItem('onboardx_user')
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, but we need to get their role
        const storedUser = localStorage.getItem('onboardx_user')
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            if (userData.uid === firebaseUser.uid) {
              // Refresh token
              await refreshToken()
              setLoading(false)
              return
            }
          } catch (error) {
            console.warn('Failed to parse stored user:', error)
          }
        }

        // Need to resolve role from Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid)
          const userSnap = await getDoc(userRef)
          const role = userSnap.exists()
            ? userSnap.data().role || 'distributor'
            : 'distributor'
          await updateUserSession(firebaseUser, role)
        } catch (error) {
          console.error('Failed to resolve user role:', error)
          // Default to distributor role
          await updateUserSession(firebaseUser, 'distributor')
        }
      } else {
        // User is signed out
        setUser(null)
        apiClient.setToken(null)
        localStorage.removeItem('onboardx_user')
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}