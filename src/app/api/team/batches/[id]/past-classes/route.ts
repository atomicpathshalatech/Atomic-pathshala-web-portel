import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { pastClassCreateSchema } from "@/lib/validation/batch";
import { PastClassError, createPastClass, pastClassOptions } from "@/lib/batch/past-classes";
import { parseYouTubeVideoId } from "@/lib/youtube/video-link";
import { refreshYoutubeVideoStats } from "@/lib/youtube/video-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — chapters and teachers for the "Add past class" form. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const options = await pastClassOptions(params.id);
    if (!options) return apiError("Batch not found", 404);
    return apiSuccess(options);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST — adds a class that already happened: YouTube recording (+ notes
 * PDF) as a published lecture and a completed timetable entry on its real
 * date. See lib/batch/past-classes.ts.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);

    const input = pastClassCreateSchema.parse(await request.json());
    let created;
    try {
      created = await createPastClass(params.id, session.user.id, input);
    } catch (err) {
      if (err instanceof PastClassError) return apiError(err.message, err.status);
      throw err;
    }

    // The video's real length is this class's teaching time — fetch it now
    // (the daily refresh would pick it up anyway if YouTube is slow).
    const videoId = parseYouTubeVideoId(created.videoUrl);
    if (videoId) {
      await refreshYoutubeVideoStats([videoId]).catch((err) => console.warn("[past_class_video_stats]", err instanceof Error ? err.message : err));
    }

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "PAST_CLASS_ADDED",
          entityType: "BatchSchedule",
          entityId: created.scheduleId,
          metadata: { batchId: params.id, lectureId: created.lectureId, startsAt: input.startsAt.toISOString() },
        },
      })
      .catch(() => null);

    return apiSuccess(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
