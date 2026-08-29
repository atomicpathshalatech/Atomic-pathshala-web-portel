import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { Difficulty } from "@prisma/client";

const DIFFICULTY_LEVELS: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/**
 * TODO(question-bank): Read-only search over published questions, for the
 * Test Engine's question-picker. Note: this project's existing Question
 * Bank module
 * (full CRUD, verification workflow) wasn't in the file set available when
 * this update was built, so its exact route path/shape couldn't be
 * confirmed — this is a deliberately minimal, additive read endpoint rather
 * than a guess at overwriting something that may already exist. If your
 * project already has a `/api/team/questions` (or similar) listing route,
 * point TestQuestionPicker.tsx at that instead and delete this file to
 * avoid running two near-identical endpoints.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const difficultyParam = request.nextUrl.searchParams.get("difficulty") ?? undefined;
    const difficulty = DIFFICULTY_LEVELS.find((d) => d === difficultyParam);

    const questions = await prisma.question.findMany({
      where: {
        isPublished: true,
        ...(difficulty && { difficulty }),
        ...(search && {
          translations: { some: { statement: { contains: search, mode: "insensitive" as const } } },
        }),
      },
      select: {
        id: true,
        type: true,
        difficulty: true,
        subject: true,
        translations: {
          where: { language: "ENGLISH" },
          select: { statement: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const results = questions.map((q) => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      subject: q.subject,
      statement: q.translations[0]?.statement ?? "",
    }));

    return apiSuccess({ questions: results });
  } catch (error) {
    return handleApiError(error);
  }
}
