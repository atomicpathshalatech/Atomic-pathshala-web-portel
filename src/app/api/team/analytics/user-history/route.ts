import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

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
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");
    const limit = Math.min(1000, Math.max(20, parseInt(searchParams.get("limit") || "500", 10)));

    if (!userId && !email) {
      return NextResponse.json({ ok: false, error: "userId or email is required" }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: email! },
      select: {
        id: true,
        name: true,
        email: true,
        photoUrl: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, label: true } },
        teacher: {
          select: {
            employeeCode: true,
            department: true,
            subjects: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Fetch device sessions and activity logs
    const [sessions, logs] = await Promise.all([
      prisma.deviceSession.findMany({
        where: { userId: user.id },
        orderBy: { lastActiveAt: "desc" },
        take: 20,
      }),
      prisma.pageActivityLog.findMany({
        where: {
          OR: [{ userId: user.id }, { userEmail: user.email }],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    // Group logs by Date (Asia/Kolkata date format YYYY-MM-DD)
    const dateGroupsMap = new Map<
      string,
      {
        date: string;
        formattedDate: string;
        logs: typeof logs;
      }
    >();

    for (const log of logs) {
      const logDate = new Date(log.createdAt);
      // Format as YYYY-MM-DD in Indian Standard Time (UTC+5:30)
      const istDateStr = logDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // Returns YYYY-MM-DD
      const formattedDate = logDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      if (!dateGroupsMap.has(istDateStr)) {
        dateGroupsMap.set(istDateStr, {
          date: istDateStr,
          formattedDate,
          logs: [],
        });
      }
      dateGroupsMap.get(istDateStr)!.logs.push(log);
    }

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const dateHistory = Array.from(dateGroupsMap.values()).map((group) => {
      const dayLogs = group.logs;
      const totalActions = dayLogs.length;

      // Oldest log of that day is first active
      const firstLog = dayLogs[dayLogs.length - 1];
      const lastLog = dayLogs[0];

      let label = group.formattedDate;
      if (group.date === todayStr) label = `Today — ${group.formattedDate}`;
      else if (group.date === yesterdayStr) label = `Yesterday — ${group.formattedDate}`;

      // Unique pages checked on that date
      const checkedPages = Array.from(
        new Set(dayLogs.map((l) => l.title || l.path).filter(Boolean))
      ).slice(0, 10);

      const actionList = dayLogs.map((l) => ({
        id: l.id,
        action: l.action,
        path: l.path,
        title: l.title || l.path,
        time: new Date(l.createdAt).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        createdAt: l.createdAt.toISOString(),
        durationSeconds: l.durationSeconds,
        ipAddress: l.ipAddress,
        city: l.city,
        deviceType: l.deviceType,
        browser: l.browser,
        os: l.os,
        metadata: l.metadata,
      }));

      return {
        date: group.date,
        label,
        formattedDate: group.formattedDate,
        totalActions,
        firstActiveTime: firstLog
          ? new Date(firstLog.createdAt).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        lastActiveTime: lastLog
          ? new Date(lastLog.createdAt).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        checkedPages,
        actions: actionList,
      };
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        roleName: user.role?.name || "STAFF",
        roleLabel: user.role?.label || user.role?.name || "Staff",
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        registeredAt: user.createdAt.toISOString(),
        department: user.teacher?.department || null,
        employeeCode: user.teacher?.employeeCode || null,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName || `${s.os || "Device"} • ${s.browser || "Browser"}`,
        deviceCategory: s.deviceCategory,
        ipAddress: s.ipAddress,
        browser: s.browser,
        os: s.os,
        lastActiveAt: s.lastActiveAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        isBlocked: s.isBlocked,
      })),
      totalLogsCount: logs.length,
      totalActiveDays: dateHistory.length,
      dateHistory,
    });
  } catch (error) {
    console.error("[User History API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
