import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db";
import type { NotificationPayload, PushResult } from "./types";

let firebaseApp: App | null = null;
let isFirebaseConfigured = false;

function getFirebaseAdmin(): App | null {
  if (firebaseApp) return firebaseApp;

  // Also accepted under the service-account JSON's own field names (how they
  // were first added in Vercel: project_id / client_email / private_key).
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.project_id;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.client_email;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.private_key;

  if (projectId && clientEmail && privateKey) {
    try {
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");

      const existingApps = getApps();
      if (!existingApps.length) {
        firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        firebaseApp = existingApps[0]!;
      }
      isFirebaseConfigured = true;
      return firebaseApp;
    } catch (err) {
      console.error("[FCM_INIT_ERROR] Failed to initialize Firebase Admin:", err);
      return null;
    }
  }

  // Graceful fallback for development / unconfigured environments
  return null;
}

/**
 * Send push notification to a list of device tokens via FCM.
 * Automatically chunks into 500-token batches (FCM limit) and cleans up invalid tokens.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: NotificationPayload,
  options?: {
    tokenUserMap?: Map<string, string>;
    notificationIdMap?: Map<string, string>;
  }
): Promise<PushResult> {
  const result: PushResult = {
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
  };

  if (!tokens || tokens.length === 0) {
    return result;
  }

  // Determine appropriate Android Notification Channel ID based on event and category
  let channelId = "atomic_pathshala_main";
  const eventType = payload.data?.eventType || "";
  const category = (payload.category as string) || payload.data?.category || "";

  if (
    eventType === "CLASS_REMINDER_15_MIN" ||
    eventType === "CLASS_STARTED" ||
    eventType === "LIVE_CLASS_STARTED"
  ) {
    channelId = "class_reminders";
  } else if (eventType.startsWith("CLASS_")) {
    channelId = "class_updates";
  } else if (eventType.startsWith("TEST_")) {
    channelId = "test_reminders";
  } else if (payload.priority === "urgent" || category === "SYSTEM") {
    channelId = "important_announcements";
  } else if (category === "STUDY_MATERIAL" || category === "MOTIVATION") {
    channelId = "general_updates";
  }

  const isHighPriority =
    payload.priority === "high" ||
    payload.priority === "urgent" ||
    channelId === "class_reminders" ||
    channelId === "class_updates" ||
    channelId === "test_reminders" ||
    channelId === "important_announcements";

  const app = getFirebaseAdmin();

  if (!app || !isFirebaseConfigured) {
    console.info(
      `[FCM Push Simulated] To ${tokens.length} tokens | Channel: ${channelId} | Title: "${payload.title}" | Body: "${payload.body}" | Link: "${payload.deepLink || ""}"`
    );
    result.successCount = tokens.length;
    return result;
  }

  const messaging = getMessaging(app);

  // Chunk tokens into batches of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...(payload.data || {}),
          title: payload.title,
          body: payload.body,
          deepLink: payload.deepLink || "",
          click_action: payload.deepLink || "",
          channelId,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : "{}",
        },
        android: {
          priority: isHighPriority ? "high" : "normal",
          notification: {
            channelId,
            icon: "ic_notification",
            color: "#2563EB",
            sound: "default",
            defaultVibrateTimings: true,
            defaultSound: true,
            priority: isHighPriority ? "max" : "high",
            visibility: "public",
            clickAction: payload.deepLink || "",
            imageUrl: payload.image || undefined,
          },
        },
        webpush: {
          fcmOptions: {
            link: payload.deepLink || "/",
          },
        },
      });

      result.successCount += response.successCount;
      result.failureCount += response.failureCount;

      // Check each token response to record audit delivery and de-activate bad tokens
      for (let idx = 0; idx < response.responses.length; idx++) {
        const resp: any = response.responses[idx];
        const badToken = chunk[idx];
        const userId = badToken ? options?.tokenUserMap?.get(badToken) : undefined;
        const notificationId = badToken ? options?.notificationIdMap?.get(badToken) : undefined;

        if (resp.success) {
          if (userId && notificationId) {
            prisma.notificationDelivery
              .create({
                data: {
                  notificationId,
                  userId,
                  channel: "FCM",
                  status: "FCM_ACCEPTED",
                  deliveredAt: new Date(),
                },
              })
              .catch(() => {});
          }
        } else if (resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            if (badToken) {
              result.invalidTokens.push(badToken);
            }
          }

          if (userId && notificationId) {
            prisma.notificationDelivery
              .create({
                data: {
                  notificationId,
                  userId,
                  channel: "FCM",
                  status: "FAILED",
                  errorMessage: resp.error.message || code || "FCM Delivery Failed",
                },
              })
              .catch(() => {});
          }
        }
      }
    } catch (chunkError) {
      console.error("[FCM_MULTICAST_ERROR]", chunkError);
      result.failureCount += chunk.length;
    }
  }

  // Auto-deactivate invalid tokens from database
  if (result.invalidTokens.length > 0) {
    try {
      await prisma.userDevice.updateMany({
        where: { fcmToken: { in: result.invalidTokens } },
        data: { isActive: false },
      });
      console.info(
        `[FCM] Deactivated ${result.invalidTokens.length} expired/invalid device tokens.`
      );
    } catch (dbErr) {
      console.error("[FCM_CLEANUP_DB_ERROR]", dbErr);
    }
  }

  return result;
}
