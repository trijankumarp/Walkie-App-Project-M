# Walkie-App-Project-M

WhatsApp-like messaging app with **real-time cloud sync** (Firebase), beautiful mobile-first UI that also works great on desktop, voice/video calls, communities, themes, and full offline support.

**Project**: Walkie-App-Project-M  
**Firebase Project ID**: walkie-app-project-m  
**Project Number**: 82781619963

**Now fully cloud-native** — works in any browser + optional native desktop wrapper.

## Live (after deploy)
- Web (Vercel - recommended): https://walkie-app-project-m.vercel.app  (or your custom domain)
- Alternative: Firebase Hosting → https://walkie-app-project-m.web.app
- Desktop: Build the installer or run locally (Electron)

**Firebase Project (Database)**: Walkie-App-Project-M (walkie-app-project-m)

---

## Tech Stack (Cloud Version)

- **Frontend**: Pure static (index.html + renderer.js) — Tailwind via CDN, no heavy bundler needed
- **Hosting (Frontend)**: **Vercel** (recommended) — fast previews + global CDN
- **Backend / Data**: **Firebase** (Firestore + Auth)
  - Authentication (Google + Email/Password)
  - Firestore (chats, messages, communities, users) with real-time listeners
  - Offline persistence enabled
- **PWA Support**: Installable as a mobile app (Primary: Mobile, Secondary: Desktop)
- **Desktop**: Electron wrapper (optional)

## Quick Start (Local Web + PWA)

```powershell
cd "C:\Users\trija\Desktop\Work\VS\Walkie-App-Project-M"

# 1. Copy config
cp firebase-config.example.js firebase-config.js
# Edit firebase-config.js with your Firebase web config

# 2. Run as web app (browser)
npm run web
# Open http://localhost:8080

# 3. Install as PWA (Mobile)
# - Open in Chrome/Edge on Android
# - Tap "Add to home screen" or "Install app"
```

For Node users:
```powershell
npm run web:node
```

## Desktop (Electron)

```powershell
npm start
```

## Full Cloud Setup (GitHub + Firebase Database + Vercel Hosting)

### 1. Firebase (Database + Auth only)

Firebase is used **only for the backend** (Firestore real-time data + Authentication). Hosting is handled by Vercel.

- **Project name**: Walkie-App-Project-M
- **Project ID**: walkie-app-project-m
- **Project number**: 82781619963

