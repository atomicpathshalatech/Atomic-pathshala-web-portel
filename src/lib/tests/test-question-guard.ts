import type { Prisma, PrismaClient } from "@prisma/client";
import { questionFingerprint } from "@/lib/pyq/fingerprint";

type Db = PrismaClient | Prisma.TransactionClient;

/** Where a question already sits in a test. */
export type TestDuplicate = {
  questionId: string;
  questionCode: string | null;
  section: string;
  order: number;
  /** "id": the very same question; "content": the same question saved again under another id. */
  kind: "id" | "content";
};

/** The test a section belongs to. */
export async function testIdOfSection(db: Db, sectionId: string | null | undefined): Promise<string | null> {
  if (!sectionId) return null;
  const s = await db.section.findUnique({ where: { id: sectionId }, select: { testId: true } });
  return s?.testId ?? null;
}

/** Fingerprint of a question's English (or only) statement + option set. */
export function contentFingerprint(statement: string | null | undefined, options: unknown): string | null {
  if (!statement?.trim()) return null;
  return questionFingerprint(statement, (options as Record<string, string> | null) ?? null);
}

/**
 * Is this question already in the test — in any section, any slot? A test
 * holds each question once: the same question id, or the same question
 * (statement + options) saved again as a new question.
 * `exceptSlot` / `exceptSectionQuestionId`: the slot being filled or replaced,
 * which does not count; `exceptQuestionId`: the question being saved.
 */
export async function findInTest(
  db: Db,
  testId: string,
  q: {
    questionId?: string | null;
    fingerprint?: string | null;
    exceptSectionQuestionId?: string | null;
    exceptQuestionId?: string | null;
    exceptSlot?: { sectionId: string; order: number } | null;
    /** This question moving to another slot of this section is allowed. */
    movingWithin?: string | null;
  }
): Promise<TestDuplicate | null> {
  const links = await db.sectionQuestion.findMany({
    where: { section: { testId } },
    select: {
      id: true,
      order: true,
      sectionId: true,
      questionId: true,
      section: { select: { name: true } },
      question: {
        select: {
          questionCode: true,
          contentFingerprint: true,
          translations: { select: { language: true, statement: true, options: true } },
        },
      },
    },
  });
  for (const l of links) {
    if (l.id === q.exceptSectionQuestionId || l.questionId === q.exceptQuestionId) continue;
    if (q.exceptSlot && l.sectionId === q.exceptSlot.sectionId && l.order === q.exceptSlot.order) continue;
    const where = { questionId: l.questionId, questionCode: l.question.questionCode, section: l.section.name, order: l.order };
    if (q.questionId && l.questionId === q.questionId) {
      if (l.sectionId === q.movingWithin) continue;
      return { ...where, kind: "id" };
    }
    if (!q.fingerprint) continue;
    const en = l.question.translations.find((t) => t.language === "ENGLISH") ?? l.question.translations[0];
    const theirs = contentFingerprint(en?.statement, en?.options);
    if (l.question.contentFingerprint === q.fingerprint || theirs === q.fingerprint) return { ...where, kind: "content" };
  }
  return null;
}

/** The message shown when a question is already in the test. */
export function duplicateMessage(d: TestDuplicate) {
  const at = `${d.section} Q${d.order}${d.questionCode ? ` (${d.questionCode})` : ""}`;
  return d.kind === "id"
    ? `This question is already in this test at ${at}. A question can be used only once in a test.`
    : `The same question is already in this test at ${at}. A question can be used only once in a test.`;
}

/**
 * Runs `fn` while holding a lock on the test, so two saves at the same
 * moment (a double click, two tabs) cannot both pass the duplicate check.
 */
export async function withTestLock<T>(db: PrismaClient, testId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"test-questions:" + testId}))`;
      return fn(tx);
    },
    { timeout: 20000, maxWait: 10000 }
  );
}

/** What a test already holds: its question ids and content fingerprints. */
export async function testContents(db: Db, testId: string): Promise<{ ids: Set<string>; fingerprints: Set<string> }> {
  const links = await db.sectionQuestion.findMany({
    where: { section: { testId } },
    select: {
      questionId: true,
      question: { select: { contentFingerprint: true, translations: { select: { language: true, statement: true, options: true } } } },
    },
  });
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const l of links) {
    ids.add(l.questionId);
    if (l.question.contentFingerprint) fingerprints.add(l.question.contentFingerprint);
    const en = l.question.translations.find((t) => t.language === "ENGLISH") ?? l.question.translations[0];
    const fp = contentFingerprint(en?.statement, en?.options);
    if (fp) fingerprints.add(fp);
  }
  return { ids, fingerprints };
}
