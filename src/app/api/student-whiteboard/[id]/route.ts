import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

async function loadOwnedBoard(userId: string, boardId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return null;

  const board = await prisma.studentWhiteboardBoard.findUnique({ where: { id: boardId } });
  if (!board || board.studentId !== student.id) return null;

  return board;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "STUDENT") {
      return apiError("Not authenticated", 401);
    }

    const board = await loadOwnedBoard(session.user.id, params.id);
    if (!board) return apiError("Board not found", 404);

    return apiSuccess({ board });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "STUDENT") {
      return apiError("Not authenticated", 401);
    }

    const existing = await loadOwnedBoard(session.user.id, params.id);
    if (!existing) return apiError("Board not found", 404);

    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title;
    const strokes = body.strokes ?? existing.strokes;
    const thumbnailDataUrl =
      typeof body.thumbnailDataUrl === "string" && body.thumbnailDataUrl.startsWith("data:image/")
        ? body.thumbnailDataUrl
        : existing.thumbnailDataUrl;

    const board = await prisma.studentWhiteboardBoard.update({
      where: { id: params.id },
      data: { title, strokes, thumbnailDataUrl },
      select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
    });

    return apiSuccess({ board });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "STUDENT") {
      return apiError("Not authenticated", 401);
    }

    const board = await loadOwnedBoard(session.user.id, params.id);
    if (!board) return apiError("Board not found", 404);

    await prisma.studentWhiteboardBoard.delete({ where: { id: params.id } });

    return apiSuccess({ id: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}
