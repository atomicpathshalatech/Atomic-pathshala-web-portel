import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { testTemplateCreateSchema } from "@/lib/validation/test-template";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const templates = await prisma.testTemplate.findMany({
      include: {
        sections: { orderBy: { order: "asc" } },
        _count: { select: { tests: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_CREATE);

    const body = await request.json();
    const data = testTemplateCreateSchema.parse(body);

    const template = await prisma.testTemplate.create({
      data: {
        name: data.name,
        description: data.description || null,
        createdById: session.user.id,
        sections: {
          create: data.sections.map((sec, idx) => ({
            name: sec.name,
            subject: sec.subject,
            targetCount: sec.targetCount,
            marksPerQuestion: sec.marksPerQuestion,
            negativeMarks: sec.negativeMarks,
            order: sec.order ?? idx,
          })),
        },
      },
      include: {
        sections: { orderBy: { order: "asc" } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_TEMPLATE_CREATED",
        entityType: "TestTemplate",
        entityId: template.id,
        metadata: {
          name: template.name,
          sectionsCount: template.sections.length,
        },
      },
    });

    return apiSuccess({ template }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
