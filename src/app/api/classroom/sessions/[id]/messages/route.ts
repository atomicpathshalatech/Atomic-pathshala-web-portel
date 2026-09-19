import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { pushClassroomMessage } from "@/lib/classroom/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const HISTORY_LIMIT = 300;

const messageCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const classroomSession = await prisma.classroomSession.findUnique({
      where: { id: params.id },
      select: { chatEnabled: true },
    });
    if (!classroomSession) return apiError("Classroom session not found", 404);

    const messages = await prisma.classroomMessage.findMany({
      where: { classroomSessionId: params.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    return apiSuccess({ messages, chatEnabled: classroomSession.chatEnabled, role: access.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const input = messageCreateSchema.parse(await request.json());

    const classroomSession = await prisma.classroomSession.findUnique({ where: { id: params.id } });
    if (!classroomSession) return apiError("Classroom session not found", 404);
    if (classroomSession.phase === "ENDED" || classroomSession.phase === "RECORDED") {
      return apiError("This class has ended.", 409);
    }
    if (access.role === "STUDENT" && !classroomSession.chatEnabled) {
      return apiError("The teacher has turned off chat for this class.", 403);
    }

    const created = await prisma.classroomMessage.create({
      data: {
        classroomSessionId: params.id,
        authorRole: access.role,
        authorUserId: session.user.id,
        authorName: access.name,
        body: input.body,
      },
    });

    await pushClassroomMessage(params.id, {
      id: created.id,
      authorRole: access.role,
      authorUserId: session.user.id,
      authorName: access.name,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    });

    return apiSuccess({ message: created }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
