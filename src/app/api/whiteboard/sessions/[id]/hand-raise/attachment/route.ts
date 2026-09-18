import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — a notebook/textbook photo can be bigger than a profile photo
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Same AuditLog-backed abuse guard as the general doubt-attachment uploader.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

/**
 * Uploads a single image for a live-class doubt (a photo of the student's
 * notebook/textbook page) and returns its public URL. Does NOT create or
 * touch a HandRaiseEvent row — the student's hand-raise submission includes
 * this URL as `imageUrl` in its normal POST to .../hand-raise. Student-only.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const recentUploads = await prisma.auditLog.count({
      where: {
        userId: session.user.id,
        action: "HAND_RAISE_DOUBT_IMAGE_UPLOADED",
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentUploads >= RATE_LIMIT_MAX) {
      return apiError("Too many doubt photos uploaded recently — please try again in a bit.", 429);
    }

    const form = await request.formData();
    const file = form.get("attachment");
    if (!(file instanceof File)) return apiError("No image was uploaded.", 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (file.size > MAX_BYTES) return apiError("Image is too large — please keep it under 5MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `hand-raise-doubts/${params.id}-${access.entityId}-${Date.now()}.${extension}`;
    const url = await uploadFile({ key, body: buffer, contentType: file.type });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HAND_RAISE_DOUBT_IMAGE_UPLOADED",
        entityType: "HandRaiseEvent",
      },
    });

    return apiSuccess({ url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
