import { NextRequest, NextResponse } from "next/server";
import { generateQuizQuestions } from "@/lib/ai-chat/gemini";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import {
  hasActiveSubscription,
  getDailyQuestionsUsed,
  recordQuestionUsage,
  DAILY_FREE_LIMIT,
} from "@/lib/ai-chat/access";
import { saveQuestionsToBank } from "@/lib/ai-chat/questionBank";
import { buildQuizRequestPrompt, parseQuizJson, getEntriesForSubject, type QuizSubject, type QuizLevel } from "@/lib/ai-chat/quiz";
import {
  createGenerationJob,
  updateGenerationJob,
  persistPracticeQuiz,
  streamToQuestionBankDraft,
} from "@/lib/ai-chat/atomicGuruPipeline";

export const runtime = "nodejs";

const VALID_SUBJECTS: QuizSubject[] = ["Biology", "Physics", "Chemistry", "Full NEET"];
const VALID_LANGUAGES = ["english", "hindi", "hinglish"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      subject?: string;
      language?: string;
      topic?: string;
      questionCount?: number;
      level?: string;
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

    if (!subject || !VALID_SUBJECTS.includes(subject as QuizSubject)) {
      return NextResponse.json({ error: "Invalid quiz subject." }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (user) {
      const isSubscribed = await hasActiveSubscription(user.id);
      if (!isSubscribed) {
        const used = await getDailyQuestionsUsed(user.id);
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

    const sourceModule =
      body.sourceModule ||
      (subject === "Full NEET" ? "NEET_QUIZ" : topic ? "TOPIC_WISE_QUIZ" : "NEET_QUIZ");

    const entries = getEntriesForSubject(subject as QuizSubject, body.questionCount);
    const requestedCount = entries.reduce((sum, e) => sum + e.questionCount, 0);

    let generationJobId: string | undefined;
    try {
      generationJobId = await createGenerationJob({
        userId: user?.id,
        sourceModule,
        subject,
        topic,
        requestedQuestionCount: requestedCount,
      });
    } catch (jobErr) {
      console.warn("[AtomicGuru] GenerationJob init warning:", jobErr);
    }

    const prompt = buildQuizRequestPrompt(entries, language, topic, level);
    const raw = await generateQuizQuestions(prompt);
    const questions = parseQuizJson(raw);

    if (!questions || questions.length === 0) {
      if (generationJobId) {
        await updateGenerationJob({
          jobId: generationJobId,
          status: "FAILED",
          errorDetails: "Gemini generation failed or returned invalid JSON format.",
        });
      }
      return NextResponse.json(
        { error: "Could not generate the quiz. Please try again." },
        { status: 502 }
      );
    }

    if (user) {
      await recordQuestionUsage(user.id);
    }

    // 1. Update Generation Job to COMPLETED
    if (generationJobId) {
      await updateGenerationJob({
        jobId: generationJobId,
        status: "COMPLETED",
        successfulCount: questions.length,
      });
    }

    // 2. Persist Practice Quiz record
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
      if (practiceQuiz) {
        dbQuizId = practiceQuiz.id;
      }
    } catch (pqErr) {
      console.warn("[AtomicGuru] PracticeQuiz persistence warning:", pqErr);
    }

    // 3. Stream AI Generated questions into Question Bank Draft pool
    try {
      await streamToQuestionBankDraft({
        questions,
        sourceModule,
        userId: user?.id,
        language,
        generationJobId,
      });
    } catch (draftErr) {
      console.warn("[AtomicGuru] Question Bank Draft streaming warning:", draftErr);
    }

    // 4. Legacy saveQuestionsToBank for backward compatibility
    try {
      await saveQuestionsToBank(questions, language);
    } catch (bankError) {
      console.error("[QuestionBank] Failed to save generated questions", bankError);
    }

    return NextResponse.json({
      questions,
      entries,
      quizId: dbQuizId,
      generationJobId,
    });
  } catch (error) {
    console.error("[Quiz API]", error);
    return NextResponse.json({ error: "Could not generate the quiz." }, { status: 500 });
  }
}
