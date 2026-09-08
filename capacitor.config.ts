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
  'https://app.atomicpathshala.com';

const config: CapacitorConfig = {
  appId: 'com.atomicpathshala.app',
  appName: 'Atomic Pathshala',
  webDir: 'public',
  server: {
    // When packaging for native with dynamic SSR/NextAuth, point to the live server
    url: serverUrl,
    cleartext: true, // Enables local HTTP testing on Android emulator (10.0.2.2) or LAN
    allowNavigation: [
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
      'localhost',
      '10.0.2.2',
      '127.0.0.1',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
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
