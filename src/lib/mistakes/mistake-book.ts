import "server-only";
import { prisma } from "@/lib/db";
import { toLegacyQuestion } from "@/lib/questions/legacy";
import { extractStructuredQuestionData } from "@/lib/ncert/question-pool";

/**
 * Every question a student got wrong — in submitted tests and DPPs, Atomic Guru
 * practice (topic-wise / NEET quizzes) and NCERT page practice — one entry
 * per question, newest first, with whether they've marked it understood.
 */

export type MistakeSource = "TEST_SERIES" | "DPP" | "ATOMIC_GURU" | "NCERT";

export interface UnifiedMistake {
  /** Stable per question: "test:<id>" | "guru:<id>" | "ncert:<id>". */
  key: string;
  source: MistakeSource;
  sourceName: string;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  body: string;
  options: { key: string; label: string; isCorrect: boolean; isStudentChoice: boolean }[];
  explanation?: string | null;
  attemptCount: number;
  date: Date;
  solved: boolean;
  solvedAt: Date | null;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

async function testMistakes(studentId: string): Promise<UnifiedMistake[]> {
  const raw = await prisma.attemptAnswer.findMany({
    where: { attempt: { studentId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }, isCorrect: false },
    include: {
      question: { include: { translations: true } },
      attempt: {
        select: {
          dppId: true,
          dpp: { select: { name: true } },
          test: { select: { name: true, code: true, testType: true, batchSchedule: { select: { type: true } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const out: UnifiedMistake[] = [];
  const seen = new Map<string, UnifiedMistake>();
  for (const w of raw) {
    const selected = Array.isArray(w.selectedOptionIds) ? ((w.selectedOptionIds as string[])[0] ?? null) : null;
    if (!selected) continue;
    const key = `test:${w.questionId}`;
    const prev = seen.get(key);
    if (prev) {
      prev.attemptCount++;
      continue;
    }
    const leg = toLegacyQuestion(w.question);
    const options = ["A", "B", "C", "D"]
      .map((k) => ({ key: k, label: String((leg as any)[`option${k}`] || ""), isCorrect: leg.correctOption === k, isStudentChoice: selected === k }))
      .filter((o) => !!o.label);
    // DPPs are taken through the test engine too (a backing test "DPPT-…",
    // testType DPP, or a batch DPP slot) — show them as DPP, not "Mock Test".
    const t = w.attempt.test;
    const isDpp = Boolean(w.attempt.dppId) || t?.testType === "DPP" || String(t?.code ?? "").startsWith("DPPT-") || t?.batchSchedule?.type === "DPP";
    const item: UnifiedMistake = {
      key,
      source: isDpp ? "DPP" : "TEST_SERIES",
      sourceName: isDpp ? `DPP · ${w.attempt.dpp?.name ?? t?.name ?? "Practice"}` : t?.name ?? "Mock Test",
      subject: leg.subject || "General",
      chapter: leg.chapter || null,
      topic: null,
      body: leg.body,
      options,
      explanation: leg.explanation || null,
      attemptCount: 1,
      date: w.updatedAt,
      solved: false,
      solvedAt: null,
    };
    seen.set(key, item);
    out.push(item);
  }
  return out;
}

async function guruMistakes(userId: string): Promise<UnifiedMistake[]> {
  const raw = await prisma.quizAttemptAnswer.findMany({
    where: { attempt: { userId } },
    include: { attempt: true },
    orderBy: { lastAttemptedAt: "desc" },
  });
  // Latest answer per question decides: answered right since → not a mistake.
  const latest = new Map<string, (typeof raw)[number]>();
  for (const a of raw) if (!latest.has(a.questionId)) latest.set(a.questionId, a);
  return [...latest.values()]
    .filter((a) => a.isCorrect === false)
    .map((a) => {
      const opts = Array.isArray(a.options) ? (a.options as unknown[]).map(String) : [];
      return {
        key: `guru:${a.questionId}`,
        source: "ATOMIC_GURU" as const,
        sourceName: a.attempt.topic ? `Atomic Guru · ${a.attempt.topic}` : a.attempt.subject || "Atomic Guru Practice",
        subject: a.subject || a.attempt.subject || "General",
        chapter: a.chapter || null,
        topic: a.topic || a.attempt.topic || null,
        body: a.questionText || "Question",
        options: opts.map((label, i) => ({
          key: LETTERS[i] ?? String(i + 1),
          label,
          isCorrect: a.correctAnswer === (LETTERS[i] ?? ""),
          isStudentChoice: a.selectedAnswer === (LETTERS[i] ?? ""),
        })),
        explanation: a.solution || null,
        attemptCount: a.attemptCount || 1,
        date: a.lastAttemptedAt || a.answeredAt,
        solved: false,
        solvedAt: null,
      };
    });
}

async function ncertMistakes(studentId: string): Promise<UnifiedMistake[]> {
  // Latest attempt of each NCERT page decides.
  const attempts = await prisma.ncertStudentAttempt.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: { pageId: true, answers: true, createdAt: true },
    take: 500,
  });
  const latestByPage = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!latestByPage.has(a.pageId)) latestByPage.set(a.pageId, a);

  const chosen = new Map<string, { selected: string; at: Date }>();
  for (const a of latestByPage.values()) {
    for (const ans of Array.isArray(a.answers) ? (a.answers as any[]) : []) {
      if (ans && typeof ans.questionId === "string" && typeof ans.selectedOption === "string" && ans.selectedOption) {
        chosen.set(ans.questionId, { selected: ans.selectedOption, at: a.createdAt });
      }
    }
  }
  if (chosen.size === 0) return [];
  const questions = await prisma.ncertPageQuestion.findMany({
    where: { id: { in: [...chosen.keys()] } },
    select: {
      id: true,
      question: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      page: {
        select: {
          pageNumber: true,
          document: { select: { academicSubject: { select: { name: true } }, academicChapter: { select: { title: true } } } },
        },
      },
    },
  });
  const out: UnifiedMistake[] = [];
  for (const q of questions) {
    const pick = chosen.get(q.id)!;
    if (pick.selected === q.correctAnswer) continue;
    const choices = extractStructuredQuestionData(q.options).choices.map(String);
    const matches = (k: string, label: string, v: string) => v === k || v === label;
    out.push({
      key: `ncert:${q.id}`,
      source: "NCERT",
      sourceName: `NCERT · page ${q.page.pageNumber}`,
      subject: q.page.document.academicSubject.name || "General",
      chapter: q.page.document.academicChapter.title || null,
      topic: null,
      body: q.question,
      options: choices.map((label, i) => {
        const k = LETTERS[i] ?? String(i + 1);
        return { key: k, label, isCorrect: matches(k, label, q.correctAnswer), isStudentChoice: matches(k, label, pick.selected) };
      }),
      explanation: q.explanation || null,
      attemptCount: 1,
      date: pick.at,
      solved: false,
      solvedAt: null,
    });
  }
  return out;
}

export async function loadMistakeBook(studentId: string, userId: string): Promise<UnifiedMistake[]> {
  const [tests, guru, ncert, resolved] = await Promise.all([
    testMistakes(studentId),
    guruMistakes(userId),
    ncertMistakes(studentId).catch((err) => {
      console.warn("[mistake-book] NCERT mistakes unavailable:", err);
      return [] as UnifiedMistake[];
    }),
    // Until the mistake_resolutions migration is applied nothing is solved yet.
    prisma.mistakeResolution.findMany({ where: { studentId }, select: { key: true, resolvedAt: true } }).catch(() => []),
  ]);
  const solvedAt = new Map(resolved.map((r) => [r.key, r.resolvedAt]));
  return [...tests, ...guru, ...ncert]
    .map((m) => ({ ...m, solved: solvedAt.has(m.key), solvedAt: solvedAt.get(m.key) ?? null }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
