import { NextRequest, NextResponse } from "next/server";
import { findTodaysBirthdaySubjects } from "@/lib/birthday/subjects";
import { sendBirthdayWish } from "@/lib/birthday/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same convention as api/cron/notifications/process — open when CRON_SECRET isn't set (dev), Bearer-gated once it is. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily birthday job (spec section 18: recommended 09:00 onwards). Finds
 * today's birthdays and sends one wish per subject — sendBirthdayWish()
 * itself is what actually enforces "once per subject per year", so running
 * this twice in a day (a redeploy, a manual re-trigger, an overlapping
 * invocation) is safe: every subject past the first run reports DUPLICATE
 * and is skipped, not re-sent.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const subjects = await findTodaysBirthdaySubjects();
    const results = { sent: 0, skipped: 0, failed: 0, duplicate: 0, total: subjects.length };

    for (const subject of subjects) {
      const outcome = await sendBirthdayWish(subject, { triggerType: "AUTOMATIC" });
      if (outcome.status === "SENT") results.sent++;
      else if (outcome.status === "SKIPPED") results.skipped++;
      else if (outcome.status === "DUPLICATE") results.duplicate++;
      else results.failed++;
    }

    return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    console.error("[cron/birthday] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
