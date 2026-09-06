"use client";

/**
 * Registers service worker and browser push permissions.
 * Safe to call on any page load or settings toggle.
 */
export async function registerBrowserPush(): Promise<{ success: boolean; reason?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return { success: false, reason: "Browser does not support notifications" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, reason: "Permission denied by user" };
    }

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    // We can also subscribe to standard PushManager as a fallback or device registration
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      // If VAPID key is configured in env, subscribe to PushManager
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (vapidKey) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidKey),
        });
      }
    }

    if (subscription) {
      const endpointToken = subscription.endpoint;
      await fetch("/api/notifications/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcmToken: endpointToken,
          platform: "WEB",
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.warn("[WebPush Registration Warning]", error);
    return { success: false, reason: error?.message || "Registration failed" };
  }
}

function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
