import { Capacitor } from '@capacitor/core';

/**
 * Universal Platform Detection Utilities
 * Safe to execute on both server (Node.js/SSR) and client (Web / Android Native).
 */

export const isClient = typeof window !== 'undefined';

export const getPlatform = (): 'android' | 'ios' | 'web' => {
  if (!isClient) return 'web';
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
};

export const isNativeApp = (): boolean => {
  if (!isClient) return false;
  return Capacitor.isNativePlatform();
};

export const isAndroid = (): boolean => {
  if (!isClient) return false;
  return Capacitor.getPlatform() === 'android';
};

export const isWeb = (): boolean => {
  if (!isClient) return true;
  return !Capacitor.isNativePlatform();
};

/**
 * True when the page is running as an INSTALLED PWA (launched from the home
 * screen / app drawer in its own window), as opposed to an ordinary browser
 * tab. Detected via the standalone display-mode and, on iOS Safari, the
 * legacy `navigator.standalone` flag.
 */
export const isStandalonePwa = (): boolean => {
  if (!isClient) return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches === true ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

/**
 * True when the user is inside "the app" rather than the marketing website:
 * either the Capacitor native wrapper or an installed PWA window. Web tabs
 * (including a logged-in student browsing on the site) return false.
 *
 * Used to keep the public marketing home page out of the app shell — app
 * users go straight to login / their dashboard instead.
 */
export const isAppShell = (): boolean => isNativeApp() || isStandalonePwa();

/**
 * Safely execute a native plugin call only when running inside the native application wrapper.
 * Returns fallback if on web/SSR.
 */
export async function runNativeOnly<T>(
  action: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  if (!isNativeApp()) {
    return fallback;
  }
  try {
    return await action();
  } catch (error) {
    console.warn('[Platform] Native action failed or unsupported:', error);
    return fallback;
  }
}
