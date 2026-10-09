import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { messageCreateSchema } from "@/lib/validation/whiteboard";
import { pushMessage } from "@/lib/whiteboard/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

// Chat lives in the database, never only in a browser. Two reads:
//   GET                      → the LATEST messages of the class (join, reopen, refresh,
//                              another device). It used to return the OLDEST 300, so in a
//                              busy class a student who reopened the app saw old chat and
//                              none of the recent messages.
//   GET ?after=<messageId>   → only what was sent after that message (reconnect: a
//                              student who had 1–500 fetches 501–530, not everything).
const HISTORY_LIMIT = 300;
const CATCH_UP_LIMIT = 500;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const after = request.nextUrl.searchParams.get("after");
    const anchor = after
      ? await prisma.whiteboardMessage.findFirst({
          where: { id: after, whiteboardSessionId: params.id },
          select: { createdAt: true },
        })
      : null;

    let messages;
    if (anchor) {
      // From the anchor's own instant on (the client drops ids it already has),
      // so two messages saved in the same millisecond are never skipped.
      messages = await prisma.whiteboardMessage.findMany({
        where: { whiteboardSessionId: params.id, deletedAt: null, createdAt: { gte: anchor.createdAt }, NOT: { id: after! } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: CATCH_UP_LIMIT,
      });
    } else {
      const latest = await prisma.whiteboardMessage.findMany({
        where: { whiteboardSessionId: params.id, deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_LIMIT,
      });
      messages = latest.reverse();
    }

    const userIds = Array.from(new Set(messages.map((m) => m.authorUserId)));
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, photoUrl: true },
        })
      : [];
    const photoMap = new Map(users.map((u) => [u.id, u.photoUrl]));

    const enrichedMessages = messages.map((m) => ({
      ...m,
      authorPhotoUrl: photoMap.get(m.authorUserId) || null,
      // Comments from the YouTube live chat are stored as chat rows too.
      ...(m.authorRole === "YOUTUBE" && { source: "YOUTUBE" as const, authorRole: "STUDENT" }),
    }));

    return apiSuccess({
      messages: enrichedMessages,
      chatEnabled: wbSession.chatEnabled,
      role: access.role,
      // false = an "after" request for a message this class doesn't have (the
      // client then reloads the latest history instead of trusting its cursor).
      cursorValid: after ? Boolean(anchor) : true,
    });
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

    const input = messageCreateSchema.parse(await request.json());

    // Independent of each other — the session status/chatEnabled check and
    // the sender's own photoUrl lookup — so run them together instead of
    // as two sequential round-trips on every single chat message send.
    const [wbSession, authorUser] = await Promise.all([
      prisma.whiteboardSession.findUnique({ where: { id: params.id } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } }),
    ]);
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status === "ENDED") return apiError("This class has ended.", 409);

    if (access.role === "STUDENT" && !wbSession.chatEnabled) {
      return apiError("The teacher has turned off chat for this class.", 403);
    }

    const authorPhotoUrl = authorUser?.photoUrl || null;

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
      authorPhotoUrl,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    });

    return apiSuccess({ message: { ...created, authorPhotoUrl } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
