import { NextRequest, NextResponse } from "next/server";
import { PYQ_BANK, type PyqSubject } from "@/lib/ai-chat/pyqBank";
import type { QuizQuestion } from "@/lib/ai-chat/quiz";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import {
  hasActiveSubscription,
  getDailyQuestionsUsed,
  recordQuestionUsage,
  DAILY_FREE_LIMIT,
} from "@/lib/ai-chat/access";

export const runtime = "nodejs";

const VALID_SUBJECTS: PyqSubject[] = ["Biology", "Physics", "Chemistry"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      subject?: string;
      years?: number[];
      questionCount?: number;
    };

    const subject = body.subject;
    const years = body.years;
    const questionCount = Math.min(Math.max(body.questionCount ?? 10, 5), 30);

    if (!subject || !VALID_SUBJECTS.includes(subject as PyqSubject)) {
      return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
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

    let pool = PYQ_BANK.filter((q) => q.exam === "NEET" && q.subject === subject);
    if (years && years.length > 0) {
      pool = pool.filter((q) => years.includes(q.year));
    }

    if (pool.length === 0) {
      return NextResponse.json(
        {
          error:
            "PYQ data is not available yet for this selection. Please choose different filters or check back later.",
        },
        { status: 404 }
      );
    }

    const selected = shuffle(pool).slice(0, Math.min(questionCount, pool.length));

    const questions: QuizQuestion[] = selected.map((q, idx) => ({
      id: `pyq-${idx}-${Date.now()}`,
      subject: q.subject,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: "Hard",
      questionType: "single_correct",
    }));

    const entries = [
      {
        subject: subject as "Biology" | "Physics" | "Chemistry",
        questionCount: questions.length,
        timerSeconds: 60,
      },
    ];

    if (user) {
      await recordQuestionUsage(user.id);
    }

    return NextResponse.json({ questions, entries });
  } catch (error) {
    console.error("[PYQ Quiz API]", error);
    return NextResponse.json({ error: "Could not load PYQ questions." }, { status: 500 });
  }
}
