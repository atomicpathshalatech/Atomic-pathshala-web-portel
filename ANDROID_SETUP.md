# 📱 Atomic Pathshala - Android Native Application Guide (Capacitor)

This guide provides comprehensive instructions for running, testing, building, and deploying the **Atomic Pathshala** Android application built with Capacitor and Next.js 14.

---

## 🏗️ Architecture Overview

The Android application uses **Capacitor 8** as a native bridge to wrap the fullstack Next.js application into a native Android `.apk` / `.aab`:

```
┌─────────────────────────────────────────────────────────────┐
│                   Native Android Container                  │
│  (Hardware Back Button • Push Notifications • Filesystem)   │
├─────────────────────────────────────────────────────────────┤
│                    Capacitor Native Bridge                  │
│                     (src/lib/platform/*)                    │
├─────────────────────────────────────────────────────────────┤
│               Next.js App Router (Client & SSR)             │
│            (NextAuth • LiveKit WebRTC • UI Components)      │
├─────────────────────────────────────────────────────────────┤
│                    Backend & Cloud APIs                     │
│  (Next.js Route Handlers • PostgreSQL Prisma • S3/R2 presign)│
└─────────────────────────────────────────────────────────────┘
```

### Key Highlights
- **🔒 Zero Client Secrets**: AWS S3/R2 credentials, database secrets, and API keys remain strictly on the backend. File uploads/downloads use secure server-generated presigned URLs.
- **🌐 100% Web Compatible**: The existing web app continues to work identically on Chrome, Safari, and desktop browsers. All native plugins are safely guarded by platform detection (`isNativeApp()`).
- **📲 Full Native Android Support**: Hardware back button navigation, modal dismissal, double-tap exit guard, FCM push notifications, native file downloads, deep linking, and camera/microphone permissions for live classes.

---

## 📋 Prerequisites

Before building the Android app locally, ensure you have the following installed:

1. **Node.js**: `v18.18.0` or higher
2. **Java Development Kit (JDK)**: JDK 17 or JDK 21 (Adoptium Temurin recommended)
   - Verify with: `java -version`
3. **Android Studio**: Android Studio Ladybug (2024.2+) or newer
   - Android SDK Platform **34 / 35** installed via SDK Manager
   - Android SDK Command-line Tools
   - Android SDK Build-Tools
4. **Environment Variables**:
   - `JAVA_HOME`: Path to JDK directory (e.g., `C:\Program Files\Eclipse Adoptium\jdk-17...`)
   - `ANDROID_HOME` or `ANDROID_SDK_ROOT`: Path to Android SDK (e.g., `C:\Users\<username>\AppData\Local\Android\Sdk`)
   - Add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\cmdline-tools\latest\bin` to your `PATH`.

---

## 🚀 Quick Start (Development)

### 1. Start the Next.js Development Server
```bash
npm run dev
```

### 2. Configure Local Development URL in `capacitor.config.ts`
By default, `capacitor.config.ts` uses `https://app.atomicpathshala.com`. For local testing on an Android emulator:
- Set environment variable: `CAPACITOR_SERVER_URL=http://10.0.2.2:3000`
- Or run on a physical device connected to your local Wi-Fi: `CAPACITOR_SERVER_URL=http://<YOUR_LOCAL_IP>:3000`

### 3. Sync and Open in Android Studio
```bash
# Sync web assets and plugins to Android project
npm run cap:sync

# Open the native project directly in Android Studio
npm run cap:open
```

### 4. Run on Device / Emulator
In Android Studio:
1. Select your target device or emulator from the top toolbar.
2. Click the green **Run (▶)** button (or press `Shift + F10`).

---

## 📦 Building Android APKs via Command Line

### Debug APK (For Fast Testing)
```bash
# Windows
npm run android:debug

# Or directly in android directory
cd android
.\gradlew.bat assembleDebug
```
The output APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Installing Debug APK directly to connected phone:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔔 Firebase Cloud Messaging (FCM) Push Notifications Setup

To enable real-time push notifications on Android:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new Firebase project or select your existing project (**Atomic Pathshala**).
3. Click **Add App** ➔ Select **Android**.
4. Enter the package name:
   ```
   com.atomicpathshala.app
   ```
5. Enter the App nickname: `Atomic Pathshala Android`
6. Download the `google-services.json` configuration file.
7. Place `google-services.json` in the `android/app/` directory:
   ```
   android/
   └── app/
       └── google-services.json
   ```
