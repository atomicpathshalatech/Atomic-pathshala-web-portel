import "server-only";
import { prisma } from "@/lib/db";

/**
 * Scheduled tests: a test made for a set time (its openTime) stays a draft
 * until then, so the team can keep adding and correcting questions; students
 * already see it as "Upcoming" (not openable). At the set time it publishes
 * itself, and from then on it can no longer be changed.
 *
 * There is no minute-by-minute cron on this hosting plan, so "publishes
 * itself" happens the moment anyone needs it: a student opening tests or
 * starting one, the team opening the test (publishDueTests below).
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

export type PublishResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Publishes one draft test: every section needs questions; the questions in
 * it are published with it. Used by the Publish button and by the automatic
 * publish at the set time (actor null).
 */
export async function publishTestNow(testId: string, actorUserId: string | null): Promise<PublishResult> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { sections: { include: { questions: { include: { question: { select: { isPublished: true, status: true } } } } } } },
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
 * Publishes every draft test whose set time has come (optionally only these
 * ids). A test that cannot be published (no questions) stays a draft and is
 * not opened for students. Never throws: callers are page loads.
 */
export async function publishDueTests(opts: { testIds?: string[]; chapterId?: string; now?: Date } = {}): Promise<number> {
  try {
    const now = opts.now ?? new Date();
    const due = await prisma.test.findMany({
      where: {
        status: "DRAFT",
        archived: false,
        openTime: { lte: now, gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) },
        ...(opts.testIds && { id: { in: opts.testIds } }),
        ...(opts.chapterId && { chapterId: opts.chapterId }),
      },
      select: { id: true },
      take: 50,
    });
    let published = 0;
    for (const t of due) {
      const r = await publishTestNow(t.id, null);
      if (r.ok) published++;
    }
    return published;
  } catch (err) {
    console.error("[publishDueTests]", err);
    return 0;
  }
}

/**
 * For removing questions / changing sections, which also used to work on a
 * published test: blocked once the test has started or anyone has taken it.
 */
export async function testStartedReason(test: { id: string; openTime?: Date | string | null }, now: Date = new Date()): Promise<string | null> {
  if (test.openTime && now.getTime() >= new Date(test.openTime).getTime()) {
    return `This test started at ${formatIst(test.openTime)} — questions can no longer be changed.`;
  }
  const attempts = await prisma.attempt.count({ where: { testId: test.id } });
  return attempts > 0 ? "Students have already taken this test — questions can no longer be changed." : null;
}
