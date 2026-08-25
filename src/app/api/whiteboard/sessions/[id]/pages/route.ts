import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const MAX_PAGES_PER_SESSION = 50;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const pages = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      orderBy: { pageNumber: "asc" },
    });
    return apiSuccess({ pages });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Adds a blank page and makes it the active one. Teacher-only. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status === "ENDED") return apiError("This session has ended.", 409);

    const pageCount = await prisma.whiteboardPage.count({ where: { sessionId: params.id } });
    if (pageCount >= MAX_PAGES_PER_SESSION) {
      return apiError(`A live board is capped at ${MAX_PAGES_PER_SESSION} pages per class.`, 400);
    }

    const nextPageNumber = pageCount + 1;

    const [page] = await prisma.$transaction([
      prisma.whiteboardPage.create({
        data: { sessionId: params.id, pageNumber: nextPageNumber, objects: [] },
      }),
      prisma.whiteboardSession.update({
        where: { id: params.id },
        data: { activePageNumber: nextPageNumber },
      }),
    ]);

    return apiSuccess({ page }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
