import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { LanguageMode, TestStatus } from "@prisma/client";
import { assertChapterAccess } from "@/lib/chapters/access";
import { publishDueTests } from "@/lib/tests/scheduled-publish";
import { defaultChapterTestQuestionCount, parseQuestionCount, setChapterTestSection } from "@/lib/tests/chapter-test";
import { assignChapterToBatches, chapterBatchIds } from "@/lib/tests/chapter-test-batches";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "read");
    await publishDueTests({ chapterId: params.id });

    const tests = await prisma.test.findMany({
      where: { chapterId: params.id },
      include: {
        _count: { select: { sections: true, attempts: true } },
        sections: { select: { targetCount: true } },
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
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

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
      openTime: openTimeRaw,
      questionCount: questionCountRaw,
      batchIds,
    } = body;

    if (!name?.trim()) {
      return apiError("Test Name is required", 400);
    }

    // The time the test is held. Until then it stays a draft — questions can
    // be added and corrected, students see it as Upcoming — and at that time
    // it publishes itself (src/lib/tests/scheduled-publish.ts).
    const openTime = typeof openTimeRaw === "string" && openTimeRaw ? new Date(openTimeRaw) : null;
    if (!openTime || Number.isNaN(openTime.getTime())) {
      return apiError("Choose the date and time of the test.", 400);
    }
    if (openTime.getTime() < Date.now() - 60_000) {
      return apiError("The test time is in the past — choose a later time.", 400);
    }
    // How many questions: chosen by the team (default 90 for Biology, 45 otherwise).
    const questionCount =
      questionCountRaw === undefined || questionCountRaw === null || questionCountRaw === ""
        ? defaultChapterTestQuestionCount(chapter.subject.title)
        : parseQuestionCount(questionCountRaw);
    if (questionCount === null) return apiError("Number of questions must be a whole number from 1 to 200.", 400);

    // The batches whose students get this test (assigns the chapter to them).
    if (batchIds !== undefined) {
      const assigned = await assignChapterToBatches(session.user.id, chapter.id, batchIds);
      if (!assigned.ok) return apiError(assigned.error, assigned.status);
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
        openTime,
        status: TestStatus.DRAFT,
        createdById: session.user.id,
      },
    });

    // One section: this chapter's subject, with the chosen number of questions.
    await setChapterTestSection(test.id, {
      subjectTitle: chapter.subject.title,
      questionCount,
      marksPerQuestion: test.correctMarks,
      negativeMarks: test.incorrectMarks,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: { chapterId: chapter.id, name: test.name, openTime: openTime.toISOString(), questionCount },
      },
    });

    const reachedBatches = await chapterBatchIds(chapter.id);
    return apiSuccess(
      {
        test,
        batchIds: reachedBatches,
        ...(reachedBatches.length === 0 && {
          warning: "This chapter is in no batch yet, so no student sees this test in a schedule. Choose its batch (someone who manages batches can).",
        }),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}