import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { allowedIncrement, parseContentKey } from "@/lib/video/watch-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const beatSchema = z.object({
  contentKey: z.string().max(100),
  playedSec: z.number().min(0).max(3600),
  positionSec: z.number().min(0).max(24 * 3600).optional(),
  durationSec: z.number().min(0).max(24 * 3600).optional(),
});

/**
 * POST — a watch-time heartbeat from the recorded-class player (see
 * lib/video/use-watch-heartbeat). Adds the seconds actually played, capped
 * by wall time since this student's previous beat for the same video.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiSuccess({ tracked: false }); // staff previewing a class: nothing to record

    const beat = beatSchema.parse(await request.json());
    const key = parseContentKey(beat.contentKey);
    if (!key) return apiError("Unknown video", 400);

    let lectureId: string | null = null;
    let batchScheduleId: string | null = null;
    if (key.kind === "lecture") {
      const lecture = await prisma.lecture.findUnique({ where: { id: key.id }, select: { id: true } });
      if (!lecture) return apiError("Unknown video", 404);
      lectureId = lecture.id;
    } else {
      const schedule = await prisma.batchSchedule.findUnique({ where: { id: key.id }, select: { id: true, batchId: true } });
      if (!schedule) return apiError("Unknown video", 404);
      const enrolled = await prisma.batchEnrollment.count({ where: { studentId: student.id, batchId: schedule.batchId, status: "ACTIVE" } });
      if (!enrolled) return apiError("Not enrolled", 403);
      batchScheduleId = schedule.id;
    }

    const existing = await prisma.videoWatch.findUnique({
      where: { studentId_contentKey: { studentId: student.id, contentKey: beat.contentKey } },
      select: { lastWatchedAt: true },
    });
    const add = allowedIncrement(beat.playedSec, existing ? Date.now() - existing.lastWatchedAt.getTime() : null);
    const now = new Date();
    await prisma.videoWatch.upsert({
      where: { studentId_contentKey: { studentId: student.id, contentKey: beat.contentKey } },
      create: {
        studentId: student.id,
        contentKey: beat.contentKey,
        lectureId,
        batchScheduleId,
        watchedSec: add,
        lastPositionSec: Math.floor(beat.positionSec ?? 0),
        durationSec: beat.durationSec ? Math.floor(beat.durationSec) : null,
        firstWatchedAt: now,
        lastWatchedAt: now,
      },
      update: {
        watchedSec: { increment: add },
        lastPositionSec: Math.floor(beat.positionSec ?? 0),
        ...(beat.durationSec ? { durationSec: Math.floor(beat.durationSec) } : {}),
        lastWatchedAt: now,
      },
    });
    return apiSuccess({ tracked: true, added: add });
  } catch (error) {
    return handleApiError(error);
  }
}
