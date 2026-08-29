import { NextResponse } from "next/server";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { awardXp, registerDailyActivity, xpForQuizResult } from "@/lib/ai-chat/gamification";

export const runtime = "nodejs";

interface SubjectResult {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  maxScore: number;
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = (await request.json()) as { testName?: string; results?: SubjectResult[] };

    if (!body.testName || !Array.isArray(body.results) || body.results.length === 0) {
      return NextResponse.json({ error: "Invalid quiz result payload." }, { status: 400 });
    }

    const prisma = getPrisma();

    for (const result of body.results) {
      if (!result.subject || typeof result.maxScore !== "number" || result.maxScore <= 0) continue;

      await prisma.testAttempt.create({
        data: {
          userId: user.id,
          testName: body.testName,
          subject: result.subject,
          score: result.score,
          maxScore: result.maxScore,
          answers: {
            correct: result.correct,
            wrong: result.wrong,
            unattempted: result.unattempted,
          },
          submittedAt: new Date(),
        },
      });

      const scorePercent = Math.max(0, Math.min(100, (result.score / result.maxScore) * 100));
      await awardXp(user.id, xpForQuizResult(scorePercent));
    }

    await registerDailyActivity(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "Sign in is required to save quiz results." },
        { status: 401 }
      );
    }
    console.error("[Quiz Result API]", error);
    return NextResponse.json({ error: "Could not save quiz result." }, { status: 500 });
  }
}
