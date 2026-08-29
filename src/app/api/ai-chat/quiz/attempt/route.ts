import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { awardXp, registerDailyActivity } from "@/lib/ai-chat/gamification";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const body = (await request.json()) as {
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

    const prisma = getPrisma();

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
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

    // Streak + XP: the source app updated currentStreak/longestStreak/
    // lastActivityDate/totalXp directly on User. Those fields weren't
    // carried over onto atomic-ops's User (see the schema's AI Chat
    // integration comment) — UserProfile.xp/currentStreak/longestStreak is
    // the one gamification store now (same one dashboardStats.ts reads),
    // so route the same "correct*10 + wrong*2" XP formula through it via
    // gamification.ts instead of writing to fields that no longer exist.
    await registerDailyActivity(user.id);
    const xpGained = body.correct * 10 + body.wrong * 2;
    await awardXp(user.id, xpGained);

    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    console.error("[Quiz attempt API]", error);
    return NextResponse.json({ error: "Could not save quiz attempt." }, { status: 500 });
  }
}
