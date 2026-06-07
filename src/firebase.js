// src/firebase.js - Self-contained modular Firebase init using CDN (matches the snippet from console)
// This ensures that when renderer.js imports it, everything is initialized and attached to window.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// Config from console
const firebaseConfig = {
  apiKey: "AIzaSyBvN_qjHmkjg9_QjqDrbMKGG-0RNoy4noA",
  authDomain: "walkie-app-project-m.firebaseapp.com",
  projectId: "walkie-app-project-m",
  storageBucket: "walkie-app-project-m.firebasestorage.app",
  messagingSenderId: "82781619963",
  appId: "1:82781619963:web:3ceba3f57708964bb5925e",
  measurementId: "G-6F4742R8V2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition') console.warn('[Firebase] Persistence:', err);
});

console.log('[Firebase] Modular SDK initialized via CDN from src/firebase.js');

// Attach to window for inline scripts (onboarding etc.)
window.app = app;
window.auth = auth;
window.db = db;
window.analytics = analytics;
window.GoogleAuthProvider = GoogleAuthProvider;
window.serverTimestamp = serverTimestamp;
window.signInWithPopup = signInWithPopup;

export { app, auth, db, analytics, serverTimestamp, GoogleAuthProvider, signInWithPopup };