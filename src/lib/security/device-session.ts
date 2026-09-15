import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type DeviceCategory = "DESKTOP" | "TABLET" | "MOBILE";

export interface RequestDeviceMeta {
  userAgent: string;
  ip: string;
  deviceId?: string;
  deviceName?: string;
  deviceCategory?: DeviceCategory;
  browser?: string;
  os?: string;
  screenRes?: string;
}

export function hashDevice(userAgent: string, ip: string, deviceId?: string): string {
  const seed = deviceId ? `${deviceId}::${userAgent}` : `${userAgent}::${ip}`;
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * Parses user agent and infers browser, OS, and category if not provided by client.
 */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string; deviceCategory: DeviceCategory } {
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/opera|opr\//i.test(ua)) browser = "Opera";

  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let deviceCategory: DeviceCategory = "DESKTOP";
  if (os === "iPadOS" || /ipad|tablet/i.test(ua)) {
    deviceCategory = "TABLET";
  } else if (os === "iOS" || /mobi|iphone/i.test(ua) || (os === "Android" && /mobile/i.test(ua))) {
    deviceCategory = "MOBILE";
  } else if (/android/i.test(ua)) {
    deviceCategory = "TABLET";
  }

  const deviceType = deviceCategory === "MOBILE" ? "Mobile" : deviceCategory === "TABLET" ? "Tablet" : "Desktop";

  return { browser, os, deviceType, deviceCategory };
}

