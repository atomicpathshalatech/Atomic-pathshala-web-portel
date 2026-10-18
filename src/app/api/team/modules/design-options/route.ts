import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * Lists for the module setup form, from the real academic tables:
 *   GET                 → classes with their subjects, and batches
 *   GET ?subjectId=…    → that subject's chapters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);
    const subjectId = request.nextUrl.searchParams.get("subjectId");
    if (subjectId) {
      const chapters = await prisma.academicChapter.findMany({
        where: { subjectId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { chapterNumber: "asc" }],
        select: { id: true, chapterNumber: true, title: true, titleHindi: true },
      });
      return apiSuccess({ chapters });
    }
    const [classes, batches] = await Promise.all([
      prisma.academicClass.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { numericValue: "asc" }],
        select: { id: true, name: true, subjects: { where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true, nameHindi: true } } },
      }),
      prisma.batch.findMany({ orderBy: { createdAt: "desc" }, take: 300, select: { id: true, name: true, code: true } }),
    ]);
    return apiSuccess({ classes, batches });
  } catch (error) {
    return handleApiError(error);
  }
}
