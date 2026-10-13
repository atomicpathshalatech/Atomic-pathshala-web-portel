import "server-only";
import { prisma } from "@/lib/db";
import { findDuplicateCandidates } from "./duplicates";

/**
 * Runs the duplicate finder over the Question Bank and stores the result.
 *
 * A pair a person has already decided is never touched. An undecided pair
 * that the finder no longer reports (one of the questions was edited or
 * deleted) is removed. No question is changed.
 */
export async function scanForDuplicates(subject?: string) {
  const rows = await prisma.question.findMany({
    where: subject ? { subject } : {},
    select: { id: true, subject: true, type: true, imageUrl: true, translations: { select: { language: true, statement: true, options: true, correctOptionIds: true } } },
  });
  const found = findDuplicateCandidates(rows.map((r) => ({ ...r, type: String(r.type) })));

  const scope = subject ? { questionA: { subject } } : {};
  const existing = await prisma.questionDuplicateCandidate.findMany({ where: scope, select: { id: true, questionAId: true, questionBId: true, status: true, category: true, score: true, sameAnswer: true } });
  const byPair = new Map(existing.map((e) => [`${e.questionAId}|${e.questionBId}`, e]));
  const foundPairs = new Set(found.map((c) => `${c.questionAId}|${c.questionBId}`));

  const toCreate = found.filter((c) => !byPair.has(`${c.questionAId}|${c.questionBId}`));
  const toUpdate = found.filter((c) => {
    const e = byPair.get(`${c.questionAId}|${c.questionBId}`);
    return e && e.status === "PENDING" && (e.category !== c.category || e.score !== c.score || e.sameAnswer !== c.sameAnswer);
  });
  const gone = existing.filter((e) => e.status === "PENDING" && !foundPairs.has(`${e.questionAId}|${e.questionBId}`)).map((e) => e.id);

  if (toCreate.length) await prisma.questionDuplicateCandidate.createMany({ data: toCreate, skipDuplicates: true });
  for (const c of toUpdate) {
    await prisma.questionDuplicateCandidate.update({
      where: { questionAId_questionBId: { questionAId: c.questionAId, questionBId: c.questionBId } },
      data: { category: c.category, score: c.score, method: c.method, language: c.language, sameAnswer: c.sameAnswer, note: c.note },
    });
  }
  if (gone.length) await prisma.questionDuplicateCandidate.deleteMany({ where: { id: { in: gone }, status: "PENDING" } });

  return { questions: rows.length, found: found.length, added: toCreate.length, updated: toUpdate.length, removed: gone.length };
}

export const DUPLICATE_DECISIONS = ["CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "KEEP_BOTH", "PENDING"] as const;
export type DuplicateDecision = (typeof DUPLICATE_DECISIONS)[number];

/** A person's decision on a pair. PENDING reopens it. It is a record only: no question is merged, hidden or deleted. */
export async function decideDuplicate(id: string, userId: string, status: DuplicateDecision, note?: string) {
  const decided = status !== "PENDING";
  return prisma.questionDuplicateCandidate.update({
    where: { id },
    data: { status, decidedById: decided ? userId : null, decidedAt: decided ? new Date() : null, decisionNote: decided ? note ?? null : null },
  });
}
