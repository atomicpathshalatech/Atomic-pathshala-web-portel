import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushHandRaiseQueue } from "@/lib/whiteboard/hand-raise";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Teacher-only: current raised-hand queue, oldest first. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const [queue, wbSession] = await Promise.all([
      prisma.handRaiseEvent.findMany({
        where: { whiteboardSessionId: params.id, status: { in: ["PENDING", "APPROVED"] } },
        include: { student: { include: { user: true } } },
        orderBy: { raisedAt: "asc" },
      }),
      prisma.whiteboardSession.findUnique({
        where: { id: params.id },
        select: { handRaiseEnabled: true },
      }),
    ]);

    return apiSuccess({
      queue: queue.map((h) => ({
        id: h.id,
        studentId: h.studentId,
        studentName: h.student.user.name,
        requestType: h.requestType,
        status: h.status,
        liveKitGranted: h.liveKitGranted,
        raisedAt: h.raisedAt,
      })),
      handRaiseEnabled: wbSession?.handRaiseEnabled ?? true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Student raises their hand. Idempotent: a student who already has a
 * PENDING or APPROVED raise gets that same row back rather than a duplicate.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    let requestType = "CHAT";
    try {
      const body = await request.json();
      if (body?.requestType && ["CHAT", "AUDIO", "VIDEO"].includes(body.requestType)) {
        requestType = body.requestType;
      }
    } catch {
      // Body may be empty
    }

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status !== "ACTIVE") return apiError("This class isn't live right now.", 409);
    if (!wbSession.handRaiseEnabled) {
      return apiError("The teacher has turned off Questions for this class.", 403);
    }

    const existing = await prisma.handRaiseEvent.findFirst({
      where: { whiteboardSessionId: params.id, studentId: access.entityId, status: { in: ["PENDING", "APPROVED"] } },
    });

    const handRaise =
      existing ??
      (await prisma.handRaiseEvent.create({
        data: {
          whiteboardSessionId: params.id,
          studentId: access.entityId,
          requestType,
          status: "PENDING",
        },
      }));

    if (!existing) await pushHandRaiseQueue(params.id);

    return apiSuccess({ handRaise }, existing ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}


/** Student lowers their own hand (withdraws before the teacher acts on it). */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const updated = await prisma.handRaiseEvent.updateMany({
      where: { whiteboardSessionId: params.id, studentId: access.entityId, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    if (updated.count > 0) await pushHandRaiseQueue(params.id);

    return apiSuccess({ lowered: updated.count > 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
