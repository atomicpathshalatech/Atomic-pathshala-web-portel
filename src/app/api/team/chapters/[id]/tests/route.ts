import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { LanguageMode, TestStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const tests = await prisma.test.findMany({
      where: { chapterId: params.id },
      include: {
        _count: { select: { sections: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ tests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_CREATE);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: { include: { course: true } } },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const body = await request.json();
    const {
      name,
      durationMin,
      correctMarks,
      incorrectMarks,
      examType,
      instructions,
      languageMode,
    } = body;

    if (!name?.trim()) {
      return apiError("Test Name is required", 400);
    }

    // Unique test code
    const count = await prisma.test.count();
    const code = `TEST_${String(count + 1).padStart(4, "0")}`;

    const test = await prisma.test.create({
      data: {
        chapterId: chapter.id,
        name: name.trim(),
        code,
        durationMin: typeof durationMin === "number" ? durationMin : 60,
        correctMarks: typeof correctMarks === "number" ? correctMarks : 4,
        incorrectMarks: typeof incorrectMarks === "number" ? incorrectMarks : -1,
        examType: examType || chapter.subject.course?.title || "NEET",
        instructions: instructions?.trim() || null,
        languageMode: languageMode && Object.values(LanguageMode).includes(languageMode) ? languageMode : LanguageMode.BOTH,
        status: TestStatus.PUBLISHED,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: { chapterId: chapter.id, name: test.name },
      },
    });

    return apiSuccess({ test }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}