/**
 * Duplicate / similar-question check inside a chapter module (all exercises
 * of one chapter). Every question is compared with every other one:
 *
 *  - 100 %  the same question: the same Question Bank question in two places,
 *           or the same statement and the same options (in either language,
 *           ignoring spacing, punctuation, LaTeX markup and option order)
 *  - 60–95  the same statement with different options (by how alike the options are)
 *  - 90–94  the same question with only the numbers changed
 *  - below  a score from the wording (words and letter-groups) and the options
 *
 * English is compared with English and Hindi with Hindi. Two questions with no
 * language in common are compared by their options only (formulas and numbers
 * read the same in both), and say so.
 */
import { prisma } from "@/lib/db";

export interface SimilarityHit {
  score: number;
  label: string;
  reason: string;
  match: {
    exerciseQuestionId: string;
    exerciseId: string;
    exerciseTitle: string;
    number: number;
    questionCode: string | null;
    preview: string;
  };
}

type Item = {
  exerciseQuestionId: string;
  exerciseId: string;
  exerciseTitle: string;
  number: number;
  questionId: string;
  questionCode: string | null;
  langs: Record<"en" | "hi", { stmt: string; template: string; tokens: Set<string>; grams: Set<string>; options: string[] } | null>;
  preview: string;
};

/** Text as it reads: no LaTeX markup, HTML, punctuation or extra spaces. */
export function normalizeForMatch(text: string): string {
  return String(text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\(text|mathrm|mathbf|rm|bf|operatorname)\s*\{([^}]*)\}/g, " $2 ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\[FIGURE\]/gi, " figure ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = ` ${s} `;
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let both = 0;
  a.forEach((x) => {
    if (b.has(x)) both++;
  });
  return (2 * both) / (a.size + b.size);
}

function textScore(a: { tokens: Set<string>; grams: Set<string> }, b: { tokens: Set<string>; grams: Set<string> }): number {
  return 0.5 * dice(a.tokens, b.tokens) + 0.5 * dice(a.grams, b.grams);
}

/** Options compared in any order: each option's best match, averaged. */
function optionsScore(a: string[], b: string[]): number | null {
  const A = a.filter(Boolean);
  const B = b.filter(Boolean);
  if (!A.length || !B.length) return null;
  const best = (x: string, pool: string[]) => Math.max(...pool.map((y) => (x === y ? 1 : dice(trigrams(x), trigrams(y)))));
  const ab = A.reduce((n, x) => n + best(x, B), 0) / A.length;
  const ba = B.reduce((n, x) => n + best(x, A), 0) / B.length;
  return (ab + ba) / 2;
}

const sameSet = (a: string[], b: string[]) => {
  const A = a.filter(Boolean).sort();
  const B = b.filter(Boolean).sort();
  return A.length > 0 && A.length === B.length && A.every((x, i) => x === B[i]);
};

export function labelFor(score: number): string {
  if (score >= 100) return "Duplicate";
  if (score >= 90) return "Near duplicate";
  if (score >= 75) return "Very similar";
  if (score >= 60) return "Similar";
  if (score >= 40) return "Related";
  return "Different";
}

export function compare(x: Item, y: Item): { score: number; reason: string } {
  if (x.questionId === y.questionId) return { score: 100, reason: "The same Question Bank question is added twice." };

  let best = { score: 0, reason: "" };
  let shared = false;
  for (const lang of ["en", "hi"] as const) {
    const a = x.langs[lang];
    const b = y.langs[lang];
    if (!a || !b) continue;
    shared = true;
    const sameOptions = sameSet(a.options, b.options);
    const noOptions = !a.options.some(Boolean) && !b.options.some(Boolean);
    let r: { score: number; reason: string };
    if (a.stmt === b.stmt && (sameOptions || noOptions)) {
      r = { score: 100, reason: "Same statement and same options." };
    } else if (a.stmt === b.stmt) {
      // A common stem ("Which of the following is correct?") with other
      // options is a different question: the options decide.
      const o = optionsScore(a.options, b.options);
      r = { score: o === null ? 95 : Math.min(95, Math.round(60 + 35 * o)), reason: "Same statement, different options." };
    } else if (a.template === b.template && /\d/.test(a.stmt)) {
      r = { score: sameOptions ? 94 : 90, reason: "Same question with the numbers changed." };
    } else {
      const t = textScore(a, b);
      const o = optionsScore(a.options, b.options);
      // Short stems say little on their own; their options carry the question.
      const w = Math.min(a.tokens.size, b.tokens.size) < 10 ? 0.4 : 0.75;
      const s = o === null ? t : w * t + (1 - w) * o;
      r = { score: Math.min(89, Math.round(s * 100)), reason: o !== null && o >= 0.999 ? "Same options, similar wording." : "Similar wording." };
    }
    if (r.score > best.score) best = r;
  }
  if (!shared) {
    // Different languages: options (formulas, numbers, names) are the only common ground.
    const xo = (x.langs.en ?? x.langs.hi)?.options ?? [];
    const yo = (y.langs.en ?? y.langs.hi)?.options ?? [];
    const o = optionsScore(xo, yo);
    if (o !== null) {
      const score = sameSet(xo, yo) && xo.filter(Boolean).every((v) => /\d|[a-z]/i.test(v)) ? 85 : Math.min(70, Math.round(o * 70));
      best = { score, reason: "Different languages — compared by options only." };
    }
  }
  return best;
}

