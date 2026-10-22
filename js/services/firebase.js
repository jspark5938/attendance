import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);

// persistentSingleTabManager: Capacitor WebView는 탭이 1개이므로
// MultipleTabManager(BroadcastChannel 사용)는 WebView에서 IndexedDB 락을 해제하지 못해
// signInWithCredential 및 Firestore 첫 접근이 무한 대기에 빠지는 문제를 유발함
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

export const auth = getAuth(app);

// Analytics는 Capacitor 환경이나 이미 초기화된 경우 예외를 던질 수 있음.
// top-level throw가 모듈 전체 로드 실패로 이어지는 것을 방지하기 위해 격리.
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn('[Firebase] Analytics init skipped:', e?.message || e);
}
export { analytics, app };
