import { NextResponse } from "next/server";
import { requireQuestionBankViewer, requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

function accessError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Teacher or Admin access is required." }, { status: 403 });
  }
  return null;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireQuestionBankViewer();

    const params = new URL(request.url).searchParams;
    const search = params.get("search")?.trim();
    const subject = params.get("subject")?.trim();
    const chapter = params.get("chapter")?.trim();
    const topic = params.get("topic")?.trim();
    const difficulty = params.get("difficulty")?.trim();
    const questionType = params.get("questionType")?.trim();
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = 25;

    const prisma = getPrisma();

    const where = {
      ...(subject ? { subject } : {}),
      ...(chapter ? { chapter } : {}),
      ...(topic ? { topic } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(questionType ? { questionType } : {}),
      ...(search
        ? {
            OR: [
              { text: { contains: search, mode: "insensitive" as const } },
              { topic: { contains: search, mode: "insensitive" as const } },
              { chapter: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, questions, subjects, chapters, topics] = await Promise.all([
      prisma.questionBank.count({ where }),
      prisma.questionBank.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.questionBank.findMany({ distinct: ["subject"], select: { subject: true } }),
      prisma.questionBank.findMany({
        distinct: ["chapter"],
        select: { chapter: true },
        where: { chapter: { not: null }, ...(subject ? { subject } : {}) },
      }),
      prisma.questionBank.findMany({
        distinct: ["topic"],
        select: { topic: true },
        where: { topic: { not: null }, ...(chapter ? { chapter } : {}) },
      }),
    ]);

    return NextResponse.json({
      questions,
      total,
      page,
      pageSize,
      filters: {
        subjects: subjects.map((s) => s.subject),
        chapters: chapters.map((c) => c.chapter).filter(Boolean),
        topics: topics.map((t) => t.topic).filter(Boolean),
      },
    });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin question bank API]", error);
    return NextResponse.json({ error: "Could not load question bank." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      id: string;
      text?: string;
      options?: string[];
      correctIndex?: number;
      explanation?: string;
      chapter?: string;
      topic?: string;
      difficulty?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Question id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const updated = await prisma.questionBank.update({
      where: { id: body.id },
      data: {
        ...(body.text !== undefined ? { text: body.text } : {}),
        ...(body.options !== undefined ? { options: body.options } : {}),
        ...(body.correctIndex !== undefined ? { correctIndex: body.correctIndex } : {}),
        ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
        ...(body.chapter !== undefined ? { chapter: body.chapter } : {}),
        ...(body.topic !== undefined ? { topic: body.topic } : {}),
        ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
      },
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin question bank edit API]", error);
    return NextResponse.json({ error: "Could not update question." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Question id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    await prisma.questionBank.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin question bank delete API]", error);
    return NextResponse.json({ error: "Could not delete question." }, { status: 500 });
  }
}
