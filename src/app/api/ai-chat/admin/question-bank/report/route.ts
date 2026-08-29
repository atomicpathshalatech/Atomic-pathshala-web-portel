import { NextResponse } from "next/server";
import { requireQuestionBankViewer, requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireQuestionBankViewer();
    const body = (await request.json()) as { questionBankId: string; reason: string };

    if (!body.questionBankId || !body.reason?.trim()) {
      return NextResponse.json({ error: "questionBankId and reason are required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const question = await prisma.questionBank.findUnique({ where: { id: body.questionBankId } });
    if (!question) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const report = await prisma.answerReport.create({
      data: {
        userId: user.id,
        questionBankId: question.id,
        questionText: question.text,
        answerText: String(question.correctIndex),
        reason: body.reason.trim(),
        status: "OPEN",
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Teacher or Admin access is required." }, { status: 403 });
    }
    console.error("[Question report API]", error);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const prisma = getPrisma();
    const reports = await prisma.answerReport.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        question: true,
      },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    console.error("[Question reports list API]", error);
    return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
  }
}
