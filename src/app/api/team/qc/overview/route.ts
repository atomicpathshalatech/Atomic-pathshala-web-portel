import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

// Counts for the QC dashboard: where the Question Bank stands, what is waiting
// for a person, and what the reviews have cost so far.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const [byStatus, bySubject, chapters, corrections, findings, usage, usageOk] = await Promise.all([
      prisma.question.groupBy({ by: ["qcStatus"], _count: { _all: true } }),
      prisma.question.groupBy({ by: ["subject", "qcStatus"], _count: { _all: true } }),
      prisma.question.groupBy({ by: ["subject", "chapter"], _count: { _all: true }, orderBy: [{ subject: "asc" }, { chapter: "asc" }] }),
      prisma.qcCorrection.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.qcFinding.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 12 }),
      prisma.aiUsageLog.groupBy({ by: ["feature", "model"], _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, durationMs: true } }),
      prisma.aiUsageLog.count({ where: { ok: false } }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.qcStatus ?? "UNREVIEWED"] = (statusCounts[row.qcStatus ?? "UNREVIEWED"] ?? 0) + row._count._all;
    const subjects: Record<string, Record<string, number>> = {};
    for (const row of bySubject) {
      const s = (subjects[row.subject] ??= {});
      s[row.qcStatus ?? "UNREVIEWED"] = (s[row.qcStatus ?? "UNREVIEWED"] ?? 0) + row._count._all;
    }

    return apiSuccess({
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      statusCounts,
      subjects,
      chapters: chapters.map((c) => ({ subject: c.subject, chapter: c.chapter, count: c._count._all })),
      corrections: Object.fromEntries(corrections.map((c) => [c.status, c._count._all])),
      findingCategories: findings.map((f) => ({ category: f.category, count: f._count._all })),
      usage: usage.map((u) => ({
        feature: u.feature,
        model: u.model,
        calls: u._count._all,
        inputTokens: u._sum.inputTokens ?? 0,
        outputTokens: u._sum.outputTokens ?? 0,
        durationMs: u._sum.durationMs ?? 0,
      })),
      failedCalls: usageOk,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
