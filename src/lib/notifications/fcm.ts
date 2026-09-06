import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db";
import type { NotificationPayload, PushResult } from "./types";

let firebaseApp: App | null = null;
let isFirebaseConfigured = false;

function getFirebaseAdmin(): App | null {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

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
  payload: NotificationPayload
): Promise<PushResult> {
  const result: PushResult = {
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
  };

  if (!tokens || tokens.length === 0) {
    return result;
  }

  const app = getFirebaseAdmin();

  if (!app || !isFirebaseConfigured) {
    console.info(
      `[FCM Push Simulated] To ${tokens.length} tokens | Title: "${payload.title}" | Body: "${payload.body}" | Link: "${payload.deepLink || ""}"`
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
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : "{}",
        },
        android: {
          priority: payload.priority === "normal" ? "normal" : "high",
          notification: {
            channelId: "atomic_pathshala_main",
            sound: "default",
            clickAction: payload.deepLink || "",
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

      // Check for bad/expired tokens to deactivate
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            const badToken = chunk[idx];
            if (badToken) {
              result.invalidTokens.push(badToken);
            }
          }
        }
      });
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
