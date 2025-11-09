import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCLnL4ghvADQoQOnfMVhSKB2EHFCJsWzSM",
  authDomain: "kiviatgo.firebaseapp.com",
  projectId: "kiviatgo",
  storageBucket: "kiviatgo.firebasestorage.app",
  messagingSenderId: "667398739805",
  appId: "1:667398739805:web:e6360f92c868a2148cfab4",
  measurementId: "G-QGSX54SVFX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export let analytics: ReturnType<typeof getAnalytics> | undefined;
(async () => {
  try {
    if (await isSupported()) {
      analytics = getAnalytics(app);
    }
  } catch (e) {
    analytics = undefined;
  }
})();