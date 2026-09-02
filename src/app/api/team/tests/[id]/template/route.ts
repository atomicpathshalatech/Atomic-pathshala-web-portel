import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { createSectionsFromTemplate, getTestSectionBreakdown } from "@/lib/test-engine/sections";
import { applyTemplateSchema } from "@/lib/validation/test-template";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const [template, sections] = await Promise.all([
      test.templateId
        ? prisma.testTemplate.findUnique({
            where: { id: test.templateId },
            include: { sections: { orderBy: { order: "asc" } } },
          })
        : null,
      getTestSectionBreakdown(params.id),
    ]);

    return apiSuccess({
      testId: test.id,
      templateId: test.templateId,
      template,
      sections,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") {
      return apiError("Cannot change template on a non-draft test", 409);
    }

    const body = await request.json();
    const data = applyTemplateSchema.parse(body);

    const sections = await createSectionsFromTemplate(params.id, data.templateId);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_TEMPLATE_APPLIED",
        entityType: "Test",
        entityId: params.id,
        metadata: {
          templateId: data.templateId,
          sectionsCount: sections.length,
        },
      },
    });

    return apiSuccess({
      message: "Template applied successfully",
      sections,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
