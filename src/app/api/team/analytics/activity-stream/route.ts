import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const canView = await hasPermission(session.user.id, PERMISSIONS.ANALYTICS_VIEW);
    if (!canView) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role") || "ALL";
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const query = searchParams.get("q")?.trim() || "";
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "100", 10)));

    const where: Record<string, unknown> = {};

    if (roleFilter !== "ALL") {
      if (roleFilter === "STAFF") {
        where.role = { in: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF", "OPERATIONS", "ACADEMIC_OPERATIONS", "FINANCE"] };
      } else if (roleFilter === "STUDENT") {
        where.role = "STUDENT";
      } else if (roleFilter === "GUEST") {
        where.role = "GUEST";
      } else if (roleFilter === "TEACHER") {
        where.role = { in: ["TEACHER", "FACULTY"] };
      } else {
        where.role = roleFilter;
      }
    }

    if (dateStr) {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    if (query) {
      where.OR = [
        { path: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { userName: { contains: query, mode: "insensitive" } },
        { userEmail: { contains: query, mode: "insensitive" } },
        { action: { contains: query, mode: "insensitive" } },
        { ipAddress: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
      ];
    }

    const [logs, totalCount, activeNowCount] = await Promise.all([
      prisma.pageActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoUrl: true,
              role: { select: { name: true, label: true } },
            },
          },
        },
      }),
      prisma.pageActivityLog.count({ where }),
      prisma.pageActivityLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // active in last 5 min
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      logs: logs.map((log) => ({
        id: log.id,
        visitorId: log.visitorId,
        userId: log.userId,
        userName: log.userName || log.user?.name || "Guest Visitor",
        userEmail: log.userEmail || log.user?.email || null,
        userPhotoUrl: log.user?.photoUrl || null,
        role: log.role || "GUEST",
        roleLabel: log.user?.role?.label || log.role,
        path: log.path,
        title: log.title,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        ipAddress: log.ipAddress,
        city: log.city,
        region: log.region,
        country: log.country,
        deviceType: log.deviceType,
        browser: log.browser,
        os: log.os,
        durationSeconds: log.durationSeconds,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      })),
      meta: {
        totalCount,
        activeNowCount,
        limit,
      },
    });
  } catch (error) {
    console.error("[Activity Stream API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
