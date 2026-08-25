import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — a notebook/textbook photo can be bigger than a profile photo
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Same AuditLog-backed abuse guard as the profile photo uploader.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

/**
 * Uploads a single image for a doubt (a photo of the student's notebook/
 * textbook page, a question screenshot, etc.) and returns its public URL.
 * This does NOT create or touch a Doubt row — DoubtForm calls this first to
 * get a URL, then includes that URL as `attachmentUrl` in its normal POST
 * to /api/doubts. Student-only, since only students submit doubts.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const recentUploads = await prisma.auditLog.count({
      where: {
        userId: session.user.id,
        action: "DOUBT_ATTACHMENT_UPLOADED",
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentUploads >= RATE_LIMIT_MAX) {
      return apiError("Too many attachments uploaded recently — please try again in a bit.", 429);
    }

    const form = await request.formData();
    const file = form.get("attachment");
    if (!(file instanceof File)) return apiError("No image was uploaded.", 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (file.size > MAX_BYTES) return apiError("Image is too large — please keep it under 5MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `doubt-attachments/${student.id}-${Date.now()}.${extension}`;
    const url = await uploadFile({ key, body: buffer, contentType: file.type });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DOUBT_ATTACHMENT_UPLOADED",
        entityType: "Doubt",
      },
    });

    return apiSuccess({ url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
