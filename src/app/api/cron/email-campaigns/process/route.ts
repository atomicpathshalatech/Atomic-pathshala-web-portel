import { NextRequest, NextResponse } from "next/server";
import { activateDueScheduledCampaigns, processEmailQueue } from "@/lib/email/campaign-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The backend email queue's worker (spec section 10 — no frontend loop over
 * thousands of recipients). Two phases per run: activate any SCHEDULED
 * campaign whose time has arrived (resolves + queues its recipients), then
 * send a bounded batch of whatever's QUEUED. Safe to run as often as
 * desired / re-trigger manually — everything here is idempotent.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { activated } = await activateDueScheduledCampaigns();
    const { sent, failed } = await processEmailQueue(50);

    return NextResponse.json({ success: true, activated, sent, failed, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    console.error("[cron/email-campaigns/process] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
