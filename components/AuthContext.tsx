import * as Location from 'expo-location';
import {
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
  lastSeen?: any;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
          } else {
            // Fallback if doc doesn't exist yet
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              name: firebaseUser.email!.split('@')[0],
            });
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Check if Firebase is likely unconfigured
      if (!isFirebaseConfigured) {
        throw new Error('Firebase is not configured. Please add your credentials in lib/firebase.ts');
      }

      // 1. Mandatory GPS Check
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission is required to login');
      }
      const location = await Location.getCurrentPositionAsync({});

      // 2. Firebase Auth (Try login, if fails try signup for demo purposes)
      let firebaseUser: FirebaseUser;
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;
      } catch (err: any) {
        // Handle both old and new Firebase error codes for "user not found"
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            firebaseUser = result.user;
          } catch (signUpErr: any) {
            // If createUser fails with email-already-in-use, it means the password was just wrong
            if (signUpErr.code === 'auth/email-already-in-use') {
              throw new Error('Invalid password for this account.');
            }
            throw signUpErr;
          }
        } else {
          throw err;
        }
      }

      // 3. Update/Create Firestore Profile
      const userProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        name: firebaseUser.email!.split('@')[0],
        lastLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        lastSeen: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfile, { merge: true });
      } catch (firestoreErr: any) {
        console.error('Firestore Error:', firestoreErr);
        if (firestoreErr.code === 'permission-denied') {
          throw new Error('Firestore Database permission denied. Please ensure you have created a Firestore database in "Test Mode" in your Firebase Console.');
        }
        throw firestoreErr;
      }

      setUser(userProfile);
      return true;
    } catch (error: any) {
      console.error('Auth Error Detailed:', error);
      
      let friendlyMessage = error.message;
      let errorCode = error.code || 'unknown';
      
      // Map Firebase errors to user-friendly messages
      if (error.code === 'auth/operation-not-allowed') {
        friendlyMessage = 'Email/Password login is not enabled in your Firebase Console. Go to Authentication > Sign-in method to enable it.';
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
        friendlyMessage = 'Your Firebase API Key is invalid. Please double check lib/firebase.ts';
      } else if (error.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/internal-error') {
        friendlyMessage = 'Firebase internal error. Check your configuration in lib/firebase.ts';
      } else if (error.code === 'auth/configuration-not-found') {
        friendlyMessage = 'Firebase configuration not found. Check your project settings.';
      } else if (error.code === 'auth/unauthorized-domain') {
        friendlyMessage = 'This domain is not authorized in Firebase. Add localhost/your-domain to Authentication > Settings > Authorized domains.';
      }
      
      const enhancedError = new Error(`${friendlyMessage} (Code: ${errorCode})`);
      (enhancedError as any).code = errorCode;
      throw enhancedError;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
