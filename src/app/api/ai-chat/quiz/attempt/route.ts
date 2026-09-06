import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { awardXp, registerDailyActivity } from "@/lib/ai-chat/gamification";
import { finalizeQuizAttempt } from "@/lib/ai-chat/atomicGuruPipeline";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: "start" | "finalize";
      attemptId?: string;
      quizId?: string;
      subject?: string;
      topic?: string;
      totalQuestions?: number;
      correct?: number;
      wrong?: number;
      unattempted?: number;
      score?: number;
      accuracy?: number;
      timeTakenSec?: number;
      breakdown?: Record<string, unknown>;
    };

    const prisma = getPrisma();

    // 1. Action: start new attempt to get attemptId for real-time answer persistence
    if (body.action === "start") {
      const attempt = await prisma.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: body.quizId || null,
          subject: body.subject || "NEET Practice",
          topic: body.topic ?? null,
          totalQuestions: body.totalQuestions || 0,
          correct: 0,
          wrong: 0,
          unattempted: body.totalQuestions || 0,
          score: 0,
          accuracy: 0,
          timeTakenSec: 0,
        },
      });
      return NextResponse.json({ attemptId: attempt.id, attempt }, { status: 201 });
    }

    // 2. Authoritative finalization if attemptId already exists
    if (body.attemptId) {
      try {
        const finalResult = await finalizeQuizAttempt({
          attemptId: body.attemptId,
          userId: user.id,
          timeTakenSec: body.timeTakenSec,
        });
        return NextResponse.json(finalResult, { status: 200 });
      } catch (finalizeErr) {
        console.warn("[finalizeQuizAttempt warning, falling back]", finalizeErr);
      }
    }

    // 3. Fallback: create attempt record on the fly
    if (
      !body.subject ||
      body.totalQuestions === undefined ||
      body.correct === undefined ||
      body.wrong === undefined ||
      body.unattempted === undefined ||
      body.score === undefined ||
      body.accuracy === undefined
    ) {
      return NextResponse.json({ error: "Missing quiz attempt fields." }, { status: 400 });
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizId: body.quizId || null,
        subject: body.subject,
        topic: body.topic ?? null,
        totalQuestions: body.totalQuestions,
        correct: body.correct,
        wrong: body.wrong,
        unattempted: body.unattempted,
        score: body.score,
        accuracy: body.accuracy,
        timeTakenSec: body.timeTakenSec ?? null,
        breakdown: body.breakdown ? (body.breakdown as Prisma.InputJsonValue) : undefined,
      },
    });

    await registerDailyActivity(user.id);
    const xpGained = body.correct * 10 + body.wrong * 2;
    await awardXp(user.id, xpGained);

    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    console.error("[Quiz attempt API]", error);
    return NextResponse.json({ error: "Could not save quiz attempt." }, { status: 500 });
  }
}
