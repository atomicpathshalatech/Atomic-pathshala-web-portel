import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { pushClassroomHandRaiseQueue } from "@/lib/classroom/hand-raise";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Teacher-only: current raised-hand queue, oldest first. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const [queue, classroomSession] = await Promise.all([
      prisma.classroomHandRaise.findMany({
        where: { classroomSessionId: params.id, status: { in: ["PENDING", "APPROVED"] } },
        include: { student: { include: { user: true } } },
        orderBy: { raisedAt: "asc" },
      }),
      prisma.classroomSession.findUnique({ where: { id: params.id }, select: { handRaiseEnabled: true } }),
    ]);

    return apiSuccess({
      queue: queue.map((h) => ({
        id: h.id,
        studentId: h.studentId,
        studentName: h.student.user.name,
        requestType: h.requestType,
        status: h.status,
        raisedAt: h.raisedAt,
        imageUrl: h.imageUrl,
      })),
      handRaiseEnabled: classroomSession?.handRaiseEnabled ?? true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Student raises their hand. Idempotent — a PENDING/APPROVED raise already on file is reused rather than duplicated. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    let imageUrl: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.imageUrl === "string" && body.imageUrl.startsWith("http")) imageUrl = body.imageUrl;
    } catch {
      // Body may be empty
    }

    const classroomSession = await prisma.classroomSession.findUnique({ where: { id: params.id } });
    if (!classroomSession) return apiError("Classroom session not found", 404);
    if (classroomSession.phase !== "LIVE") return apiError("This class isn't live right now.", 409);
    if (!classroomSession.handRaiseEnabled) {
      return apiError("The teacher has turned off hand raise for this class.", 403);
    }

    const existing = await prisma.classroomHandRaise.findFirst({
      where: { classroomSessionId: params.id, studentId: access.entityId, status: { in: ["PENDING", "APPROVED"] } },
    });

    const handRaise = existing
      ? await prisma.classroomHandRaise.update({
          where: { id: existing.id },
          data: { status: "PENDING", ...(imageUrl && { imageUrl }) },
        })
      : await prisma.classroomHandRaise.create({
          data: { classroomSessionId: params.id, studentId: access.entityId, status: "PENDING", imageUrl },
        });

    await pushClassroomHandRaiseQueue(params.id);

    return apiSuccess({ handRaise }, existing ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Student lowers their own hand. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const updated = await prisma.classroomHandRaise.updateMany({
      where: { classroomSessionId: params.id, studentId: access.entityId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    if (updated.count > 0) await pushClassroomHandRaiseQueue(params.id);

    return apiSuccess({ lowered: updated.count > 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
