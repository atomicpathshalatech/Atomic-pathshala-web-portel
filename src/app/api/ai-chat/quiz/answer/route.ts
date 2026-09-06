import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { recordQuizAnswer } from "@/lib/ai-chat/atomicGuruPipeline";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Allow answering even if unauthenticated by fallback guest attempt, but record user if present
    const body = (await request.json()) as {
      attemptId?: string;
      quizId?: string;
      questionId?: string;
      selectedIndex?: number;
      timeTakenSec?: number;
    };

    const { attemptId, quizId, questionId, selectedIndex, timeTakenSec = 0 } = body;

    if (!questionId || selectedIndex === undefined) {
      return NextResponse.json({ error: "Missing required answer fields." }, { status: 400 });
    }

    const effectiveAttemptId = attemptId || `guest-attempt-${user?.id || "anon"}-${quizId || Date.now()}`;

    const result = await recordQuizAnswer({
      attemptId: effectiveAttemptId,
      quizId,
      questionId,
      selectedIndex,
      timeTakenSec,
    });

    return NextResponse.json({
      success: true,
      isCorrect: result.isCorrect,
      correctIndex: result.correctIndex,
      solution: result.solution,
    });
  } catch (error) {
    console.error("[Quiz Answer API]", error);
    return NextResponse.json({ error: "Could not evaluate or record answer." }, { status: 500 });
  }
}
