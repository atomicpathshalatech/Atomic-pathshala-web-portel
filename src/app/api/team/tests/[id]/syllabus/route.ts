import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * A test's syllabus (the chapters / topics it covers), editable after the
 * test was created. Only the syllabus is touched — never the questions,
 * schedule or sections. The syllabus PDF (/api/tests/:id/syllabus-pdf) is
 * built from this on every open, so every batch that shows it gets the new
 * syllabus without anything else to update.
 *
 * Same shape the test-create form saves: { chapters: [{ id, subject,
 * chapterTitle, isComplete, topics, customTopics }] }.
 */
const text = (max: number) => z.string().trim().min(1).max(max);
const chapterSchema = z.object({
  id: text(120),
  subject: text(80),
  chapterTitle: text(300),
  isComplete: z.boolean(),
  topics: z.array(text(300)).max(300).default([]),
  customTopics: z.array(text(300)).max(300).default([]),
});
const syllabusSchema = z.object({ chapters: z.array(chapterSchema).max(400) });

function readChapters(raw: unknown): unknown[] {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray((value as { chapters?: unknown }).chapters)) {
      return (value as { chapters: unknown[] }).chapters;
    }
  } catch {
    // unreadable → treated as no syllabus
  }
  return [];
}

async function authorize(testId: string, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, permission);
  const test = await getTestOr404(testId);
  if (!test) return { userId: session.user.id, test: null };
  if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
  return { userId: session.user.id, test };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { test } = await authorize(params.id, PERMISSIONS.TEST_UPDATE);
    if (!test) return apiError("Test not found", 404);
    const row = await prisma.test.findUnique({ where: { id: params.id }, select: { id: true, name: true, syllabus: true } });
    return apiSuccess({ testId: params.id, name: row?.name ?? "", chapters: readChapters(row?.syllabus) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, test } = await authorize(params.id, PERMISSIONS.TEST_UPDATE);
    if (!test) return apiError("Test not found", 404);

    const input = syllabusSchema.parse(await request.json());
    // A complete chapter stores no topic list (the create form does the same).
    const chapters = input.chapters.map((c) => ({ ...c, topics: c.isComplete ? [] : c.topics }));

    await prisma.test.update({ where: { id: params.id }, data: { syllabus: { chapters } } });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "TEST_SYLLABUS_UPDATED",
        entityType: "Test",
        entityId: params.id,
        metadata: { chapters: chapters.length, subjects: Array.from(new Set(chapters.map((c) => c.subject))) },
      },
    });

    return apiSuccess({ testId: params.id, chapters, message: "Syllabus updated" });
  } catch (error) {
    return handleApiError(error);
  }
}
