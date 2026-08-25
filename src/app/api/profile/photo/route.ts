import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, deleteFile, keyFromPublicUrl, StorageNotConfiguredError } from "@/lib/storage";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Abuse guard: a signed-in account could otherwise script repeated uploads
// to run up storage-provider costs. Backed by AuditLog (already used for
// every other "who did what when" record in this project) rather than a
// new in-memory/Redis limiter, so it holds up across server restarts and
// multiple server instances alike.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

/**
 * Self-service profile photo — any signed-in user can only ever replace
 * their OWN photo (no id in the URL/body to spoof; always session.user.id).
 * Built for the student Settings page, but deliberately not student-only:
 * User.photoUrl is a shared field, so this works for the team portal too
 * whenever a photo uploader is added there.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const recentUploads = await prisma.auditLog.count({
      where: {
        userId: session.user.id,
        action: "PROFILE_PHOTO_UPDATED",
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentUploads >= RATE_LIMIT_MAX) {
      return apiError("Too many photo changes recently — please try again in a bit.", 429);
    }

    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return apiError("No photo was uploaded.", 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (file.size > MAX_BYTES) return apiError("Image is too large — please keep it under 3MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `profile-photos/${session.user.id}-${Date.now()}.${extension}`;
    const photoUrl = await uploadFile({ key, body: buffer, contentType: file.type });

    const previous = await prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } });

    await prisma.user.update({ where: { id: session.user.id }, data: { photoUrl } });

    if (previous?.photoUrl) {
      const oldKey = keyFromPublicUrl(previous.photoUrl);
      if (oldKey) deleteFile(oldKey).catch(() => undefined);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PROFILE_PHOTO_UPDATED",
        entityType: "User",
        entityId: session.user.id,
      },
    });

    return apiSuccess({ photoUrl });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } });

    await prisma.user.update({ where: { id: session.user.id }, data: { photoUrl: null } });

    if (user?.photoUrl) {
      const oldKey = keyFromPublicUrl(user.photoUrl);
      if (oldKey) deleteFile(oldKey).catch(() => undefined);
    }

    return apiSuccess({ photoUrl: null });
  } catch (error) {
    return handleApiError(error);
  }
}
