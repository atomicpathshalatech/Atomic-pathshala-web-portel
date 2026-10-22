import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { generateQuizQuestions } from "@/lib/ai-chat/gemini";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import {
  hasActiveSubscription,
  getDailyQuestionsUsed,
  recordQuestionUsage,
  DAILY_FREE_LIMIT,
} from "@/lib/ai-chat/access";
import { saveQuestionsToBank } from "@/lib/ai-chat/questionBank";
import {
  buildQuizRequestPrompt,
  parseQuizJson,
  getEntriesForSubject,
  answerIndexFromText,
  QUESTION_TYPE_LABELS,
  type QuizSubject,
  type QuizLevel,
  type QuizQuestion,
  type QuizConfigEntry,
  type QuestionType,
} from "@/lib/ai-chat/quiz";
import {
  createGenerationJob,
  updateGenerationJob,
  persistPracticeQuiz,
  streamToQuestionBankDraft,
} from "@/lib/ai-chat/atomicGuruPipeline";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// Generation is bounded by GENERATION_BUDGET_MS below; the rest is headroom.
export const maxDuration = 90;

const VALID_SUBJECTS: QuizSubject[] = ["Biology", "Physics", "Chemistry", "Full NEET"];
const VALID_LANGUAGES = ["english", "hindi", "hinglish"];

/**
 * Questions per AI request. A whole 20-40 question quiz in one request took
 * minutes (and timed out or came back cut off); small batches run side by
 * side and each answers in seconds.
 */
const BATCH_SIZE = 5;
/** One model attempt; past this the next model is tried. */
const ATTEMPT_TIMEOUT_MS = 30_000;
/** The student never waits longer than this for the AI part. */
const GENERATION_BUDGET_MS = 55_000;

function withBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      () => (clearTimeout(timer), resolve(null))
    );
  });
}

/**
 * One AI batch. Now and then the model returns JSON that can't be used (cut
 * off, or every question malformed) — that batch is asked once more while
 * there's still time in the budget.
 */
async function runBatch(prompt: string): Promise<QuizQuestion[] | null> {
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = parseQuizJson(await generateQuizQuestions(prompt, { attemptTimeoutMs: ATTEMPT_TIMEOUT_MS }));
    if (parsed?.length) return parsed;
    if (Date.now() - started > GENERATION_BUDGET_MS - 25_000) break;
  }
  return null;
}

function normText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Splits each subject's count into AI batches of BATCH_SIZE. */
function planBatches(entries: QuizConfigEntry[]) {
  const batches: { entry: QuizConfigEntry; part: number; parts: number }[] = [];
  for (const entry of entries) {
    const parts = Math.max(1, Math.ceil(entry.questionCount / BATCH_SIZE));
    for (let part = 0; part < parts; part++) {
      const count = Math.min(BATCH_SIZE, entry.questionCount - part * BATCH_SIZE);
      if (count > 0) batches.push({ entry: { ...entry, questionCount: count }, part, parts });
    }
  }
  return batches;
}

/**
 * Previously generated questions for the subject (and topic), used when the
 * AI couldn't deliver the full set in time — so the quiz still starts.
 * Questions students reported as wrong are skipped.
 */
