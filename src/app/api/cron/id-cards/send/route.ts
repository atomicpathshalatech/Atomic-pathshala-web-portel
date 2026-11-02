import { NextRequest, NextResponse } from "next/server";
import { sendIdCardEmails } from "@/lib/id-card/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Same convention as the other crons: Bearer CRON_SECRET; always closed in production without it. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily: everyone who joined at least a day ago (new students after sign-up,
 * new team members after their account is created) gets their ID card by
 * email — or, while their photo is missing, one "upload your photo" note.
 * Whoever uploads the photo later gets the card the next day. Once per
 * person; anything not finished today is picked up tomorrow.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const registeredBefore = new Date(Date.now() - 20 * 3_600_000);
    const team = await sendIdCardEmails("TEAM", { limit: 10, deadlineMs: 15_000, registeredBefore });
    const students = await sendIdCardEmails("STUDENT", { limit: 40, deadlineMs: 35_000, registeredBefore });
    return NextResponse.json({ success: true, team: { ...team, skipped: team.skipped.length }, students: { ...students, skipped: students.skipped.length } });
  } catch (error) {
    console.error("[cron/id-cards/send] failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Internal Error" }, { status: 500 });
  }
}
