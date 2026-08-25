import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Board mirroring read endpoint — the ONLY place a student ever receives
 * stroke data (`objects`), and even then only for the single page the
 * teacher currently has open. The teacher's own client doesn't need this
 * (it already has every page from GET .../route.ts); this exists for the
 * student view and any other passive viewer.
 *
 * Deliberately narrow: no page history, no ability to ask for a page other
 * than the active one — a student "flipping ahead" on their own isn't part
 * of this feature, they see what the teacher is currently showing, exactly
 * like the quiz/hand-raise tools already work on this same channel.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { activePageNumber: true },
    });
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const page = await prisma.whiteboardPage.findUnique({
      where: { sessionId_pageNumber: { sessionId: params.id, pageNumber: wbSession.activePageNumber } },
      select: { id: true, pageNumber: true, objects: true, background: true },
    });

    return apiSuccess({ activePageNumber: wbSession.activePageNumber, page: page ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
