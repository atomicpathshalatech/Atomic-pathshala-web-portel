import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    // Questions come with their answers (the practice page checks them as you go), so only signed-in users.
    if (!userId) return NextResponse.json({ error: "Please sign in to practise." }, { status: 401 });

    const exercise = await prisma.exercise.findFirst({
      where: {
        id: params.id,
        // Students can access published exercises or if admin/creator any exercise
        OR: [
          { status: "PUBLISHED" },
          { createdById: userId },
        ],
      },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { displayOrder: "asc" },
              include: {
                // Only what the practice page shows — not the question's internal fields.
                question: {
                  select: {
                    id: true,
                    questionCode: true,
                    subject: true,
                    chapter: true,
                    topic: true,
                    type: true,
                    difficulty: true,
                    pyqExam: true,
                    pyqYear: true,
                    pyqMonth: true,
                    solution: true,
                    translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found or not published" }, { status: 404 });
    }

    // Previous attempts by this user if logged in
    const previousAttempts = await prisma.exerciseAttempt.findMany({
      where: { exerciseId: params.id, userId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        _count: { select: { answers: true } },
      },
    });

    return apiSuccess({
      exercise,
      previousAttempts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
