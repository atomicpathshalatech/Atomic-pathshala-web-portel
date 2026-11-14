import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiError } from "@/lib/api/response";

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
    const format = searchParams.get("format") || "csv"; // "csv" | "json"

    const report = await prisma.testAuditReport.findFirst({
      where: { testId: params.id },
      orderBy: { reportVersion: "desc" },
      include: {
        questionAudits: {
          orderBy: { questionNumber: "asc" },
          include: {
            question: {
              select: {
                questionCode: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      return apiError("No audit report found for this test.", 404);
    }

    if (format === "json") {
      return NextResponse.json({ test, report });
    }

    // CSV format
    const rows: string[] = [
      [
        "Question #",
        "Question Code",
        "Section",
        "Subject",
        "Chapter",
        "Quality Score",
        "Severity",
        "Status",
        "Difficulty",
        "Answer Valid",
        "Diagram Status",
        "Duplicate Type",
        "Similarity Score",
        "Issues Detected",
      ].map((h) => `"${h}"`).join(","),
    ];

    for (const qa of report.questionAudits) {
      const issues = Array.isArray(qa.issues) ? qa.issues.join("; ") : "";
      const row = [
        qa.questionNumber,
        qa.question?.questionCode || qa.questionId,
        qa.sectionName || "",
        qa.subject || "",
        qa.chapter || "",
        qa.qualityScore,
        qa.severity,
        qa.status,
        qa.difficulty || "",
        qa.answerValid ? "YES" : "NO",
        qa.diagramStatus || "NOT_REQUIRED",
        qa.duplicateType || "NONE",
        qa.similarityScore ? `${Math.round(qa.similarityScore * 100)}%` : "N/A",
        issues.replace(/"/g, '""'),
      ];
      rows.push(row.map((val) => `"${val}"`).join(","));
    }

    const csvContent = rows.join("\r\n");
    const filename = `Test_Audit_Report_${test.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_v${report.reportVersion}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return apiError(error.message || "Export failed", 500);
  }
}
