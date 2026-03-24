import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithCredential, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();

function isCapacitor() {
  return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.();
}

export const AuthService = {
  currentUser() { return auth.currentUser; },

  onAuthStateChanged(cb) { return onAuthStateChanged(auth, cb); },

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
    await signOut(auth);
  },
};
