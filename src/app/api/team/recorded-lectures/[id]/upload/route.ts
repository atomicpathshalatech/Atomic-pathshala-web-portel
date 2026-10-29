import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { uploadActionSchema } from "@/lib/recorded-lectures/schemas";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { resolveRecordedStorageConfig } from "@/lib/recorded-lectures/config";
import {
  RecordedStorageNotConfiguredError,
  abortMultipartUpload,
  completeMultipartUpload,
  headObject,
  listUploadedParts,
  recordedBucket,
  signSingleUpload,
  signUploadParts,
  startMultipartUpload,
} from "@/lib/recorded-lectures/storage";
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_TYPES,
  checkVideoDeclaration,
  partCountFor,
  partSizeFor,
  thumbnailObjectKey,
  videoObjectKey,
} from "@/lib/recorded-lectures/files";
import { verifyAndRecord } from "@/lib/recorded-lectures/verify";
import { loadRecordedLecture, serializeStaffLecture } from "@/lib/recorded-lectures/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Video upload to the recorded-lecture bucket, straight from the browser:
 * the server only authorises (short-lived signed URLs for each part); the
 * file never passes through or sits in server memory.
 *
 *   init      → opens a multipart upload (or resumes the open one for the same file)
 *   sign      → signed URLs for the next parts
 *   parts     → parts R2 already has (resume after a refresh / network drop)
 *   complete  → assembles the parts, verifies size + video signature → READY
 *   abort     → cancels; discards the incomplete parts
 *   thumbnail / thumbnail-done → optional thumbnail image
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError("Only Admin / Super Admin can upload recorded lectures.");
    const rate = await checkRateLimit(request, "LIVE_STREAM", `recorded-upload:${userId}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const resolved = resolveRecordedStorageConfig(process.env);
    if (!resolved.ok) throw new RecordedStorageNotConfiguredError(resolved.problems);
    const maxBytes = resolved.config.maxBytes;

    const body = uploadActionSchema.parse(await request.json());
    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, chapterId: true, chapter: { select: { subject: { select: { courseId: true } } } }, recordedMedia: true },
    });
    if (!lecture?.recordedMedia) return apiError("Recorded lecture not found.", 404);
    const media = lecture.recordedMedia;

    switch (body.action) {
      case "init": {
        if (media.uploadStatus === "READY") {
          return apiError("This lecture already has a verified video. Create a new lecture to upload a different recording.", 409, { code: "ALREADY_UPLOADED" });
        }
        if (media.uploadStatus === "VERIFYING") return apiError("The previous upload is being checked. Wait a moment and reload.", 409);
        const check = checkVideoDeclaration({ name: body.fileName, size: body.size, type: body.type }, maxBytes);
        if (!check.ok) return apiError(check.error, 400, { code: "INVALID_FILE" });

        // Same file again (refresh, retry): resume the upload already open.
        if (
          media.uploadStatus === "UPLOADING" &&
          media.multipartUploadId &&
          media.sizeBytes === BigInt(body.size) &&
          media.originalFileName === body.fileName &&
          media.partSizeBytes
        ) {
          const uploaded = await listUploadedParts({ key: media.objectKey, uploadId: media.multipartUploadId }).catch(() => null);
          if (uploaded) {
            return apiSuccess({
              resumed: true,
              partSize: media.partSizeBytes,
              partCount: partCountFor(body.size, media.partSizeBytes),
              uploadedParts: uploaded.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
            });
          }
        }
        // A different file replaces an unfinished upload: discard its parts first.
        if (media.multipartUploadId) {
          await abortMultipartUpload({ key: media.objectKey, uploadId: media.multipartUploadId }).catch(() => null);
        }
        // A file that was assembled but failed verification stays in the
        // bucket (never deleted here); its key is recorded before the record
        // moves on to the new upload, so it is never lost track of.
        if (media.uploadStatus === "FAILED" && !media.objectKey.startsWith("pending/")) {
          const stillThere = await headObject(media.objectKey).catch(() => null);
          if (stillThere) {
            await prisma.auditLog
              .create({
                data: {
                  userId,
                  action: "RECORDED_LECTURE_FAILED_OBJECT_KEPT",
                  entityType: "Lecture",
                  entityId: lecture.id,
                  metadata: { bucket: media.bucket, objectKey: media.objectKey, sizeBytes: stillThere.size, reason: media.uploadError },
                },
              })
              .catch(() => null);
          }
        }

        const key = videoObjectKey({
          courseId: lecture.chapter.subject.courseId,
          chapterId: lecture.chapterId,
          lectureId: lecture.id,
          uploadToken: randomUUID(),
          mimeType: check.mimeType,
        });
        const partSize = partSizeFor(body.size);
        const uploadId = await startMultipartUpload({ key, contentType: check.mimeType });
        await prisma.recordedLectureMedia.update({
          where: { lectureId: lecture.id },
          data: {
            bucket: recordedBucket(),
            objectKey: key,
            mimeType: check.mimeType,
            sizeBytes: BigInt(body.size),
            originalFileName: body.fileName,
            durationSec: body.durationSec ?? null,
            multipartUploadId: uploadId,
            partSizeBytes: partSize,
            uploadStatus: "UPLOADING",
            uploadError: null,
            uploadStartedAt: new Date(),
            verifiedAt: null,
            updatedById: userId,
          },
        });
        return apiSuccess({ resumed: false, partSize, partCount: partCountFor(body.size, partSize), uploadedParts: [] });
      }

      case "sign": {
        if (media.uploadStatus !== "UPLOADING" || !media.multipartUploadId || !media.partSizeBytes) {
          return apiError("No upload is open for this lecture. Start the upload again.", 409, { code: "NO_OPEN_UPLOAD" });
        }
        const partCount = partCountFor(Number(media.sizeBytes), media.partSizeBytes);
        if (body.partNumbers.some((n) => n > partCount)) return apiError("Part number out of range.", 400);
        const urls = await signUploadParts({ key: media.objectKey, uploadId: media.multipartUploadId, partNumbers: body.partNumbers });
        return apiSuccess({ urls, expiresInSeconds: 3600 });
      }

      case "parts": {
        if (media.uploadStatus !== "UPLOADING" || !media.multipartUploadId) return apiSuccess({ parts: [] });
        const parts = await listUploadedParts({ key: media.objectKey, uploadId: media.multipartUploadId });
        return apiSuccess({ parts: parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })) });
      }

      case "complete": {
        if (media.uploadStatus === "READY") {
          const full = await loadRecordedLecture(lecture.id);
          return apiSuccess({ verified: true, lecture: full ? serializeStaffLecture(full) : null });
        }
        if (media.uploadStatus !== "UPLOADING" || !media.multipartUploadId || !media.partSizeBytes) {
          return apiError("No upload is open for this lecture.", 409, { code: "NO_OPEN_UPLOAD" });
        }
        const partCount = partCountFor(Number(media.sizeBytes), media.partSizeBytes);
        const parts = Array.from(new Map(body.parts.map((p) => [p.partNumber, p])).values()).sort((a, b) => a.partNumber - b.partNumber);
        if (parts.length !== partCount || parts.some((p, i) => p.partNumber !== i + 1)) {
          return apiError(`All ${partCount} parts must be uploaded before finishing (have ${parts.length}).`, 400, { code: "PARTS_MISSING" });
        }
        // Only one "complete" proceeds; a concurrent retry sees VERIFYING.
        const claimed = await prisma.recordedLectureMedia.updateMany({
          where: { lectureId: lecture.id, uploadStatus: "UPLOADING", multipartUploadId: media.multipartUploadId },
          data: { uploadStatus: "VERIFYING" },
        });
        if (claimed.count === 0) return apiError("This upload is already being finished.", 409);
        try {
          await completeMultipartUpload({ key: media.objectKey, uploadId: media.multipartUploadId, parts });
        } catch (err) {
          // An earlier "complete" may have assembled it already (its response was lost).
          const exists = await headObject(media.objectKey).catch(() => null);
          if (!exists) {
            await prisma.recordedLectureMedia.update({
              where: { lectureId: lecture.id },
              data: { uploadStatus: "UPLOADING", uploadError: `Finishing the upload failed: ${String((err as Error)?.message ?? err).slice(0, 200)}` },
            });
            return apiError("Finishing the upload failed. Try Finish again — the uploaded parts are kept.", 502, { code: "COMPLETE_FAILED" });
          }
        }
        const verified = await verifyAndRecord(lecture.id);
        const full = await loadRecordedLecture(lecture.id);
        if (!verified.ok) return apiError(verified.error, 422, { code: "VERIFY_FAILED" });
        await prisma.auditLog
          .create({ data: { userId, action: "RECORDED_LECTURE_UPLOADED", entityType: "Lecture", entityId: lecture.id, metadata: { sizeBytes: Number(media.sizeBytes) } } })
          .catch(() => null);
        return apiSuccess({ verified: true, lecture: full ? serializeStaffLecture(full) : null });
      }

      case "abort": {
        if (media.multipartUploadId) {
          await abortMultipartUpload({ key: media.objectKey, uploadId: media.multipartUploadId }).catch(() => null);
        }
        if (media.uploadStatus !== "READY") {
          await prisma.recordedLectureMedia.update({
            where: { lectureId: lecture.id },
            data: { uploadStatus: "ABORTED", multipartUploadId: null, uploadError: "Upload cancelled." },
          });
        }
        return apiSuccess({ aborted: true });
      }

      case "thumbnail": {
        if (!THUMBNAIL_TYPES.includes(body.type)) return apiError("The thumbnail must be a JPG, PNG or WebP image.", 400);
        if (body.size > MAX_THUMBNAIL_BYTES) return apiError("The thumbnail must be under 5 MB.", 400);
        const key = thumbnailObjectKey(lecture.id, randomUUID(), body.type);
        return apiSuccess({ key, url: await signSingleUpload({ key, contentType: body.type }) });
      }

      case "thumbnail-done": {
        if (!body.key.startsWith(`thumbnails/${lecture.id}/`)) return apiError("Invalid thumbnail.", 400);
        const head = await headObject(body.key);
        if (!head || head.size === 0 || head.size > MAX_THUMBNAIL_BYTES) return apiError("The thumbnail upload did not finish.", 409);
        await prisma.recordedLectureMedia.update({ where: { lectureId: lecture.id }, data: { thumbnailKey: body.key, updatedById: userId } });
        return apiSuccess({ ok: true });
      }
    }
  } catch (error) {
    return recordedApiError(error);
  }
}
