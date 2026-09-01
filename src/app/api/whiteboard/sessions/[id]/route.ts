import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { whiteboardSessionPatchSchema } from "@/lib/validation/whiteboard";
import { pushPageChanged, pushLivePhaseChanged } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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

    const updated = await prisma.whiteboardSession.update({
      where: { id: params.id },
      data: {
        ...(input.activePageNumber !== undefined && { activePageNumber: input.activePageNumber }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.chatEnabled !== undefined && { chatEnabled: input.chatEnabled }),
        ...(input.handRaiseEnabled !== undefined && { handRaiseEnabled: input.handRaiseEnabled }),
        ...(input.livePhase !== undefined && { livePhase: input.livePhase }),
      },
    });

    if (input.activePageNumber !== undefined && input.activePageNumber !== existing.activePageNumber) {
      await pushPageChanged(params.id, updated.activePageNumber);
    }

    if (input.livePhase === "LIVE" && existing.livePhase !== "LIVE") {
      await pushLivePhaseChanged(params.id, "LIVE");
    }

    return apiSuccess({ whiteboardSession: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
