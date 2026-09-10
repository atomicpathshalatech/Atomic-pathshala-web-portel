import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { whiteboardSessionPatchSchema } from "@/lib/validation/whiteboard";
import { pushPageChanged, pushLivePhaseChanged } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { startRoomRecording, recordingStorageKey } from "@/lib/livekit/egress";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    if (access.role === "TEACHER") {
      const wbSession = await prisma.whiteboardSession.findUnique({
        where: { id: params.id },
        include: { pages: { orderBy: { pageNumber: "asc" } }, batchSchedule: { select: { endsAt: true } } },
      });
      if (!wbSession) return apiError("Whiteboard session not found", 404);
      return apiSuccess({ whiteboardSession: { ...wbSession, endsAt: wbSession.batchSchedule.endsAt }, role: access.role });
    }

    // This endpoint still only ever hands students session status, not
    // page/objects data — that would mean re-sending the whole session
    // (every page) on every poll. Board mirroring instead has its own
    // narrow endpoint, GET .../board, which only ever exposes the single
    // *active* page a viewer is meant to see (see TESTS_VIDEO_UPDATE_README.md).
    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        status: true,
        livePhase: true,
        startedAt: true,
        endedAt: true,
        batchSchedule: { select: { endsAt: true } },
      },
    });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    const { batchSchedule, ...rest } = wbSession;
    return apiSuccess({ whiteboardSession: { ...rest, endsAt: batchSchedule.endsAt }, role: access.role });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Teacher-only. Switches the active page (for page-flip during class) and/or
 * renames the session. Deliberately NOT audit-logged — a page flip happens
 * many times a minute during a live class and isn't the kind of accountable
 * action audit logs exist for (compare WHITEBOARD_SESSION_STARTED/ENDED,
 * which are logged). Logging every flip would be the API-level equivalent of
 * the "no request per stroke" performance rule this build follows.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const existing = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Whiteboard session not found", 404);
    if (existing.status === "ENDED") return apiError("This session has ended.", 409);

    const input = whiteboardSessionPatchSchema.parse(await request.json());

    if (input.activePageNumber !== undefined) {
      const pageExists = await prisma.whiteboardPage.findUnique({
        where: {
          sessionId_pageNumber: { sessionId: params.id, pageNumber: input.activePageNumber },
        },
      });
      if (!pageExists) return apiError("That page does not exist on this session.", 400);
    }

    // The lobby → live transition: only a forward move out of the pre-class
    // lobby, and only once. Silently accepted (not an error) if the class is
    // already LIVE — the "Start Class" button firing twice (double-click,
    // stale UI after a resume) shouldn't 409 the teacher.
    if (input.livePhase === "LIVE" && existing.livePhase !== "LIVE" && existing.livePhase !== "PREPARING" && existing.livePhase !== "WAITING_FOR_STREAM") {
      return apiError(`Cannot start class from its current state (${existing.livePhase}).`, 409);
    }

    if (input.livePhase === "LIVE" && existing.livePhase !== "LIVE") {
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: existing.batchScheduleId },
        include: {
          chapter: {
            include: {
              dpps: {
                select: { id: true, _count: { select: { questions: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (schedule?.chapterId && schedule.chapter) {
        const priorCompletedLectures = await prisma.batchSchedule.count({
          where: {
            chapterId: schedule.chapterId,
            startsAt: { lt: schedule.startsAt },
            status: "COMPLETED",
          },
        });

        const requiredDppSlot = Math.floor(priorCompletedLectures / 2);
        if (requiredDppSlot >= 1) {
          const requiredDpp = schedule.chapter.dpps[requiredDppSlot - 1];
          const hasQuestions = Boolean(requiredDpp && requiredDpp._count.questions > 0);

          if (!hasQuestions) {
            const isAdmin =
              session.user.role === "ADMIN" ||
              session.user.role === "SUPER_ADMIN" ||
              session.user.role === "FOUNDER" ||
              session.user.role === "ACADEMIC_HEAD";

            if (!isAdmin) {
              return apiError(
                `2 classes have been completed. Questions must be added to DPP ${requiredDppSlot} before this lecture can start. Please add questions to the DPP or obtain Admin permission.`,
                403
              );
            }
          }
        }
      }
    }

    let recordingEgressId = existing.recordingEgressId;
    let recordingStatus = existing.recordingStatus;

    if (input.livePhase === "LIVE" && existing.livePhase !== "LIVE") {
      const isAlreadyRecording =
        existing.recordingStatus === "RECORDING" ||
        existing.recordingStatus === "RECORDING_STARTING" ||
        existing.recordingStatus === "STARTING" ||
        Boolean(existing.recordingEgressId);

      // Auto-start LiveKit room recording if LiveKit video is enabled
      if (!isAlreadyRecording && (existing.videoTransport === "LIVEKIT" || existing.videoTransport === "BOTH")) {
        try {
          const { videoRoomName } = await import("@/lib/livekit/server");
          const roomName = videoRoomName(existing.id);
          const storageKey = recordingStorageKey(existing.id);
          const egress = await startRoomRecording(roomName, storageKey);
          if (egress?.egressId) {
            recordingEgressId = egress.egressId;
            recordingStatus = "RECORDING";
          }
        } catch (err) {
          console.warn("[startRoomRecording_fallback]", err);
          recordingStatus = "RECORDING_FAILED";
        }
      }

      await prisma.batchSchedule.update({
        where: { id: existing.batchScheduleId },
        data: { status: "LIVE" },
      }).catch(() => undefined);
    }


    const updated = await prisma.whiteboardSession.update({
      where: { id: params.id },
      data: {
        ...(input.activePageNumber !== undefined && { activePageNumber: input.activePageNumber }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.chatEnabled !== undefined && { chatEnabled: input.chatEnabled }),
        ...(input.handRaiseEnabled !== undefined && { handRaiseEnabled: input.handRaiseEnabled }),
        ...(input.livePhase !== undefined && {
          livePhase: input.livePhase,
          ...(input.livePhase === "LIVE" && !existing.actualStartedAt && { actualStartedAt: new Date() }),
        }),
        ...(recordingEgressId && { recordingEgressId, recordingStatus }),
      },
    });

    if (input.activePageNumber !== undefined && input.activePageNumber !== existing.activePageNumber) {
      await pushPageChanged(params.id, updated.activePageNumber);
    }

    if (input.livePhase === "LIVE" && existing.livePhase !== "LIVE") {
      await pushLivePhaseChanged(params.id, "LIVE");
    }

    if (input.chatEnabled !== undefined || input.handRaiseEnabled !== undefined) {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.CONFIG_UPDATED, {
        chatEnabled: updated.chatEnabled,
        handRaiseEnabled: updated.handRaiseEnabled,
      }).catch(() => undefined);
    }

    return apiSuccess({ whiteboardSession: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
