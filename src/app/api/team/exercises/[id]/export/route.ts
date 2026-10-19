import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";
import { generateExercisePdf } from "@/lib/exercises/exercise-pdf";

// Headless Chrome prints the PDF.
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await request.json().catch(() => ({}));
    const exercise = await prisma.exercise.findUnique({
      where: { id: params.id },
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

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const languageMode = body.languageMode || exercise.languageMode || "BILINGUAL";
    const format = body.format || "FULL_WITH_SOLUTIONS";
    const instituteName = body.instituteName || "ATOMIC PATHSHALA";

    // Format data for PDF generator
    const pdfData = {
      title: exercise.title,
      subtitle: exercise.subtitle,
      exerciseCode: exercise.exerciseCode,
      subject: exercise.subject,
      chapter: exercise.chapter,
      instructions: exercise.instructions,
      defaultMarks: exercise.defaultMarks,
      defaultNegativeMarks: exercise.defaultNegativeMarks,
      sections: exercise.sections.map((s) => ({
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
    };

    // Generate the PDF
    const pdfBuffer = await generateExercisePdf(pdfData, {
      languageMode,
      format,
      instituteName,
    });

    // Record export event in DB
    await prisma.exerciseExport.create({
      data: {
        exerciseId: exercise.id,
        exportType: "PDF",
        language: languageMode,
        format,
        fileSize: pdfBuffer.length,
        createdById: session.user.id,
      },
    });

    const safeTitle = exercise.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeTitle}_${exercise.exerciseCode}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