8. Run sync:
   ```bash
   npx cap sync android
   ```
9. When users log into the app, the device FCM token will automatically register with `/api/notifications/devices`.

---

## 🔗 Deep Linking & Android App Links Configuration

The app is pre-configured to handle both custom schemes and verified HTTPS App Links:

### 1. Custom URL Scheme:
- URL format: `atomicpathshala://live-class/session-123` or `atomicpathshala://tests/neet-mock-1`
- Handled automatically by `src/lib/platform/deep-links.ts`.

### 2. Android App Links (`https://app.atomicpathshala.com`):
To enable direct opening of web links inside the app without browser prompts:
1. Generate your SHA-256 fingerprint from your keystore:
   ```bash
   keytool -list -v -keystore my-release-key.jks
   ```
2. Host the `assetlinks.json` file on your domain at:
   ```
   https://app.atomicpathshala.com/.well-known/assetlinks.json
   ```
   Content format:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.atomicpathshala.app",
         "sha256_cert_fingerprint_list": [
           "YOUR_SHA256_FINGERPRINT_HERE"
         ]
       }
     }
   ]
   ```

---

## 🔐 Production Release & Google Play Store Deployment

### Step 1: Generate a Production Keystore
Run the following keytool command (keep this keystore safe and backed up!):
```bash
keytool -genkey -v -keystore atomic-release-key.jks -alias atomicpathshala -keyalg RSA -keysize 2048 -validity 10000
```

### Step 2: Configure Signing in `android/keystore.properties`
Create `android/keystore.properties` (added to `.gitignore`):
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=atomicpathshala
storeFile=../atomic-release-key.jks
```

### Step 3: Build Signed Android App Bundle (AAB) for Play Store
```bash
cd android
.\gradlew.bat bundleRelease
```
The output production bundle will be generated at:
```
android/app/build/outputs/bundle/release/app-release.aab
```
Upload this `.aab` directly to the **Google Play Console** under Production / Internal Testing release track.

---

## 🛠️ Capacitor Convenience Commands Reference

| Command | Action |
|---|---|
| `npm run cap:sync` | Syncs web assets, configs, and Capacitor plugins to `android/` |
| `npm run cap:open` | Opens the Android project inside Android Studio |
| `npm run cap:build` | Rebuilds Next.js web application and syncs Android platform |
| `npm run android:debug` | Compiles the Android Debug APK (`app-debug.apk`) |
| `npm run android:release` | Compiles the Android Release APK (`app-release.apk`) |

---

## 🧩 Platform Abstraction Reference (`src/lib/platform/`)

| Module | Purpose |
|---|---|
| `src/lib/platform/index.ts` | `isNativeApp()`, `isAndroid()`, `isWeb()`, `runNativeOnly()` |
| `src/lib/platform/app-listener.ts` | Android hardware back button handler, modal closer, double-tap exit guard |
| `src/lib/platform/deep-links.ts` | Translates `atomicpathshala://` and App Links into Next.js router transitions |
| `src/lib/platform/notifications.ts` | Android 13+ permission request, FCM token registration, foreground alerts |
| `src/lib/platform/browser.ts` | `openExternalUrl()` opens external links in In-App Browser tab |
| `src/lib/platform/files.ts` | `downloadAndOpenFile()` downloads presigned S3/R2 files to native storage & triggers share sheet |
| `src/components/providers/CapacitorProvider.tsx` | Root layout provider mounting status bar, back button, and push notification lifecycle |

---

## ❓ Troubleshooting

1. **Gradle Build Error: SDK location not found**:
   - Create `android/local.properties` with:
     ```properties
     sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
     ```
2. **Cleartext HTTP Traffic Not Permitted**:
   - `android:usesCleartextTraffic="true"` is already enabled in `AndroidManifest.xml` for local testing on `10.0.2.2` or local IP.
3. **Camera / Mic Permission Denied in Live Classroom**:
   - `RECORD_AUDIO` and `CAMERA` permissions are declared in `AndroidManifest.xml`. Ensure permissions are granted when prompted on device.
4. **NextAuth Session Cookie Not Persisting**:
   - Capacitor WebView uses standard Chromium engine. Session cookies over HTTPS (`app.atomicpathshala.com`) persist automatically across restarts.
