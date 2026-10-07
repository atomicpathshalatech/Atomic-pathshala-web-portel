import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const job = await prisma.extractionJob.findUnique({
      where: { id: params.id },
      include: {
        questions: {
          orderBy: { originalNumber: "asc" },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!job) return apiError("Job not found", 404);

    const report = (job.reportJson as any) || {};
    const chunkPlan = report.chunkPlan || {};

    const mdReport = `# PDF EXTRACTION & RECONCILIATION AUDIT REPORT
============================================================
Document: ${job.fileName}
Source: ${job.sourceName} ${job.examName ? `(${job.examName})` : ""}
Job ID: ${job.id}
Created By: ${job.createdBy?.name || "System"} (${job.createdBy?.email || "N/A"})
Date: ${job.createdAt.toISOString()}
Final Status: ${job.status}
============================================================

## SUMMARY METRICS
- Total Pages: ${chunkPlan.totalPages || "N/A"}
- Total Chunks: ${chunkPlan.totalChunks || "N/A"}
- Completed Chunks: ${chunkPlan.completedChunks || "N/A"}
- Failed Chunks: ${chunkPlan.failedChunks || 0}
- Expected Question Count: ${job.expectedCount} (Range: Q${job.startNumber}–Q${job.endNumber})
- Total Extracted Questions: ${job.extractedCount}
- 100% Verified Questions: ${job.verifiedCount}
- Questions Flagged for Review: ${job.reviewCount}
- Failed Questions: ${job.errorCount}
- Missing Question Numbers: ${job.missingCount}
- Diagrams / Figures Cropped: ${job.questions.filter((q) => q.hasImage).length}

## QUESTION BREAKDOWN
${job.questions
  .map(
    (q) =>
      `[Q${q.originalNumber}] Status: ${q.status} | Type: ${q.questionType} | Page: ${q.sourcePage} | Image: ${q.hasImage ? "YES" : "NO"} | Table: ${q.hasTable ? "YES" : "NO"} | Answer: ${q.correctAnswer || "N/A"}`
  )
  .join("\n")}
`;

    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return new Response(JSON.stringify({ job, report, chunkPlan }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${job.fileName.replace(/\.pdf$/i, "")}-extraction-report.json"`,
        },
      });
    }

    return new Response(mdReport, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${job.fileName.replace(/\.pdf$/i, "")}-extraction-report.md"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
