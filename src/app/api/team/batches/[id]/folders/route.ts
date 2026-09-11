import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { ROOT_FOLDER_NAME, MAX_FOLDER_DEPTH, buildFolderTree } from "@/lib/batch/folders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The batch's material tree, for staff.
 *
 * The "Syllabus & Schedule" root is provisioned lazily on first read rather
 * than at batch-creation time: batches created before this feature existed
 * need it too, and a data migration that invents a folder for every historic
 * batch would create clutter for batches nobody ever opens.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_READ);

    const batch = await prisma.batch.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!batch) return apiError("Batch not found", 404);

    const canManage = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    let folders = await prisma.batchFolder.findMany({
      where: { batchId: params.id },
      include: { files: { orderBy: [{ order: "asc" }, { createdAt: "desc" }] } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    if (folders.length === 0 && canManage) {
      await prisma.batchFolder.create({
        data: {
          batchId: params.id,
          name: ROOT_FOLDER_NAME,
          createdById: session.user.id,
        },
      });
      folders = await prisma.batchFolder.findMany({
        where: { batchId: params.id },
        include: { files: { orderBy: [{ order: "asc" }, { createdAt: "desc" }] } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    }

    return apiSuccess({ tree: buildFolderTree(folders), canManage });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required").max(120),
  parentId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const { name, parentId } = createSchema.parse(await request.json());

    const batch = await prisma.batch.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!batch) return apiError("Batch not found", 404);

    if (parentId) {
      // Walk up to the root to both prove the parent belongs to this batch
      // (a folder id from another batch must not be usable here) and measure
      // depth. The tree is shallow by design, so this is a handful of reads.
      let cursor = await prisma.batchFolder.findUnique({
        where: { id: parentId },
        select: { id: true, batchId: true, parentId: true },
      });
      if (!cursor || cursor.batchId !== params.id) {
        return apiError("Parent folder not found in this batch.", 404);
      }

      let depth = 1;
      while (cursor?.parentId) {
        depth += 1;
        if (depth >= MAX_FOLDER_DEPTH) {
          return apiError(
            `Folders can be nested up to ${MAX_FOLDER_DEPTH} levels deep. Move some files up instead.`,
            409
          );
        }
        cursor = await prisma.batchFolder.findUnique({
          where: { id: cursor.parentId },
          select: { id: true, batchId: true, parentId: true },
        });
      }
    }

    const siblingCount = await prisma.batchFolder.count({
      where: { batchId: params.id, parentId: parentId ?? null },
    });

    const folder = await prisma.batchFolder.create({
      data: {
        batchId: params.id,
        parentId: parentId ?? null,
        name,
        order: siblingCount,
        createdById: session.user.id,
      },
    });

    return apiSuccess({ folder });
  } catch (error) {
    return handleApiError(error);
  }
}
