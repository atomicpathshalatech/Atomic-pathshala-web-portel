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
    const filter = searchParams.get("filter") || "ALL"; // ALL, HIGH_INTENT, WARM
    const searchQuery = searchParams.get("q")?.trim().toLowerCase() || "";

    // Fetch visitor page activity logs from the last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const logs = await prisma.pageActivityLog.findMany({
      where: {
        createdAt: { gte: fourteenDaysAgo },
        role: { in: ["GUEST", "STUDENT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    // Group logs by visitorId or IP
    const visitorsMap = new Map<string, typeof logs>();
    for (const log of logs) {
      const key = log.visitorId || log.ipAddress || log.id;
      const list = visitorsMap.get(key) || [];
      list.push(log);
      visitorsMap.set(key, list);
    }

    const leads = Array.from(visitorsMap.entries())
      .map(([visitorKey, visitLogs]) => {
        if (!visitLogs || visitLogs.length === 0) return null;

        // Sort visits chronologically
        const sortedVisits = [...visitLogs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const firstVisit = sortedVisits[0];
        const latestVisit = sortedVisits[sortedVisits.length - 1];
        if (!firstVisit || !latestVisit) return null;

        const pageViewsCount = sortedVisits.length;
        const uniquePages = [...new Set(sortedVisits.map((v) => v.path))];

        // Detect high intent signals
        let hasViewedPricing = false;
        let hasClickedEnroll = false;
        let hasViewedCourse = false;
        let hasSearched = false;
        let targetExamInterest = "General";

        for (const v of sortedVisits) {
          const p = v.path.toLowerCase();
          if (p.includes("pricing") || p.includes("subscription") || p.includes("plans")) {
            hasViewedPricing = true;
          }
          if (p.includes("enroll") || p.includes("buy") || p.includes("checkout") || v.action === "ENROLL_CLICK") {
            hasClickedEnroll = true;
          }
          if (p.includes("courses") || p.includes("batches") || p.includes("batch/")) {
            hasViewedCourse = true;
          }
          if (p.includes("neet")) targetExamInterest = "NEET";
          else if (p.includes("jee")) targetExamInterest = "JEE";
          else if (p.includes("foundation") || p.includes("class-10") || p.includes("class-9")) targetExamInterest = "Foundation";

          if (v.action === "SEARCH" || v.path.includes("search")) {
            hasSearched = true;
          }
        }

        // Calculate Lead Intent Score (0 - 100)
        let intentScore = 10;
        if (hasClickedEnroll) intentScore += 45;
        if (hasViewedPricing) intentScore += 25;
        if (hasViewedCourse) intentScore += 15;
        if (hasSearched) intentScore += 5;
        if (pageViewsCount >= 5) intentScore += 10;
        intentScore = Math.min(100, intentScore);

        let intentTier: "HOT" | "WARM" | "COLD" = "COLD";
        if (intentScore >= 70) intentTier = "HOT";
        else if (intentScore >= 40) intentTier = "WARM";

        // Journey Path preview (e.g. "/ -> /courses -> /pricing -> /checkout")
        const journeySteps = sortedVisits.slice(-5).map((v) => ({
          path: v.path,
          title: v.title || v.path,
          time: v.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          action: v.action,
        }));

        const isRegistered = sortedVisits.some((v) => v.userId !== null);
        const registeredUser = sortedVisits.find((v) => v.userName || v.userEmail);

        return {
          visitorKey,
          visitorId: latestVisit.visitorId,
          userId: latestVisit.userId,
          userName: registeredUser?.userName || null,
          userEmail: registeredUser?.userEmail || null,
          isRegistered,
          ipAddress: latestVisit.ipAddress || "—",
          city: latestVisit.city || "Unknown",
          country: latestVisit.country || "IN",
          deviceType: latestVisit.deviceType || "DESKTOP",
          browser: latestVisit.browser || "Browser",
          pageViewsCount,
          uniquePagesCount: uniquePages.length,
          firstSeenAt: firstVisit.createdAt.toISOString(),
          lastSeenAt: latestVisit.createdAt.toISOString(),
          intentScore,
          intentTier,
          targetExamInterest,
          hasViewedPricing,
          hasClickedEnroll,
          hasViewedCourse,
          dropOffPage: latestVisit.path,
          journeySteps,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const filtered = leads
      .filter((l) => {
        if (filter === "HIGH_INTENT" && l.intentTier !== "HOT") return false;
        if (filter === "WARM" && l.intentTier !== "WARM") return false;
        if (!searchQuery) return true;
        return (
          l.city.toLowerCase().includes(searchQuery) ||
          l.ipAddress.toLowerCase().includes(searchQuery) ||
          l.targetExamInterest.toLowerCase().includes(searchQuery) ||
          l.dropOffPage.toLowerCase().includes(searchQuery) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(searchQuery)) ||
          (l.userName && l.userName.toLowerCase().includes(searchQuery))
        );
      })
      .sort((a, b) => b.intentScore - a.intentScore || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .slice(0, 100);

    const hotLeadsCount = leads.filter((l) => l.intentTier === "HOT").length;
    const warmLeadsCount = leads.filter((l) => l.intentTier === "WARM").length;
    const totalUniqueVisitors = leads.length;

    return NextResponse.json({
      ok: true,
      summary: {
        totalUniqueVisitors,
        hotLeadsCount,
        warmLeadsCount,
      },
      leads: filtered,
    });
  } catch (error) {
    console.error("[Visitors & Leads API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
