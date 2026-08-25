import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const allowed = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!allowed) return null;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  return teacher;
}

export async function GET() {
  try {
    const teacher = await authorize();
    if (!teacher) return apiError("Not authenticated", 401);

    const boards = await prisma.whiteboardBoard.findMany({
      where: { teacherId: teacher.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
    });

    return apiSuccess({ boards });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const teacher = await authorize();
    if (!teacher) return apiError("Not authenticated", 401);

    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled Board";
    const strokes = body.strokes ?? [];
    const thumbnailDataUrl = body.thumbnailDataUrl;

    if (typeof thumbnailDataUrl !== "string" || !thumbnailDataUrl.startsWith("data:image/")) {
      return apiError("Invalid thumbnail", 400);
    }

    const board = await prisma.whiteboardBoard.create({
      data: { teacherId: teacher.id, title, strokes, thumbnailDataUrl },
      select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
    });

    return apiSuccess({ board });
  } catch (error) {
    return handleApiError(error);
  }
}
