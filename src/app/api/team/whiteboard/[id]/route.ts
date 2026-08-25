import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const allowed = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!allowed) return null;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  return teacher;
}

async function loadOwnedBoard(teacherId: string, boardId: string) {
  const board = await prisma.whiteboardBoard.findUnique({ where: { id: boardId } });
  if (!board || board.teacherId !== teacherId) return null;
  return board;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const teacher = await authorize();
    if (!teacher) return apiError("Not authenticated", 401);

    const board = await loadOwnedBoard(teacher.id, params.id);
    if (!board) return apiError("Board not found", 404);

    return apiSuccess({ board });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const teacher = await authorize();
    if (!teacher) return apiError("Not authenticated", 401);

    const existing = await loadOwnedBoard(teacher.id, params.id);
    if (!existing) return apiError("Board not found", 404);

    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title;
    const strokes = body.strokes ?? existing.strokes;
    const thumbnailDataUrl =
      typeof body.thumbnailDataUrl === "string" && body.thumbnailDataUrl.startsWith("data:image/")
        ? body.thumbnailDataUrl
        : existing.thumbnailDataUrl;

    const board = await prisma.whiteboardBoard.update({
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
    const teacher = await authorize();
    if (!teacher) return apiError("Not authenticated", 401);

    const board = await loadOwnedBoard(teacher.id, params.id);
    if (!board) return apiError("Board not found", 404);

    await prisma.whiteboardBoard.delete({ where: { id: params.id } });

    return apiSuccess({ id: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}
