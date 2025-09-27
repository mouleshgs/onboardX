import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyChHZzycxzAT_z_iQ4NKDFj95tqekeD-A4",
  authDomain: "onboardx-1234.firebaseapp.com",
  projectId: "onboardx-1234",
  storageBucket: "onboardx-1234.firebasestorage.app",
  messagingSenderId: "85849489997",
  appId: "1:85849489997:web:b4c10d1d5cd942c2539204"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app