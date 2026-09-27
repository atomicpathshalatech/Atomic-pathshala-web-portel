import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Safety net for YouTube-delivered classes (APP_YOUTUBE / MAIN_YOUTUBE /
 * EXTERNAL_YOUTUBE): for every occurrence still RECORDING_PROCESSING, ask
 * YouTube whether the recording is watchable yet (checkRecordingReadiness —
 * 1 quota unit each, single-flight). Only a confirmed-processed recording
 * becomes READY and gets its lecture link published. The replay page runs
 * the same check on demand, so this sweep only catches classes nobody has
 * opened yet.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await prisma.liveSession.findMany({
      where: {
        state: "RECORDING_PROCESSING",
        deliveryMode: { in: ["APP_YOUTUBE", "MAIN_YOUTUBE", "EXTERNAL_YOUTUBE"] },
        youtubeVideoId: { not: null },
      },
      select: { id: true },
      orderBy: { stateChangedAt: "asc" },
      take: 40,
    });

    const { checkRecordingReadiness } = await import("@/lib/live-session/app-youtube");
    const outcome: Record<string, number> = {};
    for (const s of pending) {
      try {
        const state = await checkRecordingReadiness(s.id);
        outcome[state] = (outcome[state] ?? 0) + 1;
      } catch (err) {
        console.error("[cron:whiteboard-youtube-recording] check failed", s.id, err);
        outcome.ERROR = (outcome.ERROR ?? 0) + 1;
      }
    }

    return NextResponse.json({ success: true, checked: pending.length, outcome, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[cron:whiteboard-youtube-recording] fatal error", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
