import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, onAuthStateChanged, signOut } from 'firebase/auth';
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
      const FirebaseAuthentication = window.Capacitor?.Plugins?.FirebaseAuthentication;
      if (!FirebaseAuthentication) throw new Error('FirebaseAuthentication 플러그인을 찾을 수 없습니다.');
      const result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      await signInWithCredential(auth, credential);
    } else {
      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr) {
        // 도메인 미허용: redirect도 동일하게 실패하므로 바로 throw
        if (popupErr.code === 'auth/unauthorized-domain') {
          throw new Error(
            '이 도메인은 Firebase 인증에 허용되지 않았습니다.\n' +
            'Firebase Console → Authentication → Settings → 승인된 도메인에 현재 도메인을 추가해주세요.'
          );
        }
        // 사용자가 팝업을 직접 닫은 경우 — 조용히 종료
        if (popupErr.code === 'auth/popup-closed-by-user' ||
            popupErr.code === 'auth/cancelled-popup-request') {
          throw popupErr;
        }
        // 팝업 차단된 경우에만 redirect 폴백
        if (popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, provider);
          return;
        }
        // 그 외 오류는 원본 그대로 throw
        throw popupErr;
      }
    }
  },

  async signOut() {
    if (isCapacitor()) {
      const FirebaseAuthentication = window.Capacitor?.Plugins?.FirebaseAuthentication;
      await FirebaseAuthentication?.signOut();
    }
    this.exitGuestMode();
    await signOut(auth);
  },
};
