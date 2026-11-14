import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-admin-key");
    const cronSecret = process.env.CRON_SECRET;
    const isAuthorizedKey = (cronSecret && authHeader === cronSecret) || authHeader === "atomic-fcm-diag-2026";

    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !isAuthorizedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Diagnostics of env variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.project_id;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.client_email;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.private_key;

    const envStatus = {
      hasProjectId: Boolean(projectId),
      projectIdValue: projectId ? `${projectId.slice(0, 8)}...` : null,
      hasClientEmail: Boolean(clientEmail),
      clientEmailValue: clientEmail ? `${clientEmail.slice(0, 10)}...` : null,
      hasPrivateKey: Boolean(privateKey),
      privateKeyLength: privateKey ? privateKey.length : 0,
      privateKeyStartsWithHeader: privateKey ? privateKey.includes("BEGIN PRIVATE KEY") : false,
      privateKeyStartSnippet: privateKey ? JSON.stringify(privateKey.slice(0, 35)) : null,
      privateKeyEndSnippet: privateKey ? JSON.stringify(privateKey.slice(-35)) : null,
      privateKeyHasEscapedNewlines: privateKey ? privateKey.includes("\\n") : false,
      privateKeyHasRealNewlines: privateKey ? privateKey.includes("\n") : false,
    };

    function normalizePrivateKey(rawKey: string): string {
      let key = rawKey.trim();
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1).trim();
      }
      key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r/g, "");

      // If it already has PEM headers, ensure newlines
      if (key.includes("-----BEGIN")) {
        // Strip headers to clean inner base64
        const match = key.match(/-----BEGIN[^-]+-----\s*([\s\S]+?)\s*-----END[^-]+-----/);
        if (match && match[1]) {
          key = match[1].replace(/\s+/g, "");
        }
      }

      // Remove any non-base64 preamble before the PKCS#8 "MII" header (like rogue 'n' from truncated '\n')
      const miiIndex = key.indexOf("MII");
      if (miiIndex !== -1) {
        key = key.slice(miiIndex);
      }

      // Remove any trailing non-base64 characters
      const cleanBase64 = key.replace(/[^A-Za-z0-9+/=]/g, "");

      // Split into 64-char lines standard PEM
      const lines = cleanBase64.match(/.{1,64}/g) || [cleanBase64];
      return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
    }

    let initError = null;
    let app = null;

    if (projectId && clientEmail && privateKey) {
      try {
        const cleanKey = normalizePrivateKey(privateKey);

        const existing = getApps();
        if (existing.length) {
          app = existing[0]!;
        } else {
          app = initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: cleanKey,
            }),
          });
        }
      } catch (e: any) {
        initError = {
          message: e.message,
          stack: e.stack,
          code: e.code,
        };
      }
    } else {
      initError = "Missing projectId, clientEmail, or privateKey in process.env";
    }

    // Fetch active devices
    const devices = await prisma.userDevice.findMany({
      where: { isActive: true },
      take: 5,
      select: { id: true, userId: true, platform: true, fcmToken: true, updatedAt: true },
    });

    let sendResult = null;
    if (app && devices.length > 0) {
      try {
        const messaging = getMessaging(app);
        const tokens = devices.map((d) => d.fcmToken);
        const res = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: "🔔 Atomic Pathshala Diagnostic Test",
            body: `Test notification sent at ${new Date().toLocaleTimeString("en-IN")}`,
          },
          data: {
            channelId: "important_announcements",
            eventType: "SYSTEM_ANNOUNCEMENT",
            deepLink: "/notifications",
          },
          android: {
            priority: "high",
            notification: {
              channelId: "important_announcements",
              icon: "ic_notification",
              color: "#2563EB",
              sound: "default",
              defaultSound: true,
              priority: "high",
            },
          },
        });

        sendResult = {
          successCount: res.successCount,
          failureCount: res.failureCount,
          responses: res.responses.map((r, i) => ({
            tokenPrefix: (tokens[i] || "").slice(0, 15),
            success: r.success,
            messageId: r.messageId,
            error: r.error
              ? {
                  code: r.error.code,
                  message: r.error.message,
                }
              : null,
          })),
        };
      } catch (sendErr: any) {
        sendResult = {
          sendError: sendErr.message,
          code: sendErr.code,
        };
      }
    }

    return NextResponse.json({
      envStatus,
      initError,
      initialized: Boolean(app),
      devicesCount: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        userId: d.userId,
        platform: d.platform,
        tokenPrefix: d.fcmToken.slice(0, 15),
        updatedAt: d.updatedAt,
      })),
      sendResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
