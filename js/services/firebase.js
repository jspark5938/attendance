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
export const analytics = getAnalytics(app);
export { app };
