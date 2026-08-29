import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

const membershipSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(10_000),
});

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const memberships = await getPrisma().batchMembership.findMany({
      where: { batchId: id },
      orderBy: { joinedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, aiChatProfile: { select: { phone: true } } } },
      },
    });
    return NextResponse.json({ memberships });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not load batch students." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const parsed = membershipSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Select at least one student." },
        { status: 400 }
      );
    }

    const { id: batchId } = await context.params;
    const prisma = getPrisma();
    const batch = await prisma.aiChatBatch.findUnique({
      where: { id: batchId },
      select: { id: true, courseId: true },
    });
    if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

    for (const userId of parsed.data.userIds) {
      await prisma.batchMembership.upsert({
        where: { userId_batchId: { userId, batchId } },
        create: { userId, batchId, courseId: batch.courseId },
        update: { status: "ACTIVE", courseId: batch.courseId, joinedAt: new Date() },
      });
    }

    return NextResponse.json({ assigned: parsed.data.userIds.length, batchId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    console.error("[Batch students API]", error);
    return NextResponse.json({ error: "Could not assign batch students." }, { status: 500 });
  }
}
