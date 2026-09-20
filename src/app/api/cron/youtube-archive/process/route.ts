import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Matches this account's confirmed plan ceiling (see the other cron routes'
// own comments — an earlier attempt at a more-frequent cron schedule broke
// the whole deployment outright). Scheduled once daily, alongside every
// other cron in vercel.json.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Safety net for the YouTube recording-archive pipeline
 * (src/lib/youtube/archive-service.ts). The primary path is fire-and-forget:
 * a recording reaching recordingStatus "READY" immediately kicks off
 * startArchiveJob(), which chunk-uploads with a self-continuation HTTP call
 * after each invocation's time budget. This cron exists for the cases that
 * primary path can't self-heal:
 *
 * 1. The initial trigger never fired at all (the webhook/reconcile
 *    invocation was killed right after its own DB write, before the
 *    fire-and-forget import() resolved) — recordingStatus is READY but
 *    youtubeArchiveStatus is still NOT_ENABLED.
 * 2. A continuation call never landed (cold start, dropped fetch, an
 *    invocation killed mid-chunk) — the job is stuck mid-flight with a
 *    stale youtubeArchiveUploadStartedAt.
 * 3. A job hit a transient failure and exhausted retries within one
 *    session's lifetime, but hasn't hit the hard attempt cap — give it
 *    another shot on the next day's run (e.g. a temporary Google API
 *    outage).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { startArchiveJob, runArchiveUpload } = await import("@/lib/youtube/archive-service");

    const notStarted = await prisma.whiteboardSession.findMany({
      // videoTransport: LIVEKIT excludes classes already live-streamed to
      // YouTube directly (Application Class + YouTube) — those get their
      // VOD from YouTube itself, so archiving the separately-recorded R2
      // file here would create a duplicate video.
      where: { recordingStatus: "READY", youtubeArchiveStatus: "NOT_ENABLED", isTest: false, videoTransport: "LIVEKIT" },
      select: { id: true },
      take: 20,
    });

    const staleCutoff = new Date(Date.now() - 15 * 60_000);
    const stuck = await prisma.whiteboardSession.findMany({
      where: {
        youtubeArchiveStatus: { in: ["PENDING", "QUEUED", "UPLOADING", "RETRYING"] },
        youtubeArchiveUploadStartedAt: { lt: staleCutoff },
      },
      select: { id: true },
      take: 20,
    });

    const retryableFailed = await prisma.whiteboardSession.findMany({
      where: { youtubeArchiveStatus: "FAILED", youtubeArchiveUploadAttempts: { lt: 5 }, recordingStatus: "READY" },
      select: { id: true },
      take: 20,
    });

    let started = 0;
    let resumed = 0;
    let retried = 0;

    for (const s of notStarted) {
      await startArchiveJob(s.id).catch((err) => console.error("[cron:youtube-archive] start failed", s.id, err));
      started++;
    }
    for (const s of stuck) {
      await runArchiveUpload(s.id).catch((err) => console.error("[cron:youtube-archive] resume failed", s.id, err));
      resumed++;
    }
    for (const s of retryableFailed) {
      await prisma.whiteboardSession
        .update({ where: { id: s.id }, data: { youtubeArchiveStatus: "RETRYING" } })
        .catch(() => null);
      await runArchiveUpload(s.id).catch((err) => console.error("[cron:youtube-archive] retry failed", s.id, err));
      retried++;
    }

    return NextResponse.json({ success: true, started, resumed, retried, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[cron:youtube-archive] fatal error", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
