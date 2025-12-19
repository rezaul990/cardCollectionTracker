import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBLcdfUUvKj6_DkFFjU9B2a18wgBo90T1E",
  authDomain: "cardcollectiontarget.firebaseapp.com",
  projectId: "cardcollectiontarget",
  storageBucket: "cardcollectiontarget.firebasestorage.app",
  messagingSenderId: "787404561704",
  appId: "1:787404561704:web:ed311f79d4bdf6dfb3841d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
