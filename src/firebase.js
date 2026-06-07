// src/firebase.js
// Re-exports the Firebase instances that were initialized by the
// exact <script type="module"> CDN snippet you pasted in index.html.

export const app = window.app;
export const auth = window.auth;
export const db = window.db;
export const analytics = window.analytics;
export const serverTimestamp = window.serverTimestamp;
export const GoogleAuthProvider = window.GoogleAuthProvider;