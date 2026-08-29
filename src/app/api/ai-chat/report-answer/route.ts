import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      questionText?: string;
      answerText?: string;
      reason?: string;
    };

    if (!body.answerText?.trim()) {
      return NextResponse.json({ error: "Answer text is required." }, { status: 400 });
    }

    const user = await getCurrentUser();
    const prisma = getPrisma();

    await prisma.answerReport.create({
      data: {
        userId: user?.id ?? null,
        questionText: body.questionText?.trim() || "(not available)",
        answerText: body.answerText.trim(),
        reason: body.reason?.trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Report Answer API]", error);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}
