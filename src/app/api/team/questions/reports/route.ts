import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { QUESTION_REPORT_STATUSES } from "@/lib/validation/question-report";

/**
 * Admin Report Dashboard listing (`/team/questions/reports` in the UI).
 * Gated on QUESTION_READ — the same permission every question-review
 * surface uses — not a new report-specific code; SME/ADMIN/SUB_ADMIN/
 * ACADEMIC_HEAD/QUESTION_TEAM/SUPER_ADMIN/FOUNDER already hold it.
 *
 * Scope note: the source spec also fans a notification out to Super
 * Admin, Sub Admin, the question's subject teacher(s), and its creator
 * the moment a report lands. Not wired up here — atomic-ops's
 * notification engine (src/lib/notifications/engine.ts) is driven by a
 * fixed NotificationType enum + template registry, and QUESTION_REPORTED
 * isn't one of its event types. Adding one is a real schema change
 * (migration) rather than something to guess at from this pass; this
 * dashboard + claim/resolve flow works today by admins/teachers checking
 * it, same as `/team/questions/[id]/versions` review already does.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const sourceParam = searchParams.get("source");
    const searchParam = searchParams.get("search")?.toLowerCase().trim();
    const sortParam = searchParams.get("sort") || "most_reported";

    // 1. Fetch questions that have at least one QuestionReport
    const questionsWithReports = await prisma.question.findMany({
      where: {
        reports: { some: {} },
      },
      include: {
        translations: true,
        createdBy: { select: { id: true, name: true, email: true } },
        editedBy: { select: { id: true, name: true, email: true } },
        reports: {
          orderBy: { createdAt: "desc" },
          include: {
            reportedBy: { select: { id: true, name: true, email: true } },
            claimedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // 2. Aggregate metrics per question
    let aggregated = questionsWithReports.map((q) => {
      const totalReports = q.reports.length;
      const uniqueStudents = new Set(q.reports.map((r) => r.reportedById)).size;

      const reasonCounts: Record<string, number> = {};
      q.reports.forEach((r) => {
        const tags = r.reasonTags.split(",").map((t) => t.trim());
        tags.forEach((tag) => {
          if (!tag) return;
          reasonCounts[tag] = (reasonCounts[tag] || 0) + 1;
        });
      });

      const dates = q.reports.map((r) => new Date(r.createdAt).getTime());
      const firstReportedAt = dates.length ? new Date(Math.min(...dates)).toISOString() : q.createdAt.toISOString();
      const lastReportedAt = dates.length ? new Date(Math.max(...dates)).toISOString() : q.createdAt.toISOString();

      // Determine overall review state
      const hasNew = q.reports.some((r) => r.status === "NEW");
      const hasClaimed = q.reports.some((r) => r.status === "CLAIMED");
      const allResolved = q.reports.every((r) => r.status === "RESOLVED");
      const allRejected = q.reports.every((r) => r.status === "REJECTED");

      let overallStatus: "OPEN" | "UNDER_REVIEW" | "CORRECTED" | "REJECTED" = "OPEN";
      if (allResolved) overallStatus = "CORRECTED";
      else if (allRejected) overallStatus = "REJECTED";
      else if (hasClaimed) overallStatus = "UNDER_REVIEW";
      else overallStatus = "OPEN";

      // Detect source type
      const cat = (q.category || "").toUpperCase();
      const tags = (q.tags || "").toUpperCase();
      const isNcert = cat.includes("NCERT") || tags.includes("NCERT") || Boolean(q.ncertBook);
      const isGuru = cat.includes("ATOMIC_GURU") || cat.includes("GURU") || tags.includes("ATOMIC_GURU");
      const isPyq = Boolean(q.pyqExam || q.pyqYear || cat.includes("PYQ") || tags.includes("PYQ"));
      const isAi = isGuru || isNcert || cat.startsWith("AI") || tags.includes("AI_GENERATED");

      const sourceLabel = isNcert
        ? "NCERT Practice"
        : isGuru
          ? "Atomic Guru"
          : isPyq
            ? "Previous Year (PYQ)"
            : isAi
              ? "AI Generated"
              : "Question Bank";

      return {
        questionId: q.id,
        questionCode: q.questionCode,
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        subTopic: q.subTopic,
        difficulty: q.difficulty,
        type: q.type,
        category: q.category,
        sourceLabel,
        solution: q.solution,
        status: q.status,
        overallStatus,
        version: q.version,
        translations: q.translations,
        totalReports,
        uniqueStudents,
        reasonCounts,
        firstReportedAt,
        lastReportedAt,
        reports: q.reports.map((r) => ({
          id: r.id,
          reasonTags: r.reasonTags,
          comment: r.comment,
          screenshotUrl: r.screenshotUrl,
          status: r.status,
          teacherNotes: r.teacherNotes,
          createdAt: r.createdAt,
          resolvedAt: r.resolvedAt,
          reportedBy: r.reportedBy,
          claimedBy: r.claimedBy,
        })),
      };
    });

    // 3. Apply Filters
    if (statusParam && statusParam !== "ALL") {
      aggregated = aggregated.filter((item) => {
        if (statusParam === "OPEN") return item.overallStatus === "OPEN";
        if (statusParam === "UNDER_REVIEW") return item.overallStatus === "UNDER_REVIEW";
        if (statusParam === "CORRECTED" || statusParam === "RESOLVED") return item.overallStatus === "CORRECTED";
        if (statusParam === "REJECTED") return item.overallStatus === "REJECTED";
        return true;
      });
    }

    if (sourceParam && sourceParam !== "ALL") {
      aggregated = aggregated.filter((item) => {
        if (sourceParam === "NCERT") return item.sourceLabel.includes("NCERT");
        if (sourceParam === "GURU") return item.sourceLabel.includes("Guru");
        if (sourceParam === "AI") return item.sourceLabel.includes("AI") || item.sourceLabel.includes("NCERT") || item.sourceLabel.includes("Guru");
        if (sourceParam === "PYQ") return item.sourceLabel.includes("PYQ");
        return true;
      });
    }

    if (searchParam) {
      aggregated = aggregated.filter((item) => {
        const inId = item.questionId.toLowerCase().includes(searchParam);
        const inCode = item.questionCode?.toLowerCase().includes(searchParam);
        const inSubject = item.subject.toLowerCase().includes(searchParam);
        const inChapter = item.chapter?.toLowerCase().includes(searchParam);
        const inTopic = item.topic?.toLowerCase().includes(searchParam);
        const inStatement = item.translations.some((t) => t.statement.toLowerCase().includes(searchParam));
        return inId || inCode || inSubject || inChapter || inTopic || inStatement;
      });
    }

    // 4. Apply Sorting
    if (sortParam === "most_reported") {
      aggregated.sort((a, b) => b.totalReports - a.totalReports || new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime());
    } else if (sortParam === "recently_reported") {
      aggregated.sort((a, b) => new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime());
    } else if (sortParam === "oldest") {
      aggregated.sort((a, b) => new Date(a.firstReportedAt).getTime() - new Date(b.firstReportedAt).getTime());
    }

    // Metrics summary
    const totalQuestionsReported = questionsWithReports.length;
    const unresolvedQuestions = questionsWithReports.filter((q) => q.reports.some((r) => r.status === "NEW" || r.status === "CLAIMED")).length;
    const totalReportsAllTime = questionsWithReports.reduce((sum, q) => sum + q.reports.length, 0);

    return apiSuccess({
      reportedQuestions: aggregated,
      metrics: {
        totalQuestionsReported,
        unresolvedQuestions,
        totalReportsAllTime,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
