import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRecordingStatus } from "@/lib/classroom/youtube-broadcast";
import { pusherServer, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";

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
 * Safety net for the Classroom recording pipeline. The primary path is the
 * .../end route setting phase PROCESSING_RECORDING immediately after
 * transitioning the YouTube broadcast to complete; a student-facing poll
 * could check videos.list itself, but centralizing it here means one write
 * path updates the DB regardless of whether anyone is actively viewing.
 * This cron sweeps every session still stuck in PROCESSING_RECORDING and
 * asks YouTube whether the VOD is ready yet.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await prisma.classroomSession.findMany({
      where: { phase: "PROCESSING_RECORDING", youtubeVideoId: { not: null } },
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
          await prisma.classroomSession.update({
            where: { id: s.id },
            data: { phase: "RECORDED", recordingVideoId: result.recordingVideoId, recordingStatus: "READY" },
          });
          await pusherServer
            .trigger(classroomChannel(s.id), CLASSROOM_EVENTS.PHASE_CHANGED, {
              phase: "RECORDED",
              recordingVideoId: result.recordingVideoId,
            })
            .catch(() => null);
          ready++;
        } else if (result.recordingStatus === "FAILED") {
          await prisma.classroomSession.update({
            where: { id: s.id },
            data: { recordingStatus: "FAILED" },
          });
          failed++;
        } else {
          stillProcessing++;
        }
      } catch (err) {
        console.error("[cron:classroom-recording] check failed", s.id, err);
      }
    }

    return NextResponse.json({ success: true, ready, stillProcessing, failed, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[cron:classroom-recording] fatal error", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
