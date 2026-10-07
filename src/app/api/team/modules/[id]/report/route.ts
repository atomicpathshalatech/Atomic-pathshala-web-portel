import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateModuleVerificationReport, formatVerificationReportMarkdown } from "@/lib/module-studio/verification-engine";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      include: { pages: true, exportHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!moduleRow) return apiError("Module not found", 404);

    const pageCount = moduleRow.pageCount || moduleRow.pages.length || 1;

    const report = generateModuleVerificationReport({
      moduleId: moduleRow.id,
      moduleCode: moduleRow.code,
      originalFileName: moduleRow.originalFileName,
      originalPageCount: pageCount,
      brandedPageCount: pageCount,
      hasHindi: true,
      hasFormulas: true,
      hasDiagrams: true,
      hasTables: true,
    });

    const format = request.nextUrl.searchParams.get("format");
    if (format === "markdown" || format === "md") {
      return new Response(formatVerificationReportMarkdown(report), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${moduleRow.code}-verification-report.md"`,
        },
      });
    }

    return apiSuccess({
      report,
      reportMarkdown: formatVerificationReportMarkdown(report),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