1. Go to https://console.firebase.google.com/project/walkie-app-project-m
2. Create a **Firestore database** (if you haven't already) in the console.
3. In **Project Settings → General → Your apps**, click the web `</>` icon (or "Add app" → Web).
4. Give it the nickname "Walkie-App-Project-M" and register the app.
5. Copy the full `firebaseConfig` object.
6. Paste the real values into:
   - `firebase-config.js` (local development)
   - `firebase-config.deploy.js` (used in production on Vercel)
7. **Authentication → Sign-in method**:
   - Enable **Google** (required for the current flow).
   - (Optional) Enable **Phone** if you want real OTP/SMS login later.
8. Add authorized domains (important!):
   - `localhost`
   - `127.0.0.1`
   - `*.vercel.app`
   - `walkie-app-project-m.web.app` (if you also use Firebase Hosting)

`firebase-config.deploy.js` is committed so it works on Vercel (and Firebase Hosting if you ever use it).

### 2. Local Config

```powershell
cp firebase-config.example.js firebase-config.js
# Paste your config into firebase-config.js
```

### 3. GitHub

This repo is the source of truth:

```powershell
git remote add origin https://github.com/trijankumarp/Walkie-App-Project-M.git
git branch -M main
git push -u origin main
```

### 4. Vercel Hosting (Recommended)

Vercel is the primary hosting for the frontend.

**Easiest way:**

1. Go to https://vercel.com
2. Click **Add New Project** → **Import Git Repository**
3. Select your `Walkie-App-Project-M` repo from GitHub
4. Vercel will auto-detect it as a static site.
5. Click **Deploy**

Your site will be live at something like:
`https://walkie-app-project-m.vercel.app`

**Alternative (Vercel CLI):**

```powershell
npm i -g vercel
vercel
```

Vercel will automatically redeploy on every push to `main` (after you connect the repo once).

**Why this combo works well:**
- Vercel → fast static hosting + preview URLs on every PR
- Firebase → real-time database (Firestore) + auth
- GitHub → code + (optional) CI

The app already detects `vercel.app` domains and loads `firebase-config.deploy.js` for the correct production Firebase config.

### (Optional) GitHub + Firebase Hosting Auto Deploy

If you ever want to use **Firebase Hosting** as an alternative or backup:

**Every push to `main` will automatically deploy to Vercel** (if you connected the repo).

We added:
- `.github/workflows/deploy-check.yml` — basic validation on every push/PR
- `.github/workflows/deploy-hosting.yml` — optional auto-deploy to **Firebase Hosting** (backup)

#### One-time setup for auto-deploy:

1. Make sure your code is on GitHub (main branch) and the workflows are committed.
2. In Firebase Console (project **walkie-app-project-m**):
   - Go to **Project settings** → **Service accounts**
   - Under "Firebase Admin SDK" click **Generate new private key**
   - Download the JSON file (keep it safe, contains secrets)
3. In your GitHub repository:
   - **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: **paste the entire content** of the JSON file you just downloaded
4. Commit & push any change (or push the workflows if not already):
   ```powershell
   git add .github/workflows/
   git commit -m "Add Firebase auto-deploy workflow"
   git push
   ```
5. Go to the **Actions** tab on GitHub — you should see the "Deploy to Firebase Hosting" workflow running.

After successful deploy (Vercel) the live site is at your Vercel URL (e.g. `https://walkie-app-project-m.vercel.app`).

Manual deploy to Firebase Hosting (optional):
```powershell
firebase deploy --only hosting
```

### Daily: One-command "Push to GitHub + Auto Deploy to Vercel"

After making changes, use:

```powershell
npm run push "your nice commit message here"
```

Or directly:

```powershell
.\push.ps1 "Update chat themes + minor fixes"
```

What happens:
1. Script does `git add + commit + push`
2. GitHub receives the push
3. If you connected the repo to Vercel → Vercel automatically deploys the new version
4. (Optional) If you have the Firebase Hosting workflow enabled, it can also deploy to Firebase Hosting

`firebase-config.deploy.js` is committed so production builds (Vercel or Firebase Hosting) always get the correct Firebase config.

### Zero-Command Auto Push (Recommended for active development)

You said you don't want to run a command **every time** you make changes.

**Solution:** Start the watcher **once** in a separate terminal. After that, every edit you make will be **automatically** committed + pushed to GitHub → which automatically deploys to Firebase.

#### How to start auto mode (do this once):

Open a **second PowerShell window** (keep your main editing window separate) and run:

```powershell
npm run auto-push
# or
npm run watch
```

Or directly:
```powershell
.\auto-push.ps1
```

That's it.

- The watcher checks for changes every ~4 seconds.
- When it sees any changes (that are not gitignored), it does `git add + commit + push` automatically.
- Your GitHub Action then deploys it to Firebase Hosting.
- You can keep editing — no more manual push commands needed.

To stop: just press `Ctrl + C` in the watcher window.

**Tip:** Keep the watcher running in a small terminal while you develop. All your saves → auto deployed to Vercel.

**Note on commit history:** This will create many small "auto: ..." commits. This is normal and fine during heavy development. Later you can squash them on main if you want a clean history.

### 5. OTP Verification Fixes & Troubleshooting (Step 2)

The phone number + OTP flow now uses real Firebase (compat SDK + your exact config).

#### What was improved:
- Explicit `recaptchaVerifier.render()` before sending (makes invisible reCAPTCHA much more reliable on mobile/PWA).
- Loading state ("Sending code...") on the Yes button.
- Detailed error messages for common Firebase codes (`operation-not-allowed`, quota, captcha, invalid number...).
- Verifier is properly cleared/reset on failure so resend works.
- The number is shown correctly on the verify screen.
- Country prefix updates on select + when returning to phone step.
- Better guidance text (no more demo 123456).

#### To make OTP actually arrive to your mobile:

1. **Enable Phone provider** (most common reason for "no OTP"):
   - Firebase Console → **Authentication** → **Sign-in method**
   - Enable **Phone** (if it's off, turn it on).

2. **Add test phone numbers** (recommended for development):
   - In the same Phone section, scroll to "Phone numbers for testing".
   - Add e.g. `+91 9876543210` with verification code `123456`.
   - Then in the app use that exact number + the test code — SMS will not be sent but verification succeeds instantly.

3. **Authorized domains**:
   - Authentication → Settings → Authorized domains
   - Make sure these are present:
     - `localhost`
     - `127.0.0.1`
     - `*.vercel.app`
     - `walkie-app-project-m.web.app` (Firebase Hosting fallback)
     - `walkie-app-project-m.firebaseapp.com`

4. In the app flow:
   - Step 2: Select country (India default +91). The prefix box and the small code should update immediately.
   - Enter number without country code.
   - Step 4: "Yes" → button becomes "Sending code..." while reCAPTCHA + Firebase processes.
   - If it fails, the red error text will tell you the exact reason.
   - Step 5: Enter the 6 digits (auto-submits on last digit). Use "Resend" if needed.

5. Still nothing?
   - Open browser DevTools → Console while clicking "Yes".
   - The exact `error.code` will be logged.
   - Common: quota exceeded (use test numbers), operation-not-allowed (provider not enabled), or domain not authorized.

After successful real (or test) verification you will see the main app UI with Chat tab open by default (black/gray/white theme as requested).

**PWA Installation (Mobile)**
- After deploying (or even locally on https), open in Chrome on Android → menu → "Add to home screen" or install banner.
- Works offline thanks to the service worker.

---

## Project Structure

```
Walkie-App-Project-M/
├── .github/workflows/
│   ├── deploy-check.yml          # Validation on push/PR
│   └── deploy-hosting.yml        # Auto-deploy to Firebase on push to main
├── electron/                     # Desktop wrapper (optional)
├── firebase.json                 # Firebase Hosting (optional / backup)
├── vercel.json                   # Vercel configuration (recommended hosting)
├── manifest.json                 # PWA manifest
├── sw.js                         # Service Worker (offline + caching)
├── index.html                    # Main app (PWA enabled)
├── renderer.js                   # All UI + Firebase logic
├── firebase-config.example.js
├── firebase-config.deploy.js     # Used by Vercel + Firebase Hosting production
├── package.json
└── README.md
```

**Current Firebase target (Database)**: Walkie-App-Project-M (walkie-app-project-m)

## Key Features (Current)

- Beautiful WhatsApp-inspired UI (bottom tabs: Chat / Calls / Communities / Settings) - **Mobile Primary**
- PWA Support (installable on mobile home screen)
- Fully responsive (optimized for mobile, works on desktop)
- Real-time messaging via Firestore
- Firebase Auth (Google login)
- Offline support (Firestore cache + Service Worker)
- Custom chat themes + wallpapers
- Voice & video call UI (ready for WebRTC signaling via Firebase)
- Communities

**Note on Icons**: Current `manifest.json` uses placeholder icons. Replace them with real 192x192 and 512x512 PNG icons for production (see "PWA Icons" section below).

## Next / Polish Ideas

- Real WebRTC calls using Firebase RTDB or Firestore for signaling (see your old Walkie-Talkie code)
- User profiles, avatars, last seen
- Push notifications (Firebase Cloud Messaging)
- File / voice message upload (Firebase Storage)
- End-to-end encryption notes
- Better call history stored in cloud
- Replace placeholder icons in `manifest.json` with real app icons

### PWA Icons (Important for Mobile Install)

1. Create two PNG icons:
   - 192x192 px
   - 512x512 px
2. Place them in the project root (e.g. `icon-192.png`, `icon-512.png`)
3. Update `manifest.json` to point to them:
   ```json
   "icons": [
     { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
     { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
   ]
   ```
You can generate them easily using tools like https://www.pwabuilder.com/imageGenerator or Figma + export.

---

**This version is designed as a Mobile-First PWA** (Primary: Mobile, Secondary: Desktop) with Firebase Hosting, fully in the cloud, with real-time sync and offline support.

Created with Grok Build.
