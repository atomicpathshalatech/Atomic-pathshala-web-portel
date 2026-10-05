import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushBoardUpdated, pushPageChanged } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

async function handleReorder(request: NextRequest, params: { id: string }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status === "ENDED") return apiError("This session has ended.", 409);

    const body = await request.json().catch(() => ({}));
    const { pageId, direction, orderedPageIds } = body as {
      pageId?: string;
      direction?: "up" | "down";
      orderedPageIds?: string[];
    };

    const allPages = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      orderBy: { pageNumber: "asc" },
      select: { id: true, pageNumber: true },
    });

    if (Array.isArray(orderedPageIds) && orderedPageIds.length > 0) {
      // Validate all IDs exist in this session
      const pageIdSet = new Set(allPages.map((p) => p.id));
      const validIds = orderedPageIds.filter((id) => pageIdSet.has(id));
      if (validIds.length !== allPages.length) {
        return apiError("Invalid page order payload.", 400);
      }

      // Step 1: Assign temporary negative pageNumbers to avoid unique constraint collisions
      const tempUpdates = validIds.map((id, index) =>
        prisma.whiteboardPage.update({
          where: { id },
          data: { pageNumber: -(index + 1000) },
        })
      );
      await prisma.$transaction(tempUpdates);

      // Step 2: Assign final 1-based pageNumbers
      const finalUpdates = validIds.map((id, index) =>
        prisma.whiteboardPage.update({
          where: { id },
          data: { pageNumber: index + 1 },
        })
      );
      await prisma.$transaction(finalUpdates);

      // Find current active page id and map to new pageNumber
      const activePage = allPages.find((p) => p.pageNumber === wbSession.activePageNumber);
      let newActiveNumber = wbSession.activePageNumber;
      if (activePage) {
        const newIdx = validIds.indexOf(activePage.id);
        if (newIdx !== -1) {
          newActiveNumber = newIdx + 1;
        }
      }

      if (newActiveNumber !== wbSession.activePageNumber) {
        await prisma.whiteboardSession.update({
          where: { id: params.id },
          data: { activePageNumber: newActiveNumber },
        });
        await pushPageChanged(params.id, newActiveNumber);
      }

      await pushBoardUpdated(params.id, newActiveNumber, 0);

      const updatedPages = await prisma.whiteboardPage.findMany({
        where: { sessionId: params.id },
        orderBy: { pageNumber: "asc" },
      });

      return apiSuccess({ pages: updatedPages, activePageNumber: newActiveNumber });
    }

    if (!pageId || (direction !== "up" && direction !== "down")) {
      return apiError("Valid pageId and direction ('up' | 'down') or orderedPageIds are required.", 400);
    }

    const currentIndex = allPages.findIndex((p) => p.id === pageId);
    if (currentIndex === -1) return apiError("Page not found in this session.", 404);

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allPages.length) {
      return apiError(`Cannot move slide ${direction}.`, 400);
    }

    const currentPage = allPages[currentIndex]!;
    const targetPage = allPages[targetIndex]!;

    const tempPageNumber = -Math.floor(Date.now() % 1000000) - 1000;

    // Swap page numbers in a transaction (use a temporary negative index to avoid collision)
    await prisma.$transaction([
      prisma.whiteboardPage.update({
        where: { id: currentPage.id },
        data: { pageNumber: tempPageNumber },
      }),
      prisma.whiteboardPage.update({
        where: { id: targetPage.id },
        data: { pageNumber: currentPage.pageNumber },
      }),
      prisma.whiteboardPage.update({
        where: { id: currentPage.id },
        data: { pageNumber: targetPage.pageNumber },
      }),
    ]);

    let newActiveNumber = wbSession.activePageNumber;
    if (wbSession.activePageNumber === currentPage.pageNumber) {
      newActiveNumber = targetPage.pageNumber;
      await prisma.whiteboardSession.update({
        where: { id: params.id },
        data: { activePageNumber: newActiveNumber },
      });
      await pushPageChanged(params.id, newActiveNumber);
    } else if (wbSession.activePageNumber === targetPage.pageNumber) {
      newActiveNumber = currentPage.pageNumber;
      await prisma.whiteboardSession.update({
        where: { id: params.id },
        data: { activePageNumber: newActiveNumber },
      });
      await pushPageChanged(params.id, newActiveNumber);
    }

    await pushBoardUpdated(params.id, newActiveNumber, 0);

    const updatedPages = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      orderBy: { pageNumber: "asc" },
    });

    return apiSuccess({ pages: updatedPages, activePageNumber: newActiveNumber });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return handleReorder(request, params);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return handleReorder(request, params);
}
