import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithCredential, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();
const GUEST_KEY = 'attendance_guest_mode';

function isCapacitor() {
  return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.();
}

export const AuthService = {
  currentUser() { return auth.currentUser; },

  onAuthStateChanged(cb) { return onAuthStateChanged(auth, cb); },

  isGuestMode() { return localStorage.getItem(GUEST_KEY) === 'true'; },
  enterGuestMode() { localStorage.setItem(GUEST_KEY, 'true'); },
  exitGuestMode() { localStorage.removeItem(GUEST_KEY); },

  async handleRedirectResult() {
    if (isCapacitor()) return null;
    return await getRedirectResult(auth);
  },

  async signIn() {
    if (isCapacitor()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      await signInWithCredential(auth, credential);
    } else {
      await signInWithRedirect(auth, provider);
    }
  },

  async signOut() {
    if (isCapacitor()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    }
    this.exitGuestMode();
    await signOut(auth);
  },
};
