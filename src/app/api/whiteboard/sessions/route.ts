import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { assertCanControlLiveClass, assertCanControlLecture } from "@/lib/live-class/ownership";
import { whiteboardSessionStartSchema } from "@/lib/validation/whiteboard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canTeacherEnterClass } from "@/lib/schedule/access-rules";

/**
 * Start-or-resume the live whiteboard for a scheduled class. There is at
 * most one WhiteboardSession per BatchSchedule (see the @unique on
 * batchScheduleId in schema.prisma) — calling this twice for the same
 * schedule resumes the existing session instead of erroring, so a teacher
 * who refreshes the page or briefly drops connection doesn't lose the board
 * or its pages.
 *
 * Binds to BatchSchedule rather than a `Lecture` entity — see the comment
 * above the WhiteboardSession model in schema.prisma for why.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const input = whiteboardSessionStartSchema.parse(await request.json());

    {
      const { alignRoomClockWithSchedule } = await import("@/lib/live-session/service");
      await alignRoomClockWithSchedule(input.batchScheduleId).catch(() => false);
    }
    const existing = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: input.batchScheduleId },
      include: { pages: { orderBy: { pageNumber: "asc" } }, batchSchedule: true },
    });

    if (existing) {
      // Only the class's controlling teacher or a LIVE_CLASS_ADMIN.
      const { teacher: controllingTeacher } = await assertCanControlLiveClass(session.user.id, existing.batchScheduleId);

      if (existing.status === "ACTIVE") {
        if (!existing.pages || existing.pages.length === 0) {
          // upsert, not create: two concurrent room loads (a refresh, a
          // second tab, React's double effect in dev) both reach this point
          // and a plain create made the loser fail with a unique violation.
          const p1 = await prisma.whiteboardPage.upsert({
            where: { sessionId_pageNumber: { sessionId: existing.id, pageNumber: 1 } },
            update: {},
            create: { sessionId: existing.id, pageNumber: 1, objects: [] },
          });
          existing.pages = [p1];
        }
        await markLiveSessionReady(existing, existing.batchSchedule, controllingTeacher!.id);
        return apiSuccess({ whiteboardSession: existing, resumed: true });
      }

      // Check entry window before resuming
      const now = new Date();
      const enterEval = canTeacherEnterClass(existing.batchSchedule, now);
      if (!enterEval.allowed) {
        return apiError(
          enterEval.reason || "Teacher entry opens 15 minutes before scheduled start time.",
          403,
          {
            code: enterEval.code || "ENTRY_TOO_EARLY",
            details: {
              opensAt: enterEval.opensAt.toISOString(),
              secondsUntilWindowOpens: enterEval.secondsUntilWindowOpens,
              serverTime: now.toISOString(),
            },
          }
        );
      }

      // existing.status !== "ACTIVE" here means this is a genuinely NEW
      // occurrence of a rescheduled/reused BatchSchedule, not a reconnect
      // to a still-live class (that already returned early above) - so the
      // previous occurrence's board must not leak into this one. Same fix
      // as src/app/api/team/live-class/[scheduleId]/start/route.ts.
      if (existing.pdfStatus === "GENERATING" || existing.pptxStatus === "GENERATING") {
        return apiError(
          "The previous class's recording/notes are still being finalized. Please try again in a minute.",
          409,
          { code: "PREVIOUS_OCCURRENCE_FINALIZING" }
        );
      }

      await prisma.whiteboardPage.deleteMany({ where: { sessionId: existing.id } });

      // Auto-generated first slide (chapter name, lecture number, the
      // teacher's own profile photo — never manually uploaded) — page 1 is
      // about to be recreated below for this new occurrence, so bake it in
      // directly rather than leaving a window where page 1 is blank.
      let startSlideUrl: string | null = null;
      try {
        const { generateCreative } = await import("@/lib/creative/engine");
        const result = await generateCreative("LECTURE_START_SLIDE", input.batchScheduleId);
        if (result.ok) startSlideUrl = result.assetUrl;
      } catch (slideErr) {
        console.error("[live_class_start_slide_error]", slideErr);
      }

      const resumed = await prisma.whiteboardSession.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          endedAt: null,
          actualEndedAt: null,
          livePhase: "PREPARING",
          activePageNumber: 1,
          recordingStatus: "NONE",
          recordingStorageKey: null,
          recordingEgressId: null,
          recordingDurationSeconds: null,
          pdfStatus: "NONE",
          pptxStatus: "NONE",
          pdfStorageKey: null,
          pptxStorageKey: null,
          pdfFileAssetId: null,
          pptxFileAssetId: null,
          pdfError: null,
          pptxError: null,
          finalizedAt: null,
          youtubeArchiveStatus: "NOT_ENABLED",
          youtubeArchiveVideoId: null,
          youtubeArchiveVideoUrl: null,
          youtubeArchiveUploadAttempts: 0,
          youtubeArchiveLastError: null,
          youtubeArchiveUploadStartedAt: null,
          youtubeArchiveUploadedAt: null,
          youtubeArchiveProcessedAt: null,
          youtubeArchiveUploadSessionUrl: null,
          youtubeArchiveUploadOffset: null,
          youtubeArchiveThumbnailStatus: "NOT_STARTED",
          youtubeArchiveThumbnailError: null,
          youtubeArchiveMetadataSnapshot: Prisma.JsonNull,
          // New occurrence: its own YouTube broadcast/video and timing — the
          // previous run's must not leak in (students were being put back
          // onto the old, finished broadcast).
          youtubeBroadcastId: null,
          youtubeStreamId: null,
          youtubeVideoId: null,
          youtubeLiveChatId: null,
          youtubeStatus: null,
          youtubeIngestUrl: null,
          youtubeStreamKey: null,
          recordingVideoId: null,
          actualStartedAt: null,
          scheduledStart: existing.batchSchedule.startsAt,
          scheduledEnd: existing.batchSchedule.endsAt,
          totalExtendedMinutes: 0,
          extensionHistory: Prisma.JsonNull,
          pages: { create: { pageNumber: 1, objects: [], ...(startSlideUrl && { background: startSlideUrl }) } },
        },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      });
      await markLiveSessionReady(resumed, existing.batchSchedule, controllingTeacher!.id);

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "WHITEBOARD_SESSION_RESUMED",
          entityType: "WhiteboardSession",
          entityId: existing.id,
          metadata: { batchScheduleId: input.batchScheduleId },
        },
      });

      return apiSuccess({ whiteboardSession: resumed, resumed: true });
    }

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: input.batchScheduleId },
    });

    if (!schedule) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: input.batchScheduleId },
      });
      if (lecture) {
        // Ownership is decided before the lecture → schedule upsert below writes anything.
        await assertCanControlLecture(session.user.id, lecture);
        const defaultBatch =
          (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
          (await prisma.batch.findFirst());
        if (defaultBatch) {
          try {
            const { computeISTScheduleDates } = await import("@/lib/date-utils");
            const { startsAt, endsAt } = computeISTScheduleDates(
              lecture.scheduledDate,
              lecture.startTime,
              lecture.durationMin || 60
            );

            schedule = await prisma.batchSchedule.upsert({
              where: { id: lecture.id },
              update: {
                title: lecture.title,
                startsAt,
                endsAt,
              },
              create: {
                id: lecture.id,
                title: lecture.title,
                type: "LIVE_CLASS",
                batchId: defaultBatch.id,
                teacherId: lecture.teacherId,
                chapterId: lecture.chapterId,
                startsAt,
                endsAt,
                createdById: session.user.id,
              },
            });
          } catch {
            schedule = await prisma.batchSchedule.findFirst({ where: { id: lecture.id } });
          }
        }
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);
    if (schedule.type !== "LIVE_CLASS") {
      return apiError(
        "The live whiteboard is only available for Live Class schedule entries.",
        400
      );
    }

    // Authoritative Teacher Entry Check (T-15)
    const now = new Date();
    const enterEval = canTeacherEnterClass(schedule, now);
    if (!enterEval.allowed) {
      return apiError(
        enterEval.reason || "Teacher entry opens 15 minutes before scheduled start time.",
        403,
        {
          code: enterEval.code || "ENTRY_TOO_EARLY",
          details: {
            opensAt: enterEval.opensAt.toISOString(),
            secondsUntilWindowOpens: enterEval.secondsUntilWindowOpens,
            serverTime: now.toISOString(),
          },
        }
      );
    }

    // Teaching claim: the schedule's assigned teacher, or a LIVE_CLASS_ADMIN
    // acting on the assigned teacher's behalf (src/lib/live-class/ownership.ts).
    const { teacher } = await assertCanControlLiveClass(session.user.id, schedule.id);
    if (!teacher) return apiError("Assigned teacher record could not be found.", 400);

    // Auto-generated first slide — see the comment on the equivalent block
    // in the "resumed" branch above; this is the brand-new-session path
    // (a teacher's very first entry into this scheduled class's room).
    let startSlideUrl: string | null = null;
    try {
      const { generateCreative } = await import("@/lib/creative/engine");
      const result = await generateCreative("LECTURE_START_SLIDE", schedule.id);
      if (result.ok) startSlideUrl = result.assetUrl;
    } catch (slideErr) {
      console.error("[live_class_start_slide_error]", slideErr);
    }

    const created = await prisma.whiteboardSession.create({
      data: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        scheduledStart: schedule.startsAt ? new Date(schedule.startsAt) : now,
        scheduledEnd: schedule.endsAt ? new Date(schedule.endsAt) : new Date(now.getTime() + 60 * 60 * 1000),
        livePhase: "PREPARING",
        pages: { create: { pageNumber: 1, objects: [], ...(startSlideUrl && { background: startSlideUrl }) } },
      },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });

    await markLiveSessionReady(created, schedule, teacher.id);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_SESSION_STARTED",
        entityType: "WhiteboardSession",
        entityId: created.id,
        metadata: { batchScheduleId: schedule.id, teacherId: teacher.id },
      },
    });

    return apiSuccess({ whiteboardSession: created, resumed: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Teacher entered the room inside the class window: make sure this
 * occurrence has its LiveSession row and mark it READY. Best-effort — the
 * teacher must still get into the room if lifecycle bookkeeping fails;
 * Start Class re-runs the same ensure step and fails loudly there.
 */
async function markLiveSessionReady(
  wb: { id: string; videoTransport: string; youtubeBroadcastId: string | null; youtubeVideoId: string | null; scheduledEnd: Date | null },
  schedule: { id: string; startsAt: Date; endsAt: Date },
  teacherId: string
) {
  try {
    const { ensureOpenLiveSession, transitionLiveSession } = await import("@/lib/live-session/service");
    const { effectiveClassEnd } = await import("@/lib/whiteboard/lifecycle");
    const open = await ensureOpenLiveSession({
      batchScheduleId: schedule.id,
      whiteboardSessionId: wb.id,
      controllingTeacherId: teacherId,
      plannedStartsAt: schedule.startsAt,
      plannedEndsAt: effectiveClassEnd(schedule.endsAt, wb.scheduledEnd),
      videoTransport: wb.videoTransport,
      youtubeBroadcastId: wb.youtubeBroadcastId,
      youtubeVideoId: wb.youtubeVideoId,
    });
    if (open.state === "SCHEDULED") await transitionLiveSession(open.id, "READY");
  } catch (err) {
    console.error("[live_session_ready_error]", schedule.id, err);
  }
}
