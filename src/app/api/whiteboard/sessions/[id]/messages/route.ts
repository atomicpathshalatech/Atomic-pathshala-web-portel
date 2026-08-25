import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { messageCreateSchema } from "@/lib/validation/whiteboard";
import { pushMessage } from "@/lib/whiteboard/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

// Recent-history cap for GET — chat is meant to be read live via Pusher;
// this endpoint exists so a viewer who joins mid-class (or reconnects) isn't
// starting from a blank panel. Not paginated on purpose: a single live class
// realistically won't produce more than a few hundred messages.
const HISTORY_LIMIT = 300;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { chatEnabled: true },
    });
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const messages = await prisma.whiteboardMessage.findMany({
      where: { whiteboardSessionId: params.id },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    return apiSuccess({ messages, chatEnabled: wbSession.chatEnabled, role: access.role });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Not audit-logged, same reasoning as hand-raise mutations: this is a
 * high-frequency student/teacher interaction during a live class, not the
 * kind of accountable action AuditLog exists for.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status === "ENDED") return apiError("This class has ended.", 409);

    if (access.role === "STUDENT" && !wbSession.chatEnabled) {
      return apiError("The teacher has turned off chat for this class.", 403);
    }

    const input = messageCreateSchema.parse(await request.json());

    const created = await prisma.whiteboardMessage.create({
      data: {
        whiteboardSessionId: params.id,
        authorRole: access.role,
        authorUserId: session.user.id,
        authorName: access.name,
        body: input.body,
      },
    });

    await pushMessage(params.id, {
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
