import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD18bBpRgOZZJAHsGKDdRa7lUHdhl71RcI",
  authDomain: "ageverificationservice.firebaseapp.com",
  projectId: "ageverificationservice",
  storageBucket: "ageverificationservice.firebasestorage.app",
  messagingSenderId: "587819983449",
  appId: "1:587819983449:web:ece6da04c22e476b2a0748",
};

// Initialize Firebase
let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;