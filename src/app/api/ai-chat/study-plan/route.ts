import { NextResponse } from "next/server";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

/** The signed-in student's current study plan + tasks (or null if none yet). */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const prisma = getPrisma();

    const plan = await prisma.studyPlan.findUnique({
      where: { userId: user.id },
      include: { tasks: { orderBy: { date: "asc" } } },
    });

    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    console.error("[Study Plan API]", error);
    return NextResponse.json({ error: "Could not load your study plan." }, { status: 500 });
  }
}
