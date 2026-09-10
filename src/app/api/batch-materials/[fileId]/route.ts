import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves one batch material file.
 *
 * Access is decided per request rather than by making the asset public: a
 * syllabus belongs to the batch that paid for it. Staff with BATCH_READ get
 * through; a student needs an ACTIVE enrolment in that batch, and only sees
 * files whose folder chain is published.
 *
 * Responds with a redirect to a short-lived presigned URL, so the file never
 * streams through the Next.js server.
 */
async function loadAccessibleFile(fileId: string, userId: string) {
  const file = await prisma.batchFolderFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileAssetId: true,
      title: true,
      fileName: true,
      isPublished: true,
      folder: { select: { id: true, batchId: true, isPublished: true, parentId: true } },
    },
  });
  if (!file) return { error: apiError("File not found.", 404) as const };

  const isStaff = await hasPermission(userId, PERMISSIONS.BATCH_READ);
  if (isStaff) return { file };

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) return { error: apiError("Not allowed.", 403) as const };

  const enrolled = await prisma.batchEnrollment.count({
    where: { studentId: student.id, batchId: file.folder.batchId, status: "ACTIVE" },
  });
  if (enrolled === 0) return { error: apiError("Enrol in this batch to open its material.", 403) as const };

  if (!file.isPublished) return { error: apiError("File not found.", 404) as const };

  // A published file inside an unpublished folder must stay hidden, so the
  // whole chain up to the root is checked — the same rule the tree endpoint
  // applies when it prunes branches.
  let folder: { id: string; isPublished: boolean; parentId: string | null } | null = file.folder;
  while (folder) {
    if (!folder.isPublished) return { error: apiError("File not found.", 404) as const };
    if (!folder.parentId) break;
    folder = await prisma.batchFolder.findUnique({
      where: { id: folder.parentId },
      select: { id: true, isPublished: true, parentId: true },
    });
  }

  return { file };
}

export async function GET(request: NextRequest, { params }: { params: { fileId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please sign in to open this file.", 401);

    const result = await loadAccessibleFile(params.fileId, session.user.id);
    if ("error" in result) return result.error;
    const { file } = result;

    const asset = await prisma.fileAsset.findUnique({
      where: { id: file.fileAssetId },
      select: { storageKey: true, originalFilename: true, status: true },
    });
    if (!asset || asset.status !== "ACTIVE") return apiError("File is unavailable.", 410);

    // Students are allowed to download these outright — this material is the
    // syllabus/schedule, meant to be kept.
    const wantsInline = request.nextUrl.searchParams.get("inline") === "1";
    const filename = (file.fileName || asset.originalFilename || "material.pdf").replace(/"/g, "");
    const disposition = `${wantsInline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`;

    const url = await createPresignedDownloadUrl({
      key: asset.storageKey,
      expiresInSeconds: 600,
      contentDisposition: disposition,
    });

    return NextResponse.redirect(url, 302);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Removes the listing. The underlying upload is left in place. */
export async function DELETE(_request: NextRequest, { params }: { params: { fileId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canManage = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
    if (!canManage) return apiError("Not allowed.", 403);

    const file = await prisma.batchFolderFile.findUnique({
      where: { id: params.fileId },
      select: { id: true },
    });
    if (!file) return apiError("File not found.", 404);

    await prisma.batchFolderFile.delete({ where: { id: file.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
