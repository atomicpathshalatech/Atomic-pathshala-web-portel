import "server-only";
import { prisma } from "@/lib/db";

/**
 * Scheduled tests: a test made for a set time (its openTime) stays a draft
 * until then, so the team can keep adding and correcting questions; students
 * already see it as "Upcoming" (not openable). At the set time it publishes
 * itself, and from then on it can no longer be changed.
 */

type EditableLike = { status: string; openTime?: Date | string | null };

/** Draft, and (when it has a set time) that time has not come yet. */
export function isTestEditable(test: EditableLike, now: Date = new Date()): boolean {
  if (test.status !== "DRAFT") return false;
  if (!test.openTime) return true;
  return now.getTime() < new Date(test.openTime).getTime();
}

/** Why the test can no longer be changed (null when it can). */
export function testLockedReason(test: EditableLike, now: Date = new Date()): string | null {
  if (isTestEditable(test, now)) return null;
  if (test.status === "DRAFT" && test.openTime) {
    return `This test started at ${formatIst(test.openTime)} — questions can no longer be changed.`;
  }
  return "This test is published — questions can no longer be changed.";
}

export function formatIst(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export type PublishResult = { ok: true } | { ok: false; status: number; error: string; criticalIssuesCount?: number };

/**
 * Publishes one draft test: every section needs questions; the questions in
 * it are published with it. Enforces quality audit gate if critical issues exist.
 */
export async function publishTestNow(testId: string, actorUserId: string | null): Promise<PublishResult> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: {
        include: {
          questions: {
            include: { question: { select: { isPublished: true, status: true } } },
          },
        },
      },
    },
  });

  if (!test) return { ok: false, status: 404, error: "Test not found" };
  if (test.status !== "DRAFT") return { ok: false, status: 409, error: "This test has already been published." };
  if (test.sections.length === 0) return { ok: false, status: 400, error: "Cannot publish test without any sections or questions configured." };

  const totalQuestions = test.sections.reduce((sum, s) => sum + s.questions.length, 0);
  if (totalQuestions === 0) return { ok: false, status: 400, error: "Add at least one question before publishing." };
  const empty = test.sections.find((s) => s.questions.length === 0);
  if (empty) {
    return { ok: false, status: 400, error: `Section "${empty.name || "Unnamed Section"}" has no questions assigned. Every section must have questions.` };
  }

  // Module 11 Quality Audit Gate: If auditStatus is FLAGGED and not OVERRIDDEN_APPROVED, block publication
  if (test.auditStatus === "FLAGGED") {
    // Check if there are unresolved critical questions
    const criticalCount = await prisma.testQuestionAudit.count({
      where: {
        report: { testId },
        severity: "CRITICAL",
        status: { notIn: ["VERIFIED", "IGNORED", "RESOLVED"] },
      },
    });

    if (criticalCount > 0) {
      return {
        ok: false,
        status: 422,
        error: `Test publication blocked: ${criticalCount} unresolved critical quality issues exist. View Quality Audit Report to review or apply an administrative override.`,
        criticalIssuesCount: criticalCount,
      };
    }
  }

  const publishedBy = actorUserId ?? test.createdById ?? null;
  const unpublished = test.sections.flatMap((s) =>
    s.questions.filter((sq) => !sq.question.isPublished || sq.question.status !== "PUBLISHED").map((sq) => sq.questionId)
  );

  // Only one caller wins when several publish at the same moment (status still DRAFT).
  const won = await prisma.$transaction(async (tx) => {
    const res = await tx.test.updateMany({ where: { id: testId, status: "DRAFT" }, data: { status: "PUBLISHED" } });
    if (res.count === 0) return false;
    if (unpublished.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: unpublished } },
        data: { isPublished: true, status: "PUBLISHED", publishedAt: new Date(), ...(publishedBy && { publishedById: publishedBy }) },
      });
    }
    return true;
  });
  if (!won) return { ok: false, status: 409, error: "This test has already been published." };

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: actorUserId ? "TEST_PUBLISHED" : "TEST_AUTO_PUBLISHED",
      entityType: "Test",
      entityId: testId,
      metadata: {
        questionCount: totalQuestions,
        sectionsCount: test.sections.length,
        templateId: test.templateId,
        ...(test.openTime && { openTime: test.openTime.toISOString() }),
      },
    },
  });
  return { ok: true };
}

/**
 * Publishes every draft test whose set time has come.
 */
export async function publishDueTests(options?: {
  testIds?: string[];
  chapterId?: string;
  batchScheduleId?: string;
}): Promise<number> {
  const now = new Date();
  const where: any = {
    status: "DRAFT",
    openTime: { lte: now },
  };

  if (options?.testIds && options.testIds.length > 0) {
    where.id = { in: options.testIds };
  } else if (options?.chapterId) {
    where.chapterId = options.chapterId;
  } else if (options?.batchScheduleId) {
    where.batchScheduleId = options.batchScheduleId;
  } else {
    return 0;
  }

  const due = await prisma.test.findMany({
    where,
    select: { id: true },
    take: 50,
  });

  let published = 0;
  for (const t of due) {
    const r = await publishTestNow(t.id, null);
    if (r.ok) published++;
  }
  return published;
}
