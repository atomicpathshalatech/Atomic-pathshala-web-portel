import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const method = searchParams.get("method")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 15)));

    const where: any = {};
    if (method && method !== "ALL") where.method = method;
    if (subject && subject !== "ALL") where.subject = { equals: subject, mode: "insensitive" };
    if (chapter && chapter !== "ALL") where.chapter = { contains: chapter, mode: "insensitive" };

    const [batches, total] = await Promise.all([
      prisma.aiGenerationBatch.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          sourcePdf: { select: { id: true, fileName: true, resourceId: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.aiGenerationBatch.count({ where }),
    ]);

    return apiSuccess({
      batches,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
