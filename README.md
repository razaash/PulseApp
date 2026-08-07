# Pulse — Daily Routine App

A premium, dependency-free multipurpose daily app: Home dashboard with a progress
ring, Tasks, Habits (with streaks), Notes, and a Focus (Pomodoro-style) timer.
Pure HTML/CSS/JS — everything saves locally on the device via `localStorage`,
no backend needed.

## Files
- `index.html` — structure
- `style.css` — premium dark theme (glassmorphism, gold/violet gradient accent)
- `app.js` — all app logic (vanilla JS, no frameworks)
- `manifest.json` — PWA manifest (used by the packaging tools below)
- `icon-192.png` / `icon-512.png` — **add your own app icon here** (see below)

## Before you package it
1. Add two icon files next to `index.html`:
   - `icon-192.png` (192×192px)
   - `icon-512.png` (512×512px)
   Any square PNG works — a simple logo on a solid background looks most "premium".
   You can generate one quickly with any free favicon/icon generator online.
2. Optionally change the app name in `manifest.json` (`name` / `short_name`)
   and in the `<title>` tag of `index.html`.

## Turn it into an APK — 3 easy options

### Option A — PWABuilder (easiest, no install needed)
1. Zip the `PulseApp` folder and host it somewhere public (GitHub Pages, Netlify
   drag-and-drop, Vercel, etc.) — PWABuilder needs a live URL.
2. Go to **https://www.pwabuilder.com**, paste your URL, click "Start".
3. Once it scores your PWA, click **Package for stores → Android**.
4. Download the generated APK (signed or unsigned) — done.

### Option B — Capacitor (if you want to build locally)
```bash
npm install -g @capacitor/cli
mkdir pulse-build && cd pulse-build
npm init -y
npm install @capacitor/core @capacitor/android
npx cap init "Pulse" "com.yourname.pulse"
# copy index.html, style.css, app.js, manifest.json, icons into ./www
npx cap add android
npx cap copy
npx cap open android   # opens Android Studio — Build > Build Bundle/APK
```

### Option C — Cordova (classic route)
```bash
npm install -g cordova
cordova create pulse-build com.yourname.pulse Pulse
cd pulse-build
# replace contents of www/ with index.html, style.css, app.js, manifest.json, icons
cordova platform add android
cordova build android
```
Your APK will be under `platforms/android/app/build/outputs/apk/`.

## Notes
- The app uses Google Fonts (Fraunces + Inter) loaded from a CDN, so the
  compiled app needs internet access the first time a font loads (it's then
  cached by the WebView). If you want a fully offline app, download the two
  font files and reference them locally instead of the `<link>` tags in
  `index.html`.
- All data (tasks, habits, notes, focus stats) is stored on-device only —
  nothing is sent anywhere.
