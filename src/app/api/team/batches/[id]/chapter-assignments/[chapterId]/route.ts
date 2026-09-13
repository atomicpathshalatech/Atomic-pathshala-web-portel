import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Unassigns a chapter from this batch. Deletes only the BatchChapter
 * junction row — the Chapter itself (and every other batch's assignment
 * of it) is untouched. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    await prisma.batchChapter
      .delete({ where: { batchId_chapterId: { batchId: params.id, chapterId: params.chapterId } } })
      .catch(() => null); // already unassigned — treat as success, not an error

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_UNASSIGNED_FROM_BATCH",
          entityType: "BatchChapter",
          entityId: `${params.id}:${params.chapterId}`,
          metadata: { batchId: params.id, chapterId: params.chapterId },
        },
      })
      .catch(() => null);

    return apiSuccess({ unassigned: true });
  } catch (error) {
    return handleApiError(error);
  }
}
