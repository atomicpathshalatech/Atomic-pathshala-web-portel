import type { QuestionReviewItem } from "@/lib/test-engine/analysis-engine";

/**
 * Turns a result's per-question review into the numbers a student can act
 * on — all from what actually happened in this attempt (marks, negative
 * marks, time, difficulty, chapter), nothing guessed.
 */

export type Bucket = {
  key: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  max: number;
  /** Marks given away by wrong answers (negative marking). */
  negative: number;
  /** Marks not earned: wrong + skipped questions' full marks. */
  missed: number;
  accuracy: number; // % of attempted
  attemptRate: number; // % of total
  avgTimeSec: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
/** A wrong answer scores its negative marking (e.g. -1); that is what it cost. */
const lostToNegative = (q: QuestionReviewItem) => Math.max(0, -(q.marksObtained ?? 0));

function bucket(key: string, qs: QuestionReviewItem[]): Bucket {
  const correct = qs.filter((q) => q.isCorrect === true).length;
  const incorrect = qs.filter((q) => q.isAnswered && q.isCorrect === false).length;
  const attempted = qs.filter((q) => q.isAnswered).length;
  const score = qs.reduce((s, q) => s + (q.marksObtained ?? 0), 0);
  const max = qs.reduce((s, q) => s + (q.maxMarks ?? 0), 0);
  const negative = qs.filter((q) => q.isAnswered && q.isCorrect === false).reduce((s, q) => s + lostToNegative(q), 0);
  const missed = qs.filter((q) => q.isCorrect !== true).reduce((s, q) => s + (q.maxMarks ?? 0), 0);
  const time = qs.reduce((s, q) => s + (q.timeTakenSec ?? 0), 0);
  return {
    key,
    total: qs.length,
    attempted,
    correct,
    incorrect,
    skipped: qs.length - attempted,
    score: r1(score),
    max: r1(max),
    negative: r1(negative),
    missed: r1(missed),
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    attemptRate: qs.length ? Math.round((attempted / qs.length) * 100) : 0,
    avgTimeSec: qs.length ? Math.round(time / qs.length) : 0,
  };
}

function groupBy(qs: QuestionReviewItem[], keyOf: (q: QuestionReviewItem) => string) {
  const m = new Map<string, QuestionReviewItem[]>();
  for (const q of qs) {
    const k = keyOf(q) || "Other";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(q);
  }
  return m;
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CORRECT: "Single correct (MCQ)",
  MULTIPLE_CORRECT: "Multiple correct",
  MULTIPLE_INCORRECT: "Multiple incorrect",
  ASSERTION_REASON: "Assertion & Reason",
  MATCH_COLUMN: "Match the Column",
  STATEMENT_BASED: "Statement based",
  NUMERICAL: "Numerical",
  INTEGER: "Integer type",
  CONCEPTUAL: "Conceptual",
  DEEP_CONCEPT: "Deep concept",
};
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export type ChapterLoss = Bucket & { subject: string; chapter: string; topics: string[]; questionNumbers: number[] };

export type ResultInsights = {
  overall: Bucket;
  subjects: (Bucket & { weakChapters: ChapterLoss[]; verdict: string })[];
  types: (Bucket & { label: string; tip: string })[];
  chapters: ChapterLoss[];
  pattern: {
    avgTimeSec: number;
    /** Wrong after very little time — likely guessed / rushed. */
    rushedWrong: QuestionReviewItem[];
    /** Took far longer than the average. */
    slow: QuestionReviewItem[];
    slowWrong: QuestionReviewItem[];
    easyWrong: QuestionReviewItem[];
    easySkipped: QuestionReviewItem[];
    /** Marks lost to negative marking in total. */
    negative: number;
    /** Score had every wrong answer been left blank instead. */
    scoreIfNoWrong: number;
    /** By difficulty: how this attempt did on easy / medium / hard questions. */
    byDifficulty: Bucket[];
  };
};

const TYPE_TIP: Record<string, string> = {
  MATCH_COLUMN: "Match one pair you are sure of first and strike out options — most can be eliminated before matching all.",
  ASSERTION_REASON: "Judge Assertion and Reason separately as true/false, only then ask whether the Reason explains it.",
  STATEMENT_BASED: "Mark each statement T/F in the margin before reading the options.",
  NUMERICAL: "Write units and the formula first; recheck the final arithmetic once.",
  INTEGER: "Write units and the formula first; recheck the final arithmetic once.",
  MULTIPLE_CORRECT: "Test every option independently — one wrong pick costs the whole question.",
  SINGLE_CORRECT: "Eliminate two options before choosing; skip if you can't get it to two.",
};

export function buildResultInsights(questions: QuestionReviewItem[]): ResultInsights {
  const overall = bucket("All", questions);
  const avg = overall.avgTimeSec || 1;

  const chapters: ChapterLoss[] = [...groupBy(questions, (q) => `${q.subject}::${q.chapter}`).entries()]
    .map(([k, qs]) => {
      const [subject, chapter] = k.split("::");
      return {
        ...bucket(k, qs),
        subject: subject || "Other",
        chapter: chapter || "Other",
        topics: [...new Set(qs.filter((q) => q.isCorrect !== true).map((q) => q.topic).filter(Boolean))],
        questionNumbers: qs.filter((q) => q.isCorrect !== true).map((q) => q.questionNumber),
      };
    })
    .sort((a, b) => b.missed - a.missed);

  const subjects = [...groupBy(questions, (q) => q.subject).entries()]
    .map(([subject, qs]) => {
      const b = bucket(subject, qs);
      const weakChapters = chapters.filter((c) => c.subject === subject && c.missed > 0).slice(0, 3);
      let verdict: string;
      if (b.attempted === 0) verdict = "Not attempted — start with the easiest questions of this subject next time.";
      else if (b.accuracy < 60 && b.negative > 0) verdict = `Accuracy ${b.accuracy}% — wrong answers cost ${b.negative} marks. Attempt fewer, surer questions.`;
      else if (b.attemptRate < 70) verdict = `Only ${b.attemptRate}% attempted at ${b.accuracy}% accuracy — you can safely attempt more.`;
      else if (b.accuracy >= 85) verdict = `Strong: ${b.accuracy}% accuracy. Keep it with timed practice.`;
      else verdict = `${b.accuracy}% accuracy — fixing ${weakChapters[0]?.chapter ?? "your weakest chapter"} gives the quickest marks.`;
      return { ...b, weakChapters, verdict };
    })
    // Weakest (most marks missed) first.
    .sort((a, b) => b.missed - a.missed);

  const types = [...groupBy(questions, (q) => q.questionType || "SINGLE_CORRECT").entries()]
    .map(([t, qs]) => ({ ...bucket(t, qs), label: typeLabel(t), tip: TYPE_TIP[t] ?? "Practise 10 questions of this type under time." }))
    .sort((a, b) => b.missed - a.missed);

  const wrong = questions.filter((q) => q.isAnswered && q.isCorrect === false);
  const isEasy = (q: QuestionReviewItem) => /easy/i.test(q.difficulty || "");
  const pattern = {
    avgTimeSec: overall.avgTimeSec,
    rushedWrong: wrong.filter((q) => (q.timeTakenSec ?? 0) > 0 && q.timeTakenSec < Math.max(15, avg * 0.35)),
    slow: questions.filter((q) => (q.timeTakenSec ?? 0) > Math.max(120, avg * 2.2)),
    slowWrong: wrong.filter((q) => (q.timeTakenSec ?? 0) > Math.max(120, avg * 2.2)),
    easyWrong: wrong.filter(isEasy),
    easySkipped: questions.filter((q) => !q.isAnswered && isEasy(q)),
    negative: overall.negative,
    scoreIfNoWrong: r1(overall.score + overall.negative),
    byDifficulty: ["EASY", "MEDIUM", "HARD"]
      .map((d) => bucket(d, questions.filter((q) => (q.difficulty || "MEDIUM").toUpperCase() === d)))
      .filter((b) => b.total > 0),
  };

  return { overall, subjects, types, chapters, pattern };
}

export type PlanStep = { when: string; title: string; detail: string; minutes: number; icon: string; questions?: number[] };

/** A concrete, short plan from this attempt: where the marks are, in order. */
export function buildImprovementPlan(ins: ResultInsights): PlanStep[] {
  const steps: PlanStep[] = [];
  const top = ins.chapters.filter((c) => c.missed > 0).slice(0, 3);
  if (top[0]) {
    steps.push({
      when: "Today",
      title: `Fix ${top[0].chapter} (${top[0].subject}) — ${top[0].missed} marks`,
      detail: `Re-solve Q${top[0].questionNumbers.join(", Q")} from the solutions, then read the NCERT part on ${top[0].topics.slice(0, 2).join(", ") || top[0].chapter}.`,
      minutes: 30 + 5 * top[0].questionNumbers.length,
      icon: "priority_high",
      questions: top[0].questionNumbers,
    });
  }
  if (ins.pattern.rushedWrong.length >= 2) {
    steps.push({
      when: "Today",
      title: `Stop guessing — ${ins.pattern.rushedWrong.length} quick wrong answers`,
      detail: `They cost ${r1(ins.pattern.rushedWrong.reduce((s, q) => s + lostToNegative(q), 0))} negative marks. Next test: attempt only when you can rule out two options.`,
      minutes: 10,
      icon: "speed",
      questions: ins.pattern.rushedWrong.map((q) => q.questionNumber),
    });
  }
  if (top[1]) {
    steps.push({
      when: "Tomorrow",
      title: `Revise ${top[1].chapter} (${top[1].subject}) — ${top[1].missed} marks`,
      detail: `Redo Q${top[1].questionNumbers.join(", Q")} without looking, then 15 practice questions on ${top[1].topics.slice(0, 2).join(", ") || top[1].chapter}.`,
      minutes: 45,
      icon: "menu_book",
      questions: top[1].questionNumbers,
    });
  }
  const worstType = ins.types.find((t) => t.incorrect >= 2 && t.accuracy < 60);
  if (worstType) {
    steps.push({
      when: "Tomorrow",
      title: `${worstType.label}: ${worstType.accuracy}% accuracy`,
      detail: worstType.tip,
      minutes: 25,
      icon: "category",
    });
  }
  if (top[2]) {
    steps.push({
      when: "In 3 days",
      title: `Revise ${top[2].chapter} (${top[2].subject}) — ${top[2].missed} marks`,
      detail: `Short notes + 10 questions on ${top[2].topics.slice(0, 2).join(", ") || top[2].chapter}.`,
      minutes: 35,
      icon: "edit_note",
      questions: top[2].questionNumbers,
    });
  }
  if (ins.pattern.slow.length >= 3) {
    steps.push({
      when: "In 3 days",
      title: `Time: ${ins.pattern.slow.length} questions took over ${Math.round(Math.max(120, ins.pattern.avgTimeSec * 2.2) / 60)} min`,
      detail: "Do one 30-minute timed set; leave any question that crosses 2 minutes and come back at the end.",
      minutes: 30,
      icon: "timer",
    });
  }
  steps.push({
    when: "In 7 days",
    title: "Re-attempt your wrong questions",
    detail: "Open the Mistake Book and solve this test's wrong questions again without the solution. Mark each one solved when you get it right.",
    minutes: 30,
    icon: "replay",
  });
  return steps;
}
