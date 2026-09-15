"use client";

export type ClientDeviceCategory = "DESKTOP" | "TABLET" | "MOBILE";

export interface ClientDeviceMeta {
  deviceId: string;
  deviceName: string;
  deviceCategory: ClientDeviceCategory;
  browser: string;
  os: string;
  screenRes: string;
}

const STORAGE_KEY = "atomic_device_id";
const COOKIE_NAME = "atomic_device_id";

/**
 * Retrieves existing or generates a persistent device ID stored in localStorage and cookie.
 * This guarantees the physical device maintains identity across browser restarts and network changes.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (id && id.length >= 16) {
      return id;
    }

    // Check cookie fallback
    const match = document.cookie.match(new RegExp("(^|; )" + COOKIE_NAME + "=([^;]+)"));
    if (match && match[2] && match[2].length >= 16) {
      localStorage.setItem(STORAGE_KEY, match[2]);
      return match[2];
    }

    // Generate new secure UUID
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      id = crypto.randomUUID();
    } else {
      id = "dev_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    localStorage.setItem(STORAGE_KEY, id);
    // Write persistent cookie (1 year)
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${COOKIE_NAME}=${id}; expires=${expires}; path=/; SameSite=Lax`;
    return id;
  } catch {
    return "dev_fallback_" + Date.now();
  }
}

/**
 * Accurately detects operating system, browser, and device category.
 */
export function detectDeviceMeta(): ClientDeviceMeta {
  if (typeof window === "undefined") {
    return {
      deviceId: "",
      deviceName: "Unknown Device",
      deviceCategory: "DESKTOP",
      browser: "Unknown",
      os: "Unknown",
      screenRes: "",
    };
  }

  const deviceId = getOrCreateDeviceId();
  const ua = navigator.userAgent || "";
  const width = window.screen?.width || 1024;
  const height = window.screen?.height || 768;
  const screenRes = `${width}x${height}`;
  const maxTouch = navigator.maxTouchPoints || 0;

  // Detect Browser
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/opera|opr\//i.test(ua)) browser = "Opera";

  // Detect OS
  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/macintosh|mac os x/i.test(ua)) {
    // Modern iPad Pro with iPadOS masquerades as Macintosh with touch
    if (maxTouch > 1) {
      os = "iPadOS";
    } else {
      os = "macOS";
    }
  } else if (/linux/i.test(ua)) os = "Linux";

  // Detect Category: DESKTOP | TABLET | MOBILE
  let deviceCategory: ClientDeviceCategory = "DESKTOP";

  // Check Capacitor / Native App flag
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();

  if (os === "iPadOS" || /tablet|ipad/i.test(ua) || (os === "Android" && !/mobile/i.test(ua))) {
    deviceCategory = "TABLET";
  } else if (os === "iOS" || /iphone|mobile/i.test(ua) || (os === "Android" && /mobile/i.test(ua))) {
    deviceCategory = "MOBILE";
  } else if (maxTouch > 1 && width >= 600 && width <= 1024) {
    deviceCategory = "TABLET";
  } else if (width <= 500) {
    deviceCategory = "MOBILE";
  } else {
    deviceCategory = "DESKTOP";
  }

  // Friendly human readable label
  let deviceName = `${os} (${browser})`;
  if (isCapacitor) {
    deviceName = `Atomic App on ${os}`;
  } else if (deviceCategory === "TABLET" && os === "iPadOS") {
    deviceName = "iPad";
  } else if (deviceCategory === "MOBILE" && os === "iOS") {
    deviceName = "iPhone";
  } else if (deviceCategory === "DESKTOP" && os === "macOS") {
    deviceName = "Mac";
  }

  return {
    deviceId,
    deviceName,
    deviceCategory,
    browser,
    os,
    screenRes,
  };
}
