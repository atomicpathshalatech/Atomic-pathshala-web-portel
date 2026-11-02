import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeOptions } from "@/lib/qc/question";
import { extractCorrectOptionKeys, isAnswerCorrect } from "@/lib/test-engine/answer-evaluator";

/**
 * Student PYQ practice, straight from the team's PYQ Library (whatever is
 * added there shows here): subject → year-wise papers or chapter-wise sets
 * → the questions in test mode. Answers are checked on the server at submit;
 * they are never sent to the phone before that.
 *
 * Only occurrences not REJECTED by the team count.
 */

const LIVE_OCCURRENCE: Prisma.PyqOccurrenceWhereInput = { verificationStatus: { not: "REJECTED" } };

export type PyqOverview = {
  subjects: {
    name: string;
    count: number;
    papers: { examId: string; examName: string; year: number; count: number }[];
    chapters: { name: string; count: number }[];
  }[];
};

export async function pyqOverview(): Promise<PyqOverview> {
  const rows = await prisma.pyqOccurrence.findMany({
    where: LIVE_OCCURRENCE,
    select: { questionId: true, year: true, examId: true, exam: { select: { name: true, sortOrder: true } }, question: { select: { subject: true, chapter: true } } },
  });
  const subjects = new Map<string, { questions: Set<string>; papers: Map<string, { examId: string; examName: string; year: number; sort: number; q: Set<string> }>; chapters: Map<string, Set<string>> }>();
  for (const r of rows) {
    const subject = (r.question.subject || "").trim();
    if (!subject) continue;
    const s = subjects.get(subject) ?? { questions: new Set(), papers: new Map(), chapters: new Map() };
    s.questions.add(r.questionId);
    if (r.year) {
      const key = `${r.examId}:${r.year}`;
      const p = s.papers.get(key) ?? { examId: r.examId, examName: r.exam.name, year: r.year, sort: r.exam.sortOrder, q: new Set<string>() };
      p.q.add(r.questionId);
      s.papers.set(key, p);
    }
    const chapter = (r.question.chapter || "").trim();
    if (chapter) {
      const c = s.chapters.get(chapter) ?? new Set<string>();
      c.add(r.questionId);
      s.chapters.set(chapter, c);
    }
    subjects.set(subject, s);
  }
  return {
    subjects: Array.from(subjects.entries())
      .map(([name, s]) => ({
        name,
        count: s.questions.size,
        papers: Array.from(s.papers.values())
          .sort((a, b) => b.year - a.year || a.sort - b.sort)
          .map((p) => ({ examId: p.examId, examName: p.examName, year: p.year, count: p.q.size })),
        chapters: Array.from(s.chapters.entries())
          .map(([n, q]) => ({ name: n, count: q.size }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type PyqPracticeQuestion = {
  id: string;
  type: string;
  statement: string;
  imageUrl: string | null;
  options: { key: string; text: string }[];
  label: string | null;
};

const MAX_QUESTIONS = 200;

function questionFilter(p: { subject: string; examId?: string | null; year?: number | null; chapter?: string | null }): Prisma.QuestionWhereInput {
  const occurrence: Prisma.PyqOccurrenceWhereInput = { ...LIVE_OCCURRENCE };
  if (p.examId) occurrence.examId = p.examId;
  if (p.year) occurrence.year = p.year;
  const and: Prisma.QuestionWhereInput[] = [{ subject: { equals: p.subject, mode: "insensitive" } }, { pyqOccurrences: { some: occurrence } }];
  if (p.chapter) and.push({ chapter: { equals: p.chapter, mode: "insensitive" } });
  return { AND: and };
}

/** A paper (exam + year) or a chapter's PYQs, ready to attempt — without answers. */
export async function pyqQuestions(p: { subject: string; examId?: string | null; year?: number | null; chapter?: string | null }): Promise<PyqPracticeQuestion[]> {
  const rows = await prisma.question.findMany({
    where: questionFilter(p),
    take: MAX_QUESTIONS,
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      imageUrl: true,
      translations: { select: { language: true, statement: true, options: true } },
      pyqOccurrences: { where: LIVE_OCCURRENCE, select: { year: true, sourceLabel: true, questionNumber: true, exam: { select: { name: true } } }, take: 3 },
    },
  });
  return rows
    .map((q) => {
      const t = q.translations.find((x) => x.language.toUpperCase() === "ENGLISH") ?? q.translations.find((x) => x.language.toUpperCase() === "HINDI") ?? q.translations[0];
      if (!t?.statement?.trim()) return null;
      const occ = q.pyqOccurrences[0];
      return {
        id: q.id,
        type: q.type,
        statement: t.statement,
        imageUrl: q.imageUrl,
        options: normalizeOptions(t.options),
        label: occ ? occ.sourceLabel || [occ.exam.name, occ.year].filter(Boolean).join(" ") : null,
        order: Number.parseInt(String(occ?.questionNumber ?? "").replace(/\D/g, ""), 10) || 9999,
      };
    })
    .filter(<T,>(q: T | null): q is T => q !== null)
    // In the paper's own order (the question number printed in it), when known.
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...q }) => q);
}

export type PyqCheckResult = { questionId: string; correct: boolean; correctKeys: string[]; solution: string | null };

/** Checks the answers of a submitted PYQ set (only these questions, only PYQs). */
export async function checkPyqAnswers(answers: { questionId: string; selected: string[] }[]): Promise<PyqCheckResult[]> {
  const ids = Array.from(new Set(answers.map((a) => a.questionId))).slice(0, MAX_QUESTIONS);
  const rows = await prisma.question.findMany({
    where: { id: { in: ids }, pyqOccurrences: { some: LIVE_OCCURRENCE } },
    select: { id: true, type: true, solution: true, translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => {
      const q = byId.get(id);
      if (!q) return null;
      const selected = answers.find((a) => a.questionId === id)?.selected ?? [];
      const correctKeys = extractCorrectOptionKeys(q);
      const en = q.translations.find((t) => t.language.toUpperCase() === "ENGLISH") ?? q.translations[0];
      return {
        questionId: id,
        correct: selected.length > 0 && isAnswerCorrect(correctKeys, selected, q.type),
        correctKeys,
        solution: en?.solution || q.solution || null,
      };
    })
    .filter((r): r is PyqCheckResult => r !== null);
}
