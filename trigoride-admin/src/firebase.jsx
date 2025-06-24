// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // ← ADD THIS

const firebaseConfig = {
  apiKey: "AIzaSyDV91TNCfyFbQkrZ4OyDBHvqlBWx60jy5E",
  authDomain: "trigoride-ee892.firebaseapp.com",
  projectId: "trigoride-ee892",
  storageBucket: "trigoride-ee892.appspot.com",
  messagingSenderId: "57222648824",
  appId: "1:57222648824:web:b01a7fd20a2ce461e6fc0d",
  measurementId: "G-MYP3V1HR0V",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);

// now this will actually exist:
export const db = getFirestore(app);
