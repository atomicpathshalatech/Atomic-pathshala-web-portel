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
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const staffType = searchParams.get("type") || "ALL"; // ALL, TEACHER, ADMIN, OPERATIONS
    const searchQuery = searchParams.get("q")?.trim().toLowerCase() || "";

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Fetch all users with staff/teacher roles
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: {
            notIn: ["STUDENT"],
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        photoUrl: true,
        role: { select: { id: true, name: true, label: true } },
        teacher: {
          select: {
            id: true,
            employeeCode: true,
            department: true,
            subjects: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Fetch all page activity logs for this day for these users
    const userIds = users.map((u) => u.id);
    const [dailyLogs, deviceSessions] = await Promise.all([
      prisma.pageActivityLog.findMany({
        where: {
          userId: { in: userIds },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.deviceSession.findMany({
        where: {
          userId: { in: userIds },
          revokedAt: null,
          isBlocked: false,
        },
        orderBy: { lastActiveAt: "desc" },
      }),
    ]);

    // Group logs by user
    const logsByUser = new Map<string, typeof dailyLogs>();
    for (const log of dailyLogs) {
      if (!log.userId) continue;
      const list = logsByUser.get(log.userId) || [];
      list.push(log);
      logsByUser.set(log.userId, list);
    }

    const sessionsByUser = new Map<string, (typeof deviceSessions)[0]>();
    for (const s of deviceSessions) {
      if (!sessionsByUser.has(s.userId)) {
        sessionsByUser.set(s.userId, s);
      }
    }

    const staffRecords = users
      .map((u) => {
        const logs = logsByUser.get(u.id) || [];
        const latestSession = sessionsByUser.get(u.id);

        const isTeacher = Boolean(u.teacher);
        const roleName = u.role?.name || "STAFF";
        const roleLabel = u.role?.label || u.role?.name || "Staff";

        // Filter by staff type if specified
        if (staffType === "TEACHER" && !isTeacher) return null;
        if (staffType === "ADMIN" && !roleName.includes("ADMIN")) return null;
        if (staffType === "OPERATIONS" && !roleName.includes("OPERATION")) return null;

        // Search filter
        if (
          searchQuery &&
          !u.name.toLowerCase().includes(searchQuery) &&
          !u.email.toLowerCase().includes(searchQuery) &&
          !(u.teacher?.department && u.teacher.department.toLowerCase().includes(searchQuery))
        ) {
          return null;
        }

        const totalActionsToday = logs.length;
        const firstActive = logs.length > 0 && logs[0] ? logs[0].createdAt : null;
        const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const lastActive = lastLog ? lastLog.createdAt : latestSession?.lastActiveAt || null;

        // Check if currently online (active within 5 min)
        const isOnline = lastActive ? new Date(lastActive).getTime() >= fiveMinutesAgo.getTime() : false;

        // Total active time calculation in minutes
        let totalActiveSeconds = logs.reduce((sum, l) => sum + (l.durationSeconds || 15), 0);
        if (totalActiveSeconds === 0 && logs.length > 1 && logs[0] && lastLog) {
          const spanMs = new Date(lastLog.createdAt).getTime() - new Date(logs[0].createdAt).getTime();
          totalActiveSeconds = Math.round(spanMs / 1000);
        }
        const totalActiveMinutes = Math.round(totalActiveSeconds / 60);

        // Location & device from latest activity
        const latestLog = lastLog;
        const ipAddress = latestLog?.ipAddress || latestSession?.ipAddress || "—";
        const city = latestLog?.city || "Unknown";
        const country = latestLog?.country || "IN";
        const deviceType = latestLog?.deviceType || latestSession?.deviceCategory || "DESKTOP";
        const browser = latestLog?.browser || latestSession?.browser || "Browser";
        const os = latestLog?.os || latestSession?.os || "OS";

        // Action trail timeline
        const actionTrail = logs.map((l) => ({
          id: l.id,
          time: l.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          path: l.path,
          title: l.title || l.path,
          action: l.action,
          durationSeconds: l.durationSeconds,
          ipAddress: l.ipAddress,
        }));

        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          photoUrl: u.photoUrl,
          roleName,
          roleLabel,
          isTeacher,
          department: u.teacher?.department || null,
          employeeCode: u.teacher?.employeeCode || null,
          subjects: u.teacher?.subjects || [],
          isOnline,
          totalActionsToday,
          totalActiveMinutes,
          firstActive: firstActive ? firstActive.toISOString() : null,
          lastActive: lastActive ? new Date(lastActive).toISOString() : null,
          ipAddress,
          city,
          country,
          deviceType,
          browser,
          os,
          actionTrail,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // Online users first, then by total actions today descending
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return b.totalActionsToday - a.totalActionsToday;
      });

    return NextResponse.json({
      ok: true,
      date: dateStr,
      summary: {
        totalStaffCount: staffRecords.length,
        activeTodayCount: staffRecords.filter((s) => s.totalActionsToday > 0).length,
        onlineNowCount: staffRecords.filter((s) => s.isOnline).length,
      },
      staff: staffRecords,
    });
  } catch (error) {
    console.error("[Staff Presence API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
