import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";
import { generateChapterModulePdf } from "@/lib/exercises/exercise-pdf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await request.json().catch(() => ({}));
    const subject = body.subject?.trim();
    const chapter = body.chapter?.trim();

    if (!subject || !chapter) {
      return NextResponse.json({ error: "Both subject and chapter are required" }, { status: 400 });
    }

    const exercises = await prisma.exercise.findMany({
      where: {
        subject: { equals: subject, mode: "insensitive" },
        chapter: { equals: chapter, mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { displayOrder: "asc" },
              include: {
                question: {
                  include: {
                    translations: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (exercises.length === 0) {
      return NextResponse.json({ error: "No exercises found for this chapter" }, { status: 404 });
    }

    const languageMode = body.languageMode || "BILINGUAL";
    const format = body.format || "FULL_WITH_SOLUTIONS";
    const instituteName = body.instituteName || "ATOMIC PATHSHALA";

    const moduleData = {
      subject,
      chapter,
      exercises: exercises.map((ex) => ({
        title: ex.title,
        subtitle: ex.subtitle,
        exerciseCode: ex.exerciseCode,
        subject: ex.subject,
        chapter: ex.chapter,
        instructions: ex.instructions,
        defaultMarks: ex.defaultMarks,
        defaultNegativeMarks: ex.defaultNegativeMarks,
        sections: ex.sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          topic: s.topic,
          questions: s.questions.map((q) => ({
            id: q.id,
            displayOrder: q.displayOrder,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            question: {
              id: q.question.id,
              questionCode: q.question.questionCode,
              subject: q.question.subject,
              chapter: q.question.chapter,
              topic: q.question.topic,
              subTopic: q.question.subTopic,
              type: q.question.type,
              difficulty: q.question.difficulty,
              pyqExam: q.question.pyqExam,
              pyqYear: q.question.pyqYear,
              pyqMonth: q.question.pyqMonth,
              pyqQuestionNumber: q.question.pyqQuestionNumber,
              solution: q.question.solution,
              translations: q.question.translations.map((t) => ({
                language: t.language,
                statement: t.statement,
                options: t.options,
                correctOptionIds: t.correctOptionIds,
                solution: t.solution,
              })),
            },
          })),
        })),
      })),
    };

    const pdfBuffer = await generateChapterModulePdf(moduleData, {
      languageMode,
      format,
      instituteName,
    });

    const safeFilename = `${subject.toLowerCase()}-${chapter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-module.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
