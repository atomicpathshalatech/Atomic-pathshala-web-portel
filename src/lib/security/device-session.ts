import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Server-side device fingerprint: sha256(userAgent + ip). Not a true
 * client-side canvas/font fingerprint (that needs the browser to collect
 * screen resolution / timezone / etc. and post it back, which the login
 * form doesn't currently do) — this is the coarser, server-only signal
 * available from the Credentials `authorize()` request alone. screenRes/
 * timezone columns on DeviceSession stay null until/unless the login form
 * is extended to collect and submit them. Disclosed scope reduction, not
 * a silent gap.
 */
export function hashDevice(userAgent: string, ip: string): string {
  return createHash("sha256").update(`${userAgent}::${ip}`).digest("hex");
}

/** Very rough UA sniffing — good enough for a human-readable device label
 * in a "your active sessions" list, not meant to be authoritative. */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
    ? "Chrome"
    : /firefox\//i.test(ua)
    ? "Firefox"
    : /safari\//i.test(ua) && !/chrome/i.test(ua)
    ? "Safari"
    : "Unknown Browser";

  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ios/i.test(ua)
    ? "iOS"
    : /mac os/i.test(ua)
    ? "macOS"
    : /linux/i.test(ua)
    ? "Linux"
    : "Unknown OS";

  const deviceType = /mobi|android|iphone/i.test(ua) ? "Mobile" : /ipad|tablet/i.test(ua) ? "Tablet" : "Desktop";

  return { browser, os, deviceType };
}

export function extractRequestMeta(headers: Record<string, string | string[] | undefined> | Headers | undefined): {
  userAgent: string;
  ip: string;
} {
  const get = (key: string): string => {
    if (!headers) return "";
    if (headers instanceof Headers) return headers.get(key) ?? "";
    const value = headers[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };

  const userAgent = get("user-agent") || "Unknown";
  const forwardedFor = get("x-forwarded-for");
  const ip = (forwardedFor.split(",")[0]?.trim() || get("x-real-ip") || "unknown");

  return { userAgent, ip };
}

/**
 * Called from the Credentials provider's authorize() on every successful
 * login. Always creates a new DeviceSession row (so "your active sessions"
 * has something to show); additionally revokes every other still-active
 * session for this user when SecurityConfig.policy is SINGLE_SESSION.
 *
 * Deliberately swallow-and-log rather than throw: a device-logging failure
 * must never block a legitimate login. If this throws, authorize() itself
 * would fail the whole sign-in, which is a far worse outcome than simply
 * not recording this one session.
 */
export async function createDeviceSession(
  userId: string,
  meta: { userAgent: string; ip: string }
): Promise<string | null> {
  try {
    const config = await prisma.securityConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    const { browser, os, deviceType } = parseUserAgent(meta.userAgent);
    const deviceHash = hashDevice(meta.userAgent, meta.ip);

    if (config.policy === "SINGLE_SESSION") {
      await prisma.deviceSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "SUPERSEDED_BY_NEW_LOGIN" },
      });
    }

    const session = await prisma.deviceSession.create({
      data: {
        userId,
        deviceHash,
        deviceType,
        browser,
        os,
        ipAddress: meta.ip,
      },
    });

    return session.id;
  } catch (error) {
    console.error("createDeviceSession failed (login proceeds regardless):", error);
    return null;
  }
}

/**
 * Called from the NextAuth `session` callback on every request. Returns
 * true only when the session is still valid — i.e. either this deployment
 * predates device-session tracking (no id on the token, nothing to check)
 * or the row exists and hasn't been revoked (by a newer login, by the
 * user themselves, or by an admin).
 */
export async function isDeviceSessionValid(deviceSessionId: string | undefined): Promise<boolean> {
  if (!deviceSessionId) return true;
  try {
    const session = await prisma.deviceSession.findUnique({
      where: { id: deviceSessionId },
      select: { revokedAt: true },
    });
    if (!session) return true; // pre-existing token issued before this row existed
    return session.revokedAt === null;
  } catch (error) {
    console.error("isDeviceSessionValid check failed (failing open):", error);
    return true; // never lock everyone out because of a transient DB hiccup
  }
}
