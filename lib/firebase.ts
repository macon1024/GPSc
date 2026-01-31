import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
// REPLACE WITH YOUR ACTUAL CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyAqkmuDUCumryOtRFd1Q4rZPfC9519AiQA",
  authDomain: "gpsc-ab58d.firebasestorage.app",
  projectId: "gpsc-ab58d",
  storageBucket: "gpsc-ab58d.firebasestorage.app",
  messagingSenderId: "251672776157",
  appId: "1:251672776157:android:26a5f689532f11d33f3a34"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with persistence
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);

const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

export { auth, db, isFirebaseConfigured };
