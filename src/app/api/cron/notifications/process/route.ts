import { NextRequest, NextResponse } from "next/server";
import { processDueNotifications } from "@/lib/notifications/scheduler";
import { generateDailyTargetsForAllActiveStudents } from "@/lib/notifications/dailyTargetEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const queueResult = await processDueNotifications();

    let dailyTargetsSent = 0;
    if (req.nextUrl.searchParams.get("dailyTargets") === "true") {
      dailyTargetsSent = await generateDailyTargetsForAllActiveStudents();
    }

    return NextResponse.json({
      success: true,
      queue: queueResult,
      dailyTargetsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron Notification Process Error]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
