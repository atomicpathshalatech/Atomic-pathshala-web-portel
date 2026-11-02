import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, deleteFile, keyFromPublicUrl, StorageNotConfiguredError } from "@/lib/storage";
import { photoProblem, sniffImage } from "@/lib/id-card/image-sniff";

/** Full decode with the server image library — catches truncated / corrupt files a header check can't. */
async function decodes(buffer: Buffer): Promise<boolean> {
  let loadImage: typeof import("@napi-rs/canvas").loadImage;
  try {
    ({ loadImage } = await import("@napi-rs/canvas"));
  } catch {
    return true; // decoder unavailable on this host — the signature + size checks above still ran
  }
  try {
    const img = await loadImage(buffer);
    return img.width > 0 && img.height > 0;
  } catch {
    return false;
  }
}

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

    const buffer = Buffer.from(await file.arrayBuffer());
    // The real type and size come from the bytes, not the browser-sent MIME type.
    const sniffed = sniffImage(buffer);
    const problem = photoProblem(sniffed, buffer.length);
    if (problem) return apiError(problem, 400);
    if (sniffed!.type !== file.type) return apiError("The file type does not match its contents. Please upload a real JPG, PNG or WEBP photo.", 400);
    if (!(await decodes(buffer))) return apiError("This image could not be read. Please try another photo.", 400);

    // A new key per upload, so the new photo shows at once instead of a cached old one.
    const key = `profile-images/${session.user.id}/avatar-${Date.now()}.${extension}`;
    const photoUrl = await uploadFile({ key, body: buffer, contentType: file.type });

    const previous = await prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } });

    await prisma.user.update({ where: { id: session.user.id }, data: { photoUrl } });

    // Index in FileAsset table
    await prisma.fileAsset.upsert({
      where: { storageKey: key },
      update: {
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: BigInt(file.size),
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
      create: {
        ownerId: session.user.id,
        fileType: "PROFILE_IMAGE",
        storageProvider: "r2",
        bucket: process.env.R2_BUCKET_NAME || "atomic-pathshala",
        storageKey: key,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: BigInt(file.size),
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
    }).catch(() => null);

    if (previous?.photoUrl && previous.photoUrl !== photoUrl) {
      const oldKey = keyFromPublicUrl(previous.photoUrl);
      if (oldKey && oldKey !== key) {
        deleteFile(oldKey).catch(() => undefined);
        prisma.fileAsset.updateMany({ where: { storageKey: oldKey }, data: { status: "DELETED" } }).catch(() => undefined);
      }
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
