import { NextResponse } from "next/server";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireCurrentUser();
    const params = new URL(request.url).searchParams;
    const batch = params.get("batch")?.trim();
    const search = params.get("search")?.trim();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prisma = getPrisma();
    const schedules = await prisma.classSchedule.findMany({
      where: {
        classDate: { gte: today },
        ...(batch ? { batch: batch as never } : {}),
        ...(search
          ? {
              OR: [
                { subject: { contains: search, mode: "insensitive" } },
                { teacherName: { contains: search, mode: "insensitive" } },
                { topic: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ classDate: "asc" }, { startTime: "asc" }],
      take: 100,
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    console.error("[Public Schedule API]", error);
    return NextResponse.json({ error: "Could not load schedule." }, { status: 500 });
  }
}
