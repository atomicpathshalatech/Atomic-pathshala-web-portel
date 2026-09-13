import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

/**
 * Explicit chapter->batch assignment (the durable BatchChapter row) — the
 * fix for the cross-batch content leakage bug: before this, a Chapter had
 * no batch scoping at all, only reachable via Subject->Course, so any
 * batch sharing that course saw every chapter under it. See the
 * BatchChapter model doc comment in prisma/schema.prisma.
 */

const assignSchema = z.object({ chapterId: z.string().min(1) });

/** Lists both the chapters currently assigned to this batch AND the
 * remaining chapters (under the batch's own course) still available to
 * assign — everything an assignment UI needs in one call. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id }, select: { id: true, courseId: true } });
    if (!batch) return apiError("Batch not found", 404);

    const assigned = await prisma.batchChapter.findMany({
      where: { batchId: params.id },
      select: {
        chapterId: true,
        assignedAt: true,
        chapter: { select: { id: true, title: true, status: true, subject: { select: { id: true, title: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });

    const availableChapters = batch.courseId
      ? await prisma.chapter.findMany({
          where: {
            subject: { courseId: batch.courseId },
            id: { notIn: assigned.map((a) => a.chapterId) },
          },
          select: { id: true, title: true, status: true, subject: { select: { id: true, title: true } } },
          orderBy: [{ subject: { title: "asc" } }, { order: "asc" }],
        })
      : [];

    return apiSuccess({ assigned, availableChapters });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Assigns a chapter to this batch. Idempotent — assigning an already-
 * assigned chapter is a no-op, not an error, so a retry/double-click never
 * fails. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const { chapterId } = assignSchema.parse(await request.json());

    const [batch, chapter] = await Promise.all([
      prisma.batch.findUnique({ where: { id: params.id }, select: { id: true } }),
      prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }),
    ]);
    if (!batch) return apiError("Batch not found", 404);
    if (!chapter) return apiError("Chapter not found", 404);

    const assignment = await prisma.batchChapter.upsert({
      where: { batchId_chapterId: { batchId: params.id, chapterId } },
      update: {},
      create: { batchId: params.id, chapterId, assignedById: session.user.id },
    });

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_ASSIGNED_TO_BATCH",
          entityType: "BatchChapter",
          entityId: assignment.id,
          metadata: { batchId: params.id, chapterId },
        },
      })
      .catch(() => null);

    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
