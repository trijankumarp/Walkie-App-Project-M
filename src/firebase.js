// src/firebase.js - Modern modular Firebase SDK initialization
// This replaces the old CDN compat approach.

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from 'firebase/firestore';

// The config loader in index.html (or firebase-config.js) sets window.FIREBASE_CONFIG early.
// We fall back to the exact values from the Firebase Console for this project.
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBvN_qjHmkjg9_QjqDrbMKGG-0RNoy4noA",
  authDomain: "walkie-app-project-m.firebaseapp.com",
  projectId: "walkie-app-project-m",
  storageBucket: "walkie-app-project-m.firebasestorage.app",
  messagingSenderId: "82781619963",
  appId: "1:82781619963:web:3ceba3f57708964bb5925e",
  measurementId: "G-6F4742R8V2"
};

// Initialize Firebase (modular style)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence (same behavior as before)
enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition') {
    console.warn('[Firebase] Persistence error:', err);
  }
});

// For gradual migration, expose on window (old code in renderer.js and inline scripts can use these during transition)
window.app = app;
window.auth = auth;
window.db = db;
window.analytics = analytics;

// Bridge for old inline onboarding code (uses window.GoogleAuthProvider + window.auth)
window.GoogleAuthProvider = GoogleAuthProvider;

console.log('[Firebase] Modular SDK initialized (v12+) for walkie-app-project-m');

export { app, auth, db, analytics, serverTimestamp };