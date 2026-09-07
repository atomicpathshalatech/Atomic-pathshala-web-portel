import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

const patchSchema = z.object({ completed: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    const prisma = getPrisma();

    const task = await prisma.studyPlanTask.findUnique({
      where: { id: params.id },
      include: { plan: { select: { userId: true } } },
    });
    if (!task || task.plan.userId !== user.id) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const { completed } = patchSchema.parse(await request.json());

    const updated = await prisma.studyPlanTask.update({
      where: { id: task.id },
      data: { completed, completedAt: completed ? new Date() : null },
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 422 });
    }
    console.error("[Study Plan Task API]", error);
    return NextResponse.json({ error: "Could not update this task." }, { status: 500 });
  }
}