async function bankQuestions(opts: {
  subject: string;
  language: string;
  topic?: string;
  need: number;
  exclude: Set<string>;
}): Promise<QuizQuestion[]> {
  if (opts.need <= 0) return [];
  const topicWords = opts.topic?.split(/\s*-\s*/)[0]?.trim();
  const rows = await prisma.questionBank.findMany({
    where: {
      subject: opts.subject,
      language: opts.language,
      reports: { none: {} },
      ...(topicWords
        ? {
            OR: [
              { chapter: { contains: topicWords, mode: "insensitive" } },
              { topic: { contains: topicWords, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, opts.need * 6),
    select: { id: true, subject: true, chapter: true, topic: true, text: true, options: true, correctIndex: true, explanation: true, difficulty: true },
  });
  // Shuffle so repeat quizzes don't get the same fill-ins.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }
  const out: QuizQuestion[] = [];
  for (const r of rows) {
    if (out.length >= opts.need) break;
    const options = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : [];
    if (options.length !== 4 || options.some((o) => !o.trim())) continue;
    const key = normText(r.text);
    if (opts.exclude.has(key)) continue;
    opts.exclude.add(key);
    // Older rows can carry the answer/solution mismatch fixed in parseQuizJson:
    // trust the answer the explanation arrives at.
    const fromExplanation = answerIndexFromText(r.explanation.slice(-240).match(/(?:option|विकल्प|answer|उत्तर)[^\n]{0,20}/i)?.[0], options);
    out.push({
      id: `bank-${r.id}`,
      subject: r.subject,
      text: r.text,
      options,
      correctIndex: fromExplanation ?? r.correctIndex,
      explanation: r.explanation,
      chapter: r.chapter ?? undefined,
      topic: r.topic ?? undefined,
      difficulty: r.difficulty ?? undefined,
      questionType: "single_correct",
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      subject?: string;
      language?: string;
      topic?: string;
      questionCount?: number;
      level?: string;
      format?: string;
      sourceModule?: string;
    };
    const subject = body.subject;
    const language = VALID_LANGUAGES.includes(body.language ?? "")
      ? (body.language as "english" | "hindi" | "hinglish")
      : "english";
    const topic = body.topic?.trim() || undefined;
    const VALID_LEVELS: QuizLevel[] = ["Easy", "Medium", "Hard", "Mixed"];
    const level: QuizLevel = VALID_LEVELS.includes(body.level as QuizLevel)
      ? (body.level as QuizLevel)
      : "Medium";
    // The question format picked on the quiz screen (it used to be ignored).
    const format =
      body.format && body.format in QUESTION_TYPE_LABELS ? (body.format as QuestionType) : undefined;

    if (!subject || !VALID_SUBJECTS.includes(subject as QuizSubject)) {
      return NextResponse.json({ error: "Invalid quiz subject." }, { status: 400 });
    }

    const sourceModule =
      body.sourceModule ||
      (subject === "Full NEET" ? "NEET_QUIZ" : topic ? "TOPIC_WISE_QUIZ" : "NEET_QUIZ");

    const isNcertPractice =
      sourceModule === "NCERT_QUIZ" ||
      sourceModule === "NCERT_PRACTICE" ||
      body.sourceModule === "NCERT_QUIZ" ||
      body.sourceModule === "NCERT_PRACTICE" ||
      subject === "NCERT";

    const user = await getCurrentUser();
    // Only apply daily free-quiz quota to non-NCERT quizzes (NEET Quiz / Topic-wise Quiz)
    if (user && !isNcertPractice) {
      const isSubscribed = await hasActiveSubscription(user.id);
      if (!isSubscribed) {
        const used = await getDailyQuestionsUsed(user.id, "QUIZ_GENERATED");
        if (used >= DAILY_FREE_LIMIT) {
          return NextResponse.json(
            {
              error: "Aaj ke free sawaal khatam ho gaye. Subscribe karke unlimited access paayein.",
              code: "DAILY_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
      }
    }

    const asked = Number(body.questionCount);
    const requestedCount = Number.isFinite(asked) && asked > 0 ? Math.min(60, Math.round(asked)) : undefined;
    const entries = getEntriesForSubject(subject as QuizSubject, requestedCount);
    const totalRequested = entries.reduce((sum, e) => sum + e.questionCount, 0);

    let generationJobId: string | undefined;
    try {
      generationJobId = await createGenerationJob({
        userId: user?.id,
        sourceModule,
        subject,
        topic,
        requestedQuestionCount: totalRequested,
      });
    } catch (jobErr) {
      console.warn("[AtomicGuru] GenerationJob init warning:", jobErr);
    }

    // 1. The AI batches, side by side, within one time budget.
    const batches = planBatches(entries);
    const results = await Promise.all(
      batches.map(({ entry, part, parts }) => {
        const spread =
          parts > 1
            ? `\nThis is part ${part + 1} of ${parts} of the same quiz, generated separately: choose different sub-topics and concepts from the other parts (part ${part + 1} covers the ${part + 1}${["st", "nd", "rd"][part] ?? "th"} slice of the syllabus/topic).`
            : "";
        const prompt = buildQuizRequestPrompt([entry], language, topic, level, format) + spread;
        return withBudget(runBatch(prompt), GENERATION_BUDGET_MS);
      })
    );

    // 2. Merge per subject, drop duplicates across batches, renumber ids.
    const seen = new Set<string>();
    const aiQuestions: QuizQuestion[] = [];
    const bySubject = new Map<string, QuizQuestion[]>();
    batches.forEach(({ entry }, i) => {
      const list = bySubject.get(entry.subject) ?? [];
      for (const q of results[i] ?? []) {
        const key = normText(q.text || q.assertionText || (q.statements ?? []).join(" "));
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push(q);
      }
      bySubject.set(entry.subject, list);
    });

    // 3. Short of the requested count (AI slow or failing): fill from the
    // bank so the quiz still starts.
    const questions: QuizQuestion[] = [];
    const finalEntries: QuizConfigEntry[] = [];
    let filledFromBank = 0;
    for (const entry of entries) {
      const ai = (bySubject.get(entry.subject) ?? []).slice(0, entry.questionCount);
      aiQuestions.push(...ai);
      let fill: QuizQuestion[] = [];
      if (ai.length < entry.questionCount) {
        fill = await bankQuestions({
          subject: entry.subject,
          language,
          topic,
          need: entry.questionCount - ai.length,
          exclude: seen,
        }).catch(() => []);
        filledFromBank += fill.length;
      }
      const prefix = entry.subject.charAt(0).toLowerCase();
      const set = [...ai, ...fill].map((q, i) => ({ ...q, id: `${prefix}${i + 1}` }));
      questions.push(...set);
      if (set.length > 0) finalEntries.push({ ...entry, questionCount: set.length });
    }

    if (questions.length === 0) {
      if (generationJobId) {
        await updateGenerationJob({
          jobId: generationJobId,
          status: "FAILED",
          errorDetails: "AI generation failed or timed out and no saved questions matched.",
        }).catch(() => undefined);
      }
      return NextResponse.json(
        { error: "Could not generate the quiz right now. Please try again in a minute." },
        { status: 502 }
      );
    }
    if (filledFromBank > 0) {
      console.warn(`[quiz] ${filledFromBank}/${questions.length} questions filled from the bank (AI short)`);
    }

    if (user && !isNcertPractice) {
      await recordQuestionUsage(user.id, "QUIZ_GENERATED");
    }

    if (generationJobId) {
      await updateGenerationJob({
        jobId: generationJobId,
        status: "COMPLETED",
        successfulCount: questions.length,
      }).catch(() => undefined);
    }

    // The quiz record — its id is needed for the student's attempt.
    let dbQuizId: string | undefined;
    try {
      const quizCode = `QZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const practiceQuiz = await persistPracticeQuiz({
        quizCode,
        userId: user?.id,
        sourceModule,
        subject,
        topic,
        questionCount: questions.length,
        difficulty: level,
        language,
        generationJobId,
        questions,
      });
      if (practiceQuiz) dbQuizId = practiceQuiz.id;
    } catch (pqErr) {
      console.warn("[AtomicGuru] PracticeQuiz persistence warning:", pqErr);
    }

    // Copying the new AI questions into the Question Bank happens after the
    // response — the student used to wait for every one of those writes.
    if (aiQuestions.length > 0) {
      waitUntil(
        (async () => {
          try {
            await streamToQuestionBankDraft({
              questions: aiQuestions,
              sourceModule,
              userId: user?.id,
              language,
              generationJobId,
            });
          } catch (draftErr) {
            console.warn("[AtomicGuru] Question Bank Draft streaming warning:", draftErr);
          }
          try {
            await saveQuestionsToBank(aiQuestions, language);
          } catch (bankError) {
            console.error("[QuestionBank] Failed to save generated questions", bankError);
          }
        })()
      );
    }

    return NextResponse.json({
      questions,
      entries: finalEntries,
      quizId: dbQuizId,
      generationJobId,
    });
  } catch (error) {
    console.error("[Quiz API]", error);
    return NextResponse.json({ error: "Could not generate the quiz." }, { status: 500 });
  }
}
