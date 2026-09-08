import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getOrCreateTestLab } from "@/lib/whiteboard/test-lab";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clears the caller's Whiteboard Test Lab session back to a blank state:
 * pages, chat, polls and hand-raises. Guarded so it can only ever touch a
 * WhiteboardSession where `isTest = true`. Real class data is untouched.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const { whiteboardSessionId } = await getOrCreateTestLab(session.user.id);

    const wb = await prisma.whiteboardSession.findUnique({
      where: { id: whiteboardSessionId },
      select: { isTest: true },
    });
    if (!wb?.isTest) return apiError("Not a test session.", 400);

    await prisma.$transaction([
      prisma.whiteboardPage.deleteMany({ where: { sessionId: whiteboardSessionId } }),
      prisma.whiteboardMessage.deleteMany({ where: { whiteboardSessionId } }),
      prisma.quizSession.deleteMany({ where: { whiteboardSessionId } }),
      prisma.handRaiseEvent.deleteMany({ where: { whiteboardSessionId } }),
      prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: {
          activePageNumber: 1,
          presentationUrl: null,
          presentationName: null,
          presentationType: null,
        },
      }),
    ]);

    return apiSuccess({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
