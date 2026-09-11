import webpush from "web-push";
import { prisma } from "@/lib/db";
import type { NotificationPayload } from "./types";

let vapidConfigured = false;

function setupVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@atomicpathshala.com";

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
      return true;
    } catch (err) {
      console.warn("[WebPush VAPID Setup Error]", err);
      return false;
    }
  }
  return false;
}

export async function sendWebPushToUser(
  userId: string,
  payload: NotificationPayload & { id?: string }
): Promise<{ successCount: number; failureCount: number }> {
  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { userId, isActive: true },
  });

  if (subscriptions.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const isReady = setupVapid();
  if (!isReady) {
    console.info(`[WebPush Simulated] For user ${userId} (${subscriptions.length} subs) | ${payload.title}`);
    return { successCount: subscriptions.length, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const deadEndpoints: string[] = [];

  const dataString = JSON.stringify({
    notification: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        deepLink: payload.deepLink || payload.actionUrl || "/",
        notificationId: payload.id,
      },
    },
    data: {
      deepLink: payload.deepLink || payload.actionUrl || "/",
      notificationId: payload.id,
    },
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        dataString
      );
      successCount++;
    } catch (err: any) {
      failureCount++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        deadEndpoints.push(sub.endpoint);
      } else {
        console.warn(`[WebPush Error] Endpoint ${sub.endpoint.slice(0, 30)}:`, err.message);
      }
    }
  }

  if (deadEndpoints.length > 0) {
    await prisma.webPushSubscription.updateMany({
      where: { endpoint: { in: deadEndpoints } },
      data: { isActive: false },
    }).catch(() => {});
  }

  return { successCount, failureCount };
}
