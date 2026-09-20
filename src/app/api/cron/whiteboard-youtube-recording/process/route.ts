import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRecordingStatus } from "@/lib/youtube/live-broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Safety net for "Application Class + YouTube" (videoTransport BOTH,
 * auto-created broadcast) — same shape as
 * /api/cron/classroom-recording/process, just against WhiteboardSession.
 * The live stream itself stops when the class ends (LiveKit Egress's
 * stream output stops with the rest of the egress); this sweep asks
 * YouTube when the resulting VOD is actually watchable and writes
 * recordingVideoId once it is. Deliberately separate from
 * /api/cron/youtube-archive/process, which handles a different pipeline
 * (uploading the R2 recording as a new video for LIVEKIT-only classes).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await prisma.whiteboardSession.findMany({
      where: {
        videoTransport: { in: ["YOUTUBE", "BOTH"] },
        youtubeVideoId: { not: null },
        recordingVideoId: null,
        livePhase: "ENDED",
      },
      select: { id: true, youtubeVideoId: true },
      take: 20,
    });

    let ready = 0;
    let stillProcessing = 0;
    let failed = 0;

    for (const s of pending) {
      try {
        const result = await fetchRecordingStatus(s.youtubeVideoId!);
        if (result.recordingStatus === "READY") {
          await prisma.whiteboardSession.update({
            where: { id: s.id },
            data: { recordingVideoId: result.recordingVideoId },
          });
          ready++;
        } else if (result.recordingStatus === "FAILED") {
          failed++;
        } else {
          stillProcessing++;
        }
      } catch (err) {
        console.error("[cron:whiteboard-youtube-recording] check failed", s.id, err);
      }
    }

    return NextResponse.json({ success: true, ready, stillProcessing, failed, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[cron:whiteboard-youtube-recording] fatal error", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
