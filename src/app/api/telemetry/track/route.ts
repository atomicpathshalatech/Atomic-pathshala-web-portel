import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseDevice(ua: string) {
  let deviceType = "DESKTOP";
  let browser = "Other";
  let os = "Other";

  if (!ua) return { deviceType, browser, os };

  if (/mobile/i.test(ua)) deviceType = "MOBILE";
  else if (/tablet|ipad/i.test(ua)) deviceType = "TABLET";

  if (/chrome|crios/i.test(ua) && !/edg|opr/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edg/i.test(ua)) browser = "Edge";
  else if (/opr|opera/i.test(ua)) browser = "Opera";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { deviceType, browser, os };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));
    const {
      visitorId,
      path,
      title,
      action = "PAGE_VIEW",
      entityType,
      entityId,
      durationSeconds = 0,
      metadata = {},
    } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });
    }

    // Ignore telemetry ping on telemetry itself or static assets
    if (path.startsWith("/api/telemetry") || path.startsWith("/_next") || path.includes("/favicon")) {
      return NextResponse.json({ ok: true });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "127.0.0.1";

    const userAgent = request.headers.get("user-agent") || "";
    const { deviceType, browser, os } = parseDevice(userAgent);

    const city = request.headers.get("x-vercel-ip-city") || request.headers.get("cf-ipcity") || null;
    const region = request.headers.get("x-vercel-ip-country-region") || request.headers.get("cf-region") || null;
    const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry") || "IN";

    let userId: string | null = null;
    let userName: string | null = null;
    let userEmail: string | null = null;
    let role: string = "GUEST";

    if (session?.user?.id) {
      userId = session.user.id;
      userName = session.user.name ?? null;
      userEmail = session.user.email ?? null;
      role = (session.user as { role?: string }).role || "STUDENT";
    }

    // Insert activity log
    await prisma.pageActivityLog.create({
      data: {
        visitorId: visitorId || null,
        userId,
        userName,
        userEmail,
        role,
        path: path.slice(0, 500),
        title: title ? String(title).slice(0, 200) : null,
        action: String(action).slice(0, 50),
        entityType: entityType ? String(entityType).slice(0, 50) : null,
        entityId: entityId ? String(entityId).slice(0, 100) : null,
        ipAddress: ipAddress.slice(0, 60),
        city: city ? city.slice(0, 100) : null,
        region: region ? region.slice(0, 100) : null,
        country: country ? country.slice(0, 50) : null,
        deviceType,
        browser,
        os,
        durationSeconds: typeof durationSeconds === "number" ? Math.max(0, durationSeconds) : 0,
        metadata: typeof metadata === "object" ? metadata : {},
      },
    });

    // Update DeviceSession lastActiveAt if logged in user has a session
    if (userId) {
      await prisma.deviceSession.updateMany({
        where: { userId, isBlocked: false, revokedAt: null },
        data: { lastActiveAt: new Date(), ipAddress },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[Telemetry] Failed to record activity:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
