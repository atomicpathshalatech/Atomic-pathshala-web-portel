import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { testTemplateUpdateSchema } from "@/lib/validation/test-template";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const template = await prisma.testTemplate.findUnique({
      where: { id: params.id },
      include: {
        sections: { orderBy: { order: "asc" } },
        _count: { select: { tests: true } },
      },
    });

    if (!template) {
      return apiError("Template not found", 404);
    }

    return apiSuccess({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const template = await prisma.testTemplate.findUnique({
      where: { id: params.id },
      include: { _count: { select: { tests: true } } },
    });

    if (!template) {
      return apiError("Template not found", 404);
    }

    const body = await request.json();
    const data = testTemplateUpdateSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.sections && data.sections.length > 0) {
        // Replace sections
        await tx.testTemplateSection.deleteMany({
          where: { templateId: params.id },
        });

        await tx.testTemplateSection.createMany({
          data: data.sections.map((sec, idx) => ({
            templateId: params.id,
            name: sec.name,
            subject: sec.subject,
            targetCount: sec.targetCount,
            marksPerQuestion: sec.marksPerQuestion,
            negativeMarks: sec.negativeMarks,
            order: sec.order ?? idx,
          })),
        });
      }

      return tx.testTemplate.update({
        where: { id: params.id },
        data: {
          name: data.name ?? undefined,
          description: data.description !== undefined ? data.description : undefined,
        },
        include: {
          sections: { orderBy: { order: "asc" } },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_TEMPLATE_UPDATED",
        entityType: "TestTemplate",
        entityId: params.id,
      },
    });

    return apiSuccess({ template: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_DELETE);

    const template = await prisma.testTemplate.findUnique({
      where: { id: params.id },
      include: { _count: { select: { tests: true } } },
    });

    if (!template) {
      return apiError("Template not found", 404);
    }

    if (template._count.tests > 0) {
      return apiError(
        `Cannot delete template because it is currently used by ${template._count.tests} test(s).`,
        409
      );
    }

    await prisma.testTemplate.delete({
      where: { id: params.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_TEMPLATE_DELETED",
        entityType: "TestTemplate",
        entityId: params.id,
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
