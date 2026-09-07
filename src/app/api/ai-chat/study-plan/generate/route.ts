import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { generateStudyPlanContent } from "@/lib/ai-chat/gemini";
import { getProgressSnapshot, buildStudyPlanPrompt } from "@/lib/ai-chat/coach";
import { getGeminiErrorDetails } from "@/lib/ai-chat/errors";

export const runtime = "nodejs";

const PLAN_DAYS = 7;

const generatedPlanSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  tasks: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        subject: z.string().trim().min(1).max(60),
        description: z.string().trim().min(1).max(300),
        taskType: z.enum(["REVISE", "PRACTICE", "TEST", "CLASS"]),
      })
    )
    .min(1)
    .max(30),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * (Re)generates the signed-in student's rolling 7-day study plan. Clears
 * any not-yet-completed future tasks and replaces them — completed tasks
 * (history) are left untouched so a regenerate mid-week doesn't erase what
 * the student already did.
 */
export async function POST() {
  try {
    const user = await requireCurrentUser();
    const prisma = getPrisma();

    const snapshot = await getProgressSnapshot(user.id);
    const today = todayIso();
    const prompt = buildStudyPlanPrompt(snapshot, PLAN_DAYS, today);

    const raw = await generateStudyPlanContent(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[Study Plan Generate] Gemini returned non-JSON:", raw.slice(0, 500));
      return NextResponse.json(
        { error: "Couldn't generate a plan this time. Please try again." },
        { status: 502 }
      );
    }

    const result = generatedPlanSchema.safeParse(parsed);
    if (!result.success) {
      console.error("[Study Plan Generate] Gemini JSON failed validation:", result.error.flatten());
      return NextResponse.json(
        { error: "Couldn't generate a plan this time. Please try again." },
        { status: 502 }
      );
    }

    const { summary, tasks } = result.data;

    const todayStart = new Date(`${today}T00:00:00.000Z`);

    const plan = await prisma.$transaction(async (tx) => {
      const upserted = await tx.studyPlan.upsert({
        where: { userId: user.id },
        create: { userId: user.id, summary },
        update: { summary, generatedAt: new Date() },
      });

      // Clear stale, not-yet-completed future tasks before inserting the
      // new set — completed tasks (already-done history) are untouched.
      await tx.studyPlanTask.deleteMany({
        where: { planId: upserted.id, completed: false, date: { gte: todayStart } },
      });

      await tx.studyPlanTask.createMany({
        data: tasks.map((t) => ({
          planId: upserted.id,
          date: new Date(`${t.date}T00:00:00.000Z`),
          subject: t.subject,
          description: t.description,
          taskType: t.taskType,
        })),
      });

      return tx.studyPlan.findUniqueOrThrow({
        where: { id: upserted.id },
        include: { tasks: { orderBy: { date: "asc" } } },
      });
    });

    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    console.error("[Study Plan Generate]", getGeminiErrorDetails(error));
    return NextResponse.json(
      { error: "Something went wrong generating your plan. Please try again." },
      { status: 500 }
    );
  }
}
