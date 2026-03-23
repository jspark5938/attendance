import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();

export const AuthService = {
  // Returns current user or null
  currentUser() { return auth.currentUser; },

  // Listen to auth state changes
  onAuthStateChanged(cb) { return onAuthStateChanged(auth, cb); },

  // Sign in with Google
  async signIn() {
    const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.();
    if (isCapacitor) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  },

  // Handle redirect result (call on app start for Capacitor)
  async handleRedirectResult() {
    try { return await getRedirectResult(auth); }
    catch (e) { console.warn('Redirect result error:', e); return null; }
  },

  // Sign out
  async signOut() { await signOut(auth); },
};
