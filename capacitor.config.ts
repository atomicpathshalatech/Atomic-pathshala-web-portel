import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Atomic Pathshala Android App
 * 
 * Supports both:
 * 1. Live Server Mode (Default for Fullstack Next.js with Server Actions / NextAuth):
 *    Directs the native WebView to the live web application host or local dev server.
 * 2. Static Asset Mode (Fallback):
 *    Serves static shell from webDir.
 */

// Determine server URL: Priority is CAPACITOR_SERVER_URL > NEXT_PUBLIC_APP_URL > Production default
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://ap.atomicpathshala.in';

// Local testing only (emulator / LAN dev server over http, Chrome DevTools on
// the WebView). Set CAPACITOR_DEBUG=1 before `npx cap sync` for that. A
// normal sync — the one used for the Play Store build — leaves all of it off.
// (This used to follow NODE_ENV, which is not set during `cap sync`, so the
// release app shipped with WebView debugging and plain-http traffic allowed.)
const debugBuild = process.env.CAPACITOR_DEBUG === '1' || /^http:\/\//.test(serverUrl);

const config: CapacitorConfig = {
  appId: 'com.atomicpathshala.app',
  appName: 'Atomic Pathshala',
  webDir: 'public',
  server: {
    // When packaging for native with dynamic SSR/NextAuth, point to the live server
    url: serverUrl,
    cleartext: debugBuild, // plain http only for local testing (emulator 10.0.2.2 / LAN)
    allowNavigation: [
      'ap.atomicpathshala.in',
      '*.atomicpathshala.in',
      'app.atomicpathshala.com',
      '*.atomicpathshala.com',
      '*.livekit.cloud',
      '*.r2.cloudflarestorage.com',
      '*.amazonaws.com',
      '*.google.com',
      '*.googleusercontent.com',
      'accounts.google.com',
      'api.razorpay.com',
      'checkout.razorpay.com',
      ...(debugBuild ? ['localhost', '10.0.2.2', '127.0.0.1'] : []),
    ],
  },
  android: {
    allowMixedContent: debugBuild,
    captureInput: true,
    webContentsDebuggingEnabled: debugBuild,
    backgroundColor: '#090D16',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#090D16',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090D16',
    },
  },
};

export default config;
