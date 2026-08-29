import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

const createBatchSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const prisma = getPrisma();
    const batches = await prisma.aiChatBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        _count: { select: { enrollments: true, subscriptions: true } },
      },
    });
    const courses = await prisma.aiChatCourse.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, slug: true },
    });
    return NextResponse.json({ batches, courses });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    console.error("[Admin batches API]", error);
    return NextResponse.json({ error: "Could not load batches." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = createBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid batch details." },
        { status: 400 }
      );
    }
    const batch = await getPrisma().aiChatBatch.create({
      data: {
        courseId: parsed.data.courseId,
        title: parsed.data.title,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
    });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    console.error("[Admin batch create API]", error);
    return NextResponse.json({ error: "Could not create batch." }, { status: 500 });
  }
}