export function extractRequestMeta(
  headers: Record<string, string | string[] | undefined> | Headers | undefined
): RequestDeviceMeta {
  const get = (key: string): string => {
    if (!headers) return "";
    if (headers instanceof Headers) return headers.get(key) ?? "";
    const value = headers[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };

  const userAgent = get("user-agent") || "Unknown";
  const forwardedFor = get("x-forwarded-for");
  const ip = forwardedFor.split(",")[0]?.trim() || get("x-real-ip") || "unknown";

  const clientDeviceId = get("x-device-id") || undefined;
  const clientDeviceName = get("x-device-name") ? decodeURIComponent(get("x-device-name")) : undefined;
  const rawCat = get("x-device-category").toUpperCase();
  const clientCategory: DeviceCategory | undefined =
    rawCat === "DESKTOP" || rawCat === "TABLET" || rawCat === "MOBILE" ? (rawCat as DeviceCategory) : undefined;

  const parsed = parseUserAgent(userAgent);

  return {
    userAgent,
    ip,
    deviceId: clientDeviceId,
    deviceName: clientDeviceName || `${parsed.os} (${parsed.browser})`,
    deviceCategory: clientCategory || parsed.deviceCategory,
    browser: parsed.browser,
    os: parsed.os,
  };
}

export interface DeviceLoginCheckResult {
  allowed: boolean;
  reason?: "DEVICE_BLOCKED" | "CATEGORY_NOT_ALLOWED" | "CATEGORY_LIMIT_REACHED" | "TOTAL_LIMIT_REACHED";
  message?: string;
  isExistingDevice?: boolean;
  existingSessionId?: string;
  conflictingSession?: {
    id: string;
    deviceName: string | null;
    deviceCategory: string;
    createdAt: Date;
    lastActiveAt: Date;
  };
}

/**
 * Validates whether a device is allowed to log in according to user permissions,
 * active category counts, and global security policy.
 */
export async function checkDeviceLoginAllowed(
  userId: string,
  meta: RequestDeviceMeta
): Promise<DeviceLoginCheckResult> {
  try {
    const [user, config] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          allowedDeviceTypes: true,
          maxActiveDevices: true,
        },
      }),
      prisma.securityConfig.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", policy: "CATEGORY_MANAGED" },
      }),
    ]);

    const category = meta.deviceCategory || "DESKTOP";

    // 1. If physical deviceId is known, check if it's already registered or blocked
    if (meta.deviceId) {
      const existing = await prisma.deviceSession.findFirst({
        where: {
          userId,
          deviceId: meta.deviceId,
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        if (existing.isBlocked) {
          return {
            allowed: false,
            reason: "DEVICE_BLOCKED",
            message: "This device has been blocked by an administrator. Please contact support.",
          };
        }
        // If this same device is already active or re-logging in, allow immediately!
        if (!existing.revokedAt) {
          return {
            allowed: true,
            isExistingDevice: true,
            existingSessionId: existing.id,
          };
        }
      }
    }

    // 2. Check if user is permitted to use this category (Laptop/Desktop, Tablet, Mobile)
    const allowedCategories = user?.allowedDeviceTypes?.length
      ? user.allowedDeviceTypes
      : config.defaultAllowedTypes || ["DESKTOP", "TABLET", "MOBILE"];

    if (!allowedCategories.includes(category)) {
      const catLabel = category === "DESKTOP" ? "Laptop/Desktop" : category === "TABLET" ? "Tablet" : "Mobile Phone";
      return {
        allowed: false,
        reason: "CATEGORY_NOT_ALLOWED",
        message: `${catLabel} devices are not allowed for your account. Please contact admin.`,
      };
    }

    // If policy is MULTI_SESSION or SINGLE_SESSION, handle accordingly
    if (config.policy === "MULTI_SESSION") {
      return { allowed: true };
    }
    if (config.policy === "SINGLE_SESSION") {
      return { allowed: true }; // will supersede other sessions in createDeviceSession
    }

    // 3. CATEGORY_MANAGED Policy: Enforce category limits
    const maxPerCat = config.maxPerCategory || 1;
    const maxTotal = user?.maxActiveDevices || config.defaultMaxDevices || 3;

    // Check active sessions in this category
    const activeInCategory = await prisma.deviceSession.findMany({
      where: {
        userId,
        deviceCategory: category,
        revokedAt: null,
      },
      select: {
        id: true,
        deviceName: true,
        deviceCategory: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { lastActiveAt: "desc" },
    });

    if (activeInCategory.length >= maxPerCat) {
      return {
        allowed: false,
        reason: "CATEGORY_LIMIT_REACHED",
        message: `You have reached your limit of ${maxPerCat} ${category.toLowerCase()} device(s).`,
        conflictingSession: activeInCategory[0],
      };
    }

    // Check total active sessions across all categories
    const totalActive = await prisma.deviceSession.count({
      where: {
        userId,
        revokedAt: null,
      },
    });

    if (totalActive >= maxTotal) {
      return {
        allowed: false,
        reason: "TOTAL_LIMIT_REACHED",
        message: `Maximum active device limit (${maxTotal}) reached across all devices.`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("checkDeviceLoginAllowed error (failing open):", err);
    return { allowed: true };
  }
}

/**
 * Called on successful authorize(). Creates or refreshes a DeviceSession row.
 */
export async function createDeviceSession(
  userId: string,
  meta: RequestDeviceMeta,
  replaceSessionId?: string
): Promise<string | null> {
  try {
    const config = await prisma.securityConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", policy: "CATEGORY_MANAGED" },
    });

    const parsed = parseUserAgent(meta.userAgent);
    const category = meta.deviceCategory || parsed.deviceCategory;
    const deviceName = meta.deviceName || `${parsed.os} (${parsed.browser})`;
    const deviceHash = hashDevice(meta.userAgent, meta.ip, meta.deviceId);
    const deviceType = category === "MOBILE" ? "Mobile" : category === "TABLET" ? "Tablet" : "Desktop";

    // If client requested replacing a specific active session (e.g. replaced old phone)
    if (replaceSessionId) {
      await prisma.deviceSession.updateMany({
        where: { id: replaceSessionId, userId },
        data: { revokedAt: new Date(), revokedReason: "REPLACED_BY_USER" },
      });
    }

    // If singleton policy is legacy SINGLE_SESSION, revoke others
    if (config.policy === "SINGLE_SESSION") {
      await prisma.deviceSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "SUPERSEDED_BY_NEW_LOGIN" },
      });
    }

    // Check if the same physical deviceId is logging in again
    if (meta.deviceId) {
      const existing = await prisma.deviceSession.findFirst({
        where: {
          userId,
          deviceId: meta.deviceId,
        },
      });

      if (existing) {
        const updated = await prisma.deviceSession.update({
          where: { id: existing.id },
          data: {
            deviceName,
            deviceCategory: category,
            deviceType,
            browser: meta.browser || parsed.browser,
            os: meta.os || parsed.os,
            ipAddress: meta.ip,
            revokedAt: null,
            revokedReason: null,
            lastActiveAt: new Date(),
          },
        });
        return updated.id;
      }
    }

    const session = await prisma.deviceSession.create({
      data: {
        userId,
        deviceId: meta.deviceId || null,
        deviceName,
        deviceCategory: category,
        deviceHash,
        deviceType,
        browser: meta.browser || parsed.browser,
        os: meta.os || parsed.os,
        ipAddress: meta.ip,
        screenRes: meta.screenRes || null,
        lastActiveAt: new Date(),
      },
    });

    return session.id;
  } catch (error) {
    console.error("createDeviceSession failed (login proceeds regardless):", error);
    return null;
  }
}

/**
 * Replaces an existing active device session with a new device session.
 */
export async function replaceDeviceSession(
  userId: string,
  oldSessionId: string,
  meta: RequestDeviceMeta
): Promise<string | null> {
  return createDeviceSession(userId, meta, oldSessionId);
}

/**
 * Validates whether the device session is still active and unblocked.
 * Periodically updates lastActiveAt to keep session timestamps fresh without heavy DB load.
 */
export async function isDeviceSessionValid(deviceSessionId: string | undefined): Promise<boolean> {
  if (!deviceSessionId) return true;
  try {
    const session = await prisma.deviceSession.findUnique({
      where: { id: deviceSessionId },
      select: { revokedAt: true, isBlocked: true, lastActiveAt: true },
    });
    if (!session) return true; // pre-existing token issued before this row existed
    if (session.revokedAt !== null || session.isBlocked) return false;

    // Asynchronously throttle lastActiveAt update (at most once every 15 minutes)
    const FIFTEEN_MINS_MS = 15 * 60 * 1000;
    if (Date.now() - new Date(session.lastActiveAt).getTime() > FIFTEEN_MINS_MS) {
      prisma.deviceSession
        .update({
          where: { id: deviceSessionId },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }

    return true;
  } catch (error) {
    console.error("isDeviceSessionValid check failed (failing open):", error);
    return true; // never lock anyone out because of a transient DB hiccup
  }
}
