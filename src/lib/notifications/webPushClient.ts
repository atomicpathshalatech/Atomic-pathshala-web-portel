"use client";

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

/**
 * Registers service worker and browser push permissions.
 * Gracefully handles denied permissions without breaking in-app notifications.
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

    let subscription = await reg.pushManager.getSubscription();

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!subscription && vapidKey) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidKey),
        });
      } catch (subErr) {
        console.warn("[PushManager Subscribe Warning]", subErr);
      }
    }

    if (subscription) {
      const subJson = subscription.toJSON();
      if (subJson.keys?.p256dh && subJson.keys?.auth) {
        // 1. Store in standard web-push table
        await fetch("/api/notifications/web-push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            },
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});
      }

      // 2. Also register in user_devices for FCM
      await fetch("/api/notifications/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcmToken: subscription.endpoint,
          platform: "WEB",
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      }).catch(() => {});
    }

    return { success: true };
  } catch (error: any) {
    console.warn("[WebPush Registration Warning]", error);
    return { success: false, reason: error?.message || "Registration failed" };
  }
}
