import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { runTestAudit } from "@/lib/test-audit/audit-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const subject = searchParams.get("subject");
    const status = searchParams.get("status");

    // Get the latest completed or outdated audit report
    const report = await prisma.testAuditReport.findFirst({
      where: { testId: params.id },
      orderBy: { reportVersion: "desc" },
      include: {
        questionAudits: {
          where: {
            ...(severity ? { severity } : {}),
            ...(subject ? { subject: { contains: subject, mode: "insensitive" } } : {}),
            ...(status ? { status } : {}),
          },
          orderBy: { questionNumber: "asc" },
          include: {
            question: {
              select: {
                id: true,
                questionCode: true,
                subject: true,
                chapter: true,
                difficulty: true,
                imageUrl: true,
                referenceImageUrl: true,
                translations: {
                  select: {
                    language: true,
                    statement: true,
                    options: true,
                    correctOptionIds: true,
                    solution: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      return apiSuccess({
        audited: false,
        test: {
          id: test.id,
          name: test.name,
          code: test.code || null,
          status: test.status,
          auditStatus: (test as any).auditStatus || "NOT_AUDITED",
        },
        report: null,
      });
    }

    return apiSuccess({
      audited: true,
      test: {
        id: test.id,
        name: test.name,
        code: test.code || null,
        status: test.status,
        auditStatus: (test as any).auditStatus || "NOT_AUDITED",
      },
      report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const result = await runTestAudit({
      testId: params.id,
      userId: session.user.id,
    });

    return apiSuccess({
      success: true,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
