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

    const entries = getEntriesForSubject(subject as QuizSubject, body.questionCount);
        const prompt = buildQuizRequestPrompt(entries, language, topic, level);
    const raw = await generateQuizQuestions(prompt);
    const questions = parseQuizJson(raw);

        if (!questions) {
      return NextResponse.json(
        { error: "Could not generate the quiz. Please try again." },
        { status: 502 }
      );
    }

    if (user) {
      await recordQuestionUsage(user.id);
    }

    try {
      await saveQuestionsToBank(questions, language);
    } catch (bankError) {
      console.error("[QuestionBank] Failed to save generated questions", bankError);
    }

    return NextResponse.json({ questions, entries });
  } catch (error) {
    console.error("[Quiz API]", error);
    return NextResponse.json({ error: "Could not generate the quiz." }, { status: 500 });
  }
}
