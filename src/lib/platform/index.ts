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
