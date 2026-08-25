import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getStudent(userId: string) {
  return prisma.student.findUnique({ where: { userId } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "STUDENT") {
      return apiError("Not authenticated", 401);
    }

    const student = await getStudent(session.user.id);
    if (!student) return apiError("Student profile not found", 404);

    const boards = await prisma.studentWhiteboardBoard.findMany({
      where: { studentId: student.id },
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
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "STUDENT") {
      return apiError("Not authenticated", 401);
    }

    const student = await getStudent(session.user.id);
    if (!student) return apiError("Student profile not found", 404);

    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled Board";
    const strokes = body.strokes ?? [];
    const thumbnailDataUrl = body.thumbnailDataUrl;

    if (typeof thumbnailDataUrl !== "string" || !thumbnailDataUrl.startsWith("data:image/")) {
      return apiError("Invalid thumbnail", 400);
    }

    const board = await prisma.studentWhiteboardBoard.create({
      data: { studentId: student.id, title, strokes, thumbnailDataUrl },
      select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
    });

    return apiSuccess({ board });
  } catch (error) {
    return handleApiError(error);
  }
}
