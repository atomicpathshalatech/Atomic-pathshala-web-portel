import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to record your practice attempt." }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode || "PRACTICE";
    const userAnswers: Record<string, string> = body.answers || {}; // questionId -> selectedOption (e.g. "A", "B")
    const timeSpentSeconds = Number(body.timeSpentSeconds) || 0;

    // Same rule as opening it: published, or the user's own draft.
    const exercise = await prisma.exercise.findFirst({
      where: { id: params.id, OR: [{ status: "PUBLISHED" }, { createdById: session.user.id }] },
      include: {
        questions: {
          include: {
            question: {
              include: {
                translations: true,
              },
            },
          },
        },
      },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const defaultMarks = exercise.defaultMarks;
    const defaultNegativeMarks = exercise.defaultNegativeMarks;

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let totalScore = 0;
    const totalMarks = exercise.questions.length * defaultMarks;

    const answerRecords: {
      questionId: string;
      selectedOption: string | null;
      isCorrect: boolean;
      marksAwarded: number;
    }[] = [];

    for (const eq of exercise.questions) {
      const q = eq.question;
      const qMarks = eq.marks ?? defaultMarks;
      const qNegMarks = eq.negativeMarks ?? defaultNegativeMarks;
      const selected = userAnswers[q.id]?.trim();

      // Determine correct answers from question translations
      let correctOptionList: string[] = [];
      for (const t of q.translations) {
        if (t.correctOptionIds) {
          if (Array.isArray(t.correctOptionIds)) {
            correctOptionList = t.correctOptionIds.map((c) => String(c).trim().toUpperCase());
          } else if (typeof t.correctOptionIds === "string") {
            correctOptionList = [t.correctOptionIds.trim().toUpperCase()];
          }
          if (correctOptionList.length > 0) break;
        }
      }

      if (!selected) {
        unattemptedCount++;
        answerRecords.push({
          questionId: q.id,
          selectedOption: null,
          isCorrect: false,
          marksAwarded: 0,
        });
      } else {
        const isCorrect = correctOptionList.includes(selected.toUpperCase());
        if (isCorrect) {
          correctCount++;
          totalScore += qMarks;
          answerRecords.push({
            questionId: q.id,
            selectedOption: selected,
            isCorrect: true,
            marksAwarded: qMarks,
          });
        } else {
          incorrectCount++;
          totalScore -= qNegMarks;
          answerRecords.push({
            questionId: q.id,
            selectedOption: selected,
            isCorrect: false,
            marksAwarded: -qNegMarks,
          });
        }
      }
    }

    const attemptedTotal = correctCount + incorrectCount;
    const accuracy = attemptedTotal > 0 ? (correctCount / attemptedTotal) * 100 : 0;

    // Save attempt in database
    const attempt = await prisma.exerciseAttempt.create({
      data: {
        exerciseId: exercise.id,
        userId: session.user.id,
        mode,
        status: "COMPLETED",
        score: Math.max(0, totalScore),
        totalMarks,
        correctCount,
        incorrectCount,
        unattemptedCount,
        accuracy: Math.round(accuracy * 10) / 10,
        timeSpentSeconds,
        completedAt: new Date(),
        answers: {
          create: answerRecords.map((ar) => ({
            questionId: ar.questionId,
            selectedOption: ar.selectedOption,
            isCorrect: ar.isCorrect,
            marksAwarded: ar.marksAwarded,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    return apiSuccess({
      attemptId: attempt.id,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      unattemptedCount: attempt.unattemptedCount,
      accuracy: attempt.accuracy,
      timeSpentSeconds: attempt.timeSpentSeconds,
      answers: answerRecords,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
