import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim().toUpperCase();

    // Summary statistics
    const [totalActiveSessions, desktopCount, tabletCount, mobileCount, totalBlocked] = await Promise.all([
      prisma.deviceSession.count({ where: { revokedAt: null } }),
      prisma.deviceSession.count({ where: { revokedAt: null, deviceCategory: "DESKTOP" } }),
      prisma.deviceSession.count({ where: { revokedAt: null, deviceCategory: "TABLET" } }),
      prisma.deviceSession.count({ where: { revokedAt: null, deviceCategory: "MOBILE" } }),
      prisma.deviceSession.count({ where: { isBlocked: true } }),
    ]);

    const whereUser: any = {};
    if (search) {
      whereUser.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && ["DESKTOP", "TABLET", "MOBILE"].includes(category)) {
      whereUser.deviceSessions = {
        some: {
          deviceCategory: category,
          revokedAt: null,
        },
      };
    }

    const users = await prisma.user.findMany({
      where: whereUser,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        allowedDeviceTypes: true,
        maxActiveDevices: true,
        role: { select: { name: true, label: true } },
        deviceSessions: {
          orderBy: { lastActiveAt: "desc" },
          take: 10,
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            deviceCategory: true,
            deviceType: true,
            browser: true,
            os: true,
            ipAddress: true,
            isBlocked: true,
            lastActiveAt: true,
            revokedAt: true,
            revokedReason: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastLoginAt: "desc" },
      take: 50,
    });

    const userList = users.map((u) => {
      const activeSessions = u.deviceSessions.filter((s) => !s.revokedAt);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        role: u.role?.label || u.role?.name || "Student",
        lastLoginAt: u.lastLoginAt,
        allowedDeviceTypes: u.allowedDeviceTypes || ["DESKTOP", "TABLET", "MOBILE"],
        maxActiveDevices: u.maxActiveDevices || 3,
        activeDeviceCount: activeSessions.length,
        desktopCount: activeSessions.filter((s) => s.deviceCategory === "DESKTOP").length,
        tabletCount: activeSessions.filter((s) => s.deviceCategory === "TABLET").length,
        mobileCount: activeSessions.filter((s) => s.deviceCategory === "MOBILE").length,
        devices: u.deviceSessions,
      };
    });

    return apiSuccess({
      stats: {
        totalActiveSessions,
        desktopCount,
        tabletCount,
        mobileCount,
        totalBlocked,
      },
      users: userList,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
