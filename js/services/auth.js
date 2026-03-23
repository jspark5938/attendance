import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();

export const AuthService = {
  currentUser() { return auth.currentUser; },

  onAuthStateChanged(cb) { return onAuthStateChanged(auth, cb); },

  async signIn() {
    await signInWithPopup(auth, provider);
  },

  async signOut() { await signOut(auth); },
};
