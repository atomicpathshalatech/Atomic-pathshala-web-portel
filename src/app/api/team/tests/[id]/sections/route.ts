import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const sections = await prisma.section.findMany({
      where: { testId: params.id },
      include: {
        _count: { select: { questions: true } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              include: { translations: true },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return apiSuccess({ sections });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_CREATE || PERMISSIONS.TEST_UPDATE);

    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) return apiError("Test not found", 404);

    const body = await request.json();
    const { sections } = body;

    if (!Array.isArray(sections) || sections.length === 0) {
      return apiError("Sections array is required", 400);
    }

    // Delete empty sections
    await prisma.section.deleteMany({
      where: { testId: params.id, questions: { none: {} } },
    });

    // Create new sections
    const createdSections = await prisma.$transaction(
      sections.map((s: any, idx: number) =>
        prisma.section.create({
          data: {
            testId: params.id,
            name: s.name || `Section ${idx + 1}`,
            subject: s.subject || "General",
            targetCount: Number(s.targetCount) || 30,
            marksPerQuestion: Number(s.marksPerQuestion) || 4,
            negativeMarks: Number(s.negativeMarks) || -1,
            order: s.order ?? idx,
          },
        })
      )
    );

    return apiSuccess({ sections: createdSections }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
