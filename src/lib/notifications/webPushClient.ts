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

/** Can this browser get push notifications at all? (iPhone: only once added to the Home Screen.) */
export function browserPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The server's VAPID public key: build-time env when set, else asked from the server (no rebuild needed). */
async function vapidPublicKey(): Promise<string | null> {
  const built = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (built) return built;
  try {
    const res = await fetch("/api/notifications/web-push/public-key", { cache: "no-store" });
    const json = await res.json();
    return typeof json?.data?.publicKey === "string" && json.data.publicKey ? json.data.publicKey : null;
  } catch {
    return null;
  }
}

/** Is browser push set up on the server (its key is there)? */
export async function browserPushReady(): Promise<boolean> {
  return Boolean(await vapidPublicKey());
}

/**
 * Turns on browser push for this device: asks permission, subscribes the
 * site's one service worker (/sw.js — it also handles offline) and saves
 * the subscription. Must run from a click (iPhone requires it).
 * Gracefully handles denied permissions without breaking in-app notifications.
 */
export async function registerBrowserPush(): Promise<{ success: boolean; reason?: string }> {
  if (!browserPushSupported()) {
    return { success: false, reason: "Browser does not support notifications" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, reason: "Permission denied by user" };
    }

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const key = await vapidPublicKey();
      if (!key) return { success: false, reason: "Browser push is not set up on the server yet" };
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.keys?.p256dh || !subJson.keys?.auth) return { success: false, reason: "Subscription has no keys" };
    const res = await fetch("/api/notifications/web-push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) return { success: false, reason: "Could not save the subscription" };
    return { success: true };
  } catch (error: any) {
    console.warn("[WebPush Registration Warning]", error);
    return { success: false, reason: error?.message || "Registration failed" };
  }
}
