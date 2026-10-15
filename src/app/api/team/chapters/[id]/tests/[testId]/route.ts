import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteTestCascading } from "@/lib/team/resource-delete";
import { assertChapterAccess } from "@/lib/chapters/access";
import { isTestEditable, publishTestNow, testStartedReason } from "@/lib/tests/scheduled-publish";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; testId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE || PERMISSIONS.CHAPTER_UPDATE);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

    const test = await prisma.test.findUnique({
      where: { id: params.testId },
    });
    if (!test || test.chapterId !== params.id) return apiError("Test not found", 404);

    const body = await request.json();
    const { name, durationMin, correctMarks, incorrectMarks, instructions, status, examType, openTime: openTimeRaw } = body;

    // "Publish now" goes through the same checks as every publish (questions
    // in every section…). No other status can be set from here.
    if (status !== undefined) {
      if (status !== "PUBLISHED") return apiError("Only publishing is possible here.", 400);
      const result = await publishTestNow(test.id, session.user.id);
      if (!result.ok) return apiError(result.error, result.status);
      const published = await prisma.test.findUnique({ where: { id: test.id } });
      return apiSuccess({ test: published });
    }

    // Name, time and marks: only before the test starts (and before anyone took it).
    const started = await testStartedReason(test);
    if (started) return apiError(started, 409);

    let openTime: Date | undefined;
    if (openTimeRaw !== undefined) {
      if (!isTestEditable(test)) return apiError("This test is already published — its time can't be changed here.", 409);
      openTime = new Date(String(openTimeRaw));
      if (Number.isNaN(openTime.getTime())) return apiError("Choose the date and time of the test.", 400);
      if (openTime.getTime() < Date.now() - 60_000) return apiError("The test time is in the past — choose a later time.", 400);
    }

    const updated = await prisma.test.update({
      where: { id: params.testId },
      data: {
        ...(openTime && { openTime }),
        ...(name !== undefined && { name: name.trim() }),
        ...(durationMin !== undefined && { durationMin: Number(durationMin) }),
        ...(correctMarks !== undefined && { correctMarks: Number(correctMarks) }),
        ...(incorrectMarks !== undefined && { incorrectMarks: Number(incorrectMarks) }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(examType !== undefined && { examType }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_UPDATED",
        entityType: "Test",
        entityId: updated.id,
        metadata: { chapterId: params.id, name: updated.name, ...(openTime && { openTime: openTime.toISOString() }) },
      },
    });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; testId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_DELETE || PERMISSIONS.CHAPTER_UPDATE);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

    // deleteTestCascading explicitly removes this test's Attempt rows (and
    // everything that cascades from them) inside a transaction before
    // deleting the Test itself, and writes its own TEST_DELETED audit log
    // — it never silently no-ops on a foreign-key conflict the way the raw
    // prisma.test.delete() used to here.
    const result = await deleteTestCascading(params.testId, session.user.id);
    if (!result) return apiError("Test not found", 404);

    return apiSuccess({ deleted: true, attemptsDeleted: result.attemptsDeleted });
  } catch (error) {
    return handleApiError(error);
  }
}
