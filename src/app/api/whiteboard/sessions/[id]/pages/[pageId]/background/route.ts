import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushBoardUpdated } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, deleteFile, keyFromPublicUrl, StorageNotConfiguredError } from "@/lib/storage";

// Slide backgrounds are typically full photos/scans, so a slightly higher
// cap than a profile photo (3MB) or doubt attachment (5MB) isn't out of
// line — still well short of anything that would make autosave/board-mirror
// payloads unreasonable, since the background is a URL, not inline data.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// A teacher swapping backgrounds a few times through one class is normal
// usage (per-slide images, not just once) — higher ceiling than the
// profile-photo limiter, same AuditLog-backed pattern.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

/**
 * Teacher-only. Uploads an image and sets it as this page's background —
 * reuses the same src/lib/storage abstraction as profile photos and doubt
 * attachments (S3-compatible; works against either Cloudflare R2 or
 * Supabase Storage depending on what's filled into .env). Kept separate
 * from the stroke-autosave PATCH one level up so a background swap doesn't
 * require resending the full (possibly large) objects array.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const recentUploads = await prisma.auditLog.count({
      where: {
        userId: session.user.id,
        action: "WHITEBOARD_BACKGROUND_UPLOADED",
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentUploads >= RATE_LIMIT_MAX) {
      return apiError("Too many background changes recently — please try again in a bit.", 429);
    }

    const page = await prisma.whiteboardPage.findFirst({
      where: { id: params.pageId, sessionId: params.id },
    });
    if (!page) return apiError("Page not found", 404);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("No image was uploaded.", 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (file.size > MAX_BYTES) return apiError("Image is too large — please keep it under 5MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `whiteboard-backgrounds/${params.pageId}-${Date.now()}.${extension}`;
    const background = await uploadFile({ key, body: buffer, contentType: file.type });

    const updated = await prisma.whiteboardPage.update({
      where: { id: params.pageId },
      data: { background },
    });

    const previousKey = keyFromPublicUrl(page.background);
    if (previousKey) deleteFile(previousKey).catch(() => undefined);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_BACKGROUND_UPLOADED",
        entityType: "WhiteboardPage",
        entityId: params.pageId,
      },
    });

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { activePageNumber: true },
    });
    if (wbSession && wbSession.activePageNumber === updated.pageNumber) {
      await pushBoardUpdated(params.id, updated.pageNumber);
    }

    return apiSuccess({ page: updated });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
