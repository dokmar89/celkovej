// Firebase configuration for Admin Portal, Plugin, and Client Portal
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD18bBpRgOZZJAHsGKDdRa7lUHdhl71RcI",
  authDomain: "ageverificationservice.firebaseapp.com",
  projectId: "ageverificationservice",
  storageBucket: "ageverificationservice.firebasestorage.app",
  messagingSenderId: "587819983449",
  appId: "1:587819983449:web:80841173c822ee092a0748"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Ensure Firebase is initialized before using any services
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User is signed in:', user);
    } else {
        console.log('No user is signed in.');
    }
});

// Registration-related utilities
export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Login-related utilities
export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

// For Plugin-specific needs, we can add custom Firestore collections or Auth rules here

// For Client Portal-specific needs, extend configuration or utilities as required