export function langOf(t: { statement: string; options: unknown } | undefined) {
  if (!t?.statement?.trim()) return null;
  const stmt = normalizeForMatch(t.statement);
  const opts = (t.options && typeof t.options === "object" ? (t.options as Record<string, string>) : {}) as Record<string, string>;
  return {
    stmt,
    template: stmt.replace(/\d+(\s\d+)?/g, "#"),
    tokens: new Set(stmt.split(" ").filter(Boolean)),
    grams: trigrams(stmt),
    options: ["A", "B", "C", "D", "E"].map((k) => normalizeForMatch(opts[k] ?? "")),
  };
}

/** Every question of the chapter module, numbered as each exercise shows them. */
async function loadModule(subject: string, chapter: string): Promise<Item[]> {
  const exercises = await prisma.exercise.findMany({
    where: { subject: { equals: subject, mode: "insensitive" }, chapter: { equals: chapter, mode: "insensitive" } },
    select: {
      id: true,
      title: true,
      sections: { orderBy: { order: "asc" }, select: { id: true } },
      questions: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          sectionId: true,
          question: { select: { id: true, questionCode: true, translations: { select: { language: true, statement: true, options: true } } } },
        },
      },
    },
  });

  const items: Item[] = [];
  for (const ex of exercises) {
    const order = new Map(ex.sections.map((s, i) => [s.id, i]));
    const sorted = ex.questions
      .filter((q) => q.sectionId && order.has(q.sectionId))
      .sort((a, b) => order.get(a.sectionId!)! - order.get(b.sectionId!)!);
    sorted.forEach((eq, i) => {
      const en = eq.question.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
      const hi = eq.question.translations.find((t) => t.language.toUpperCase() === "HINDI");
      items.push({
        exerciseQuestionId: eq.id,
        exerciseId: ex.id,
        exerciseTitle: ex.title,
        number: i + 1,
        questionId: eq.question.id,
        questionCode: eq.question.questionCode,
        langs: { en: langOf(en), hi: langOf(hi) },
        preview: String(en?.statement || hi?.statement || "").replace(/\s+/g, " ").slice(0, 140),
      });
    });
  }
  return items;
}

const hit = (r: { score: number; reason: string }, m: Item): SimilarityHit => ({
  score: r.score,
  label: labelFor(r.score),
  reason: r.reason,
  match: {
    exerciseQuestionId: m.exerciseQuestionId,
    exerciseId: m.exerciseId,
    exerciseTitle: m.exerciseTitle,
    number: m.number,
    questionCode: m.questionCode,
    preview: m.preview,
  },
});

/**
 * For each question of one exercise: its closest question elsewhere in the
 * chapter module (same exercise included). Only matches of 40 % and above.
 */
export async function exerciseSimilarity(exerciseId: string) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { subject: true, chapter: true } });
  if (!ex) return { byExerciseQuestionId: {} as Record<string, SimilarityHit>, duplicates: 0, nearDuplicates: 0, compared: 0 };
  const items = await loadModule(ex.subject, ex.chapter);
  const mine = items.filter((i) => i.exerciseId === exerciseId);

  const byExerciseQuestionId: Record<string, SimilarityHit> = {};
  let duplicates = 0;
  let nearDuplicates = 0;
  for (const x of mine) {
    let top: SimilarityHit | null = null;
    for (const y of items) {
      if (y.exerciseQuestionId === x.exerciseQuestionId) continue;
      const r = compare(x, y);
      if (r.score >= 40 && (!top || r.score > top.score)) top = hit(r, y);
      if (top?.score === 100) break;
    }
    if (top) {
      byExerciseQuestionId[x.exerciseQuestionId] = top;
      if (top.score >= 100) duplicates++;
      else if (top.score >= 90) nearDuplicates++;
    }
  }
  return { byExerciseQuestionId, duplicates, nearDuplicates, compared: items.length };
}

/** One question just added: its closest matches in the module (top 3). */
export async function questionSimilarity(exerciseId: string, questionId: string) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { subject: true, chapter: true } });
  if (!ex) return null;
  const items = await loadModule(ex.subject, ex.chapter);
  const self = items.find((i) => i.exerciseId === exerciseId && i.questionId === questionId);
  if (!self) return null;
  const hits = items
    .filter((y) => y.exerciseQuestionId !== self.exerciseQuestionId)
    .map((y) => hit(compare(self, y), y))
    .filter((h) => h.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return { exerciseQuestionId: self.exerciseQuestionId, number: self.number, hits, compared: items.length - 1 };
}
