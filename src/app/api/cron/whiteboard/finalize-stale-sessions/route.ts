import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPastGracePeriod, effectiveClassEnd, endWhiteboardSession } from "@/lib/whiteboard/lifecycle";
import { authoritativeEndFor } from "@/lib/live-session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Server-side safety net for the live whiteboard's PDF/PPTX finalization.
 *
 * Board strokes are already durable — every commit autosaves to Postgres
 * (see TeacherLiveClassRoom.tsx's per-stroke debounce). What was NOT durable
 * before this route existed: the session's ENDED transition, which is what
 * actually triggers PDF/PPTX generation + R2 upload. That transition only
 * ever fired from an explicit "End Class" click, or lazily inside
 * resolveWhiteboardAccess the next time *anyone* touched the session — which
 * never happens at all if the teacher just closes the tab and no student
 * revisits it. `resolveWhiteboardAccess`'s own comment says as much: "there
 * is no cron/worker in this app." This is that worker, running on the
 * existing cron pattern (see vercel.json + the other routes under
 * src/app/api/cron/) rather than introducing a new job system.
 *
 * Scheduled once daily (matching every other cron in this project) —
 * Vercel's Hobby plan rejects the entire deployment if any cron schedule
 * would run more often than once a day (confirmed: an earlier version of
 * this route scheduled every 15 minutes and failed the production deploy
 * outright). On the Pro plan or above this could safely run every few
 * minutes for much faster recovery; worth revisiting if the account is
 * upgraded and a tighter window matters.
 *

 * Two independent passes:
 * 1. Sessions still ACTIVE past their scheduled end + grace period — ends
 *    them via the exact same endWhiteboardSession() every other caller
 *    uses, which itself triggers finalizeWhiteboardSlides.
 * 2. Sessions that already ended but whose PDF/PPTX never reached READY
 *    (finalizeWhiteboardSlides is fire-and-forget from endWhiteboardSession
 *    — a killed process or a genuine failure leaves pdfStatus stuck on
 *    NONE/FAILED forever with nothing to retry it). Only retries sessions
 *    that ended more than a few minutes ago, so one that's mid-generation
 *    right now isn't picked up and re-run concurrently with itself.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const staleActive = await prisma.whiteboardSession.findMany({
      where: { status: "ACTIVE" },
      include: { batchSchedule: { select: { id: true, endsAt: true } } },
      take: 50,
    });

    let autoEnded = 0;
    for (const s of staleActive) {
      if (
        isPastGracePeriod(effectiveClassEnd(s.batchSchedule.endsAt, s.scheduledEnd)) &&
        isPastGracePeriod(await authoritativeEndFor(s))
      ) {
        await endWhiteboardSession(s.id, { endedByUserId: null, reason: "auto_grace_expired" });
        autoEnded++;
      }
    }

    const retryCutoff = new Date(Date.now() - 5 * 60_000);
    const staleFinalization = await prisma.whiteboardSession.findMany({
      where: {
        endedAt: { lt: retryCutoff, not: null },
        OR: [{ pdfStatus: { in: ["NONE", "FAILED"] } }, { pptxStatus: { in: ["NONE", "FAILED"] } }],
      },
      select: { id: true },
      take: 50,
    });

    let retriedFinalization = 0;
    if (staleFinalization.length > 0) {
      const { finalizeWhiteboardSlides } = await import("@/lib/whiteboard/finalization");
      for (const s of staleFinalization) {
        try {
          await finalizeWhiteboardSlides(s.id);
          retriedFinalization++;
        } catch (err) {
          console.error("[cron:whiteboard-finalize] retry failed for session", s.id, err);
        }
      }
    }

    // Stream slots held by classes that are over (or past their expiry) go
    // back to the pool — covers a broadcast-complete call that failed at End.
    const { sweepStaleLeases } = await import("@/lib/youtube/stream-pool");
    const releasedLeases = await sweepStaleLeases().catch((err) => {
      console.error("[cron:whiteboard-finalize] lease sweep failed", err);
      return 0;
    });

    return NextResponse.json({
      success: true,
      autoEnded,
      retriedFinalization,
      releasedLeases,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron Whiteboard Finalize Error]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
