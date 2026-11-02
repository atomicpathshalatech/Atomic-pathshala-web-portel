import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { getR2Client, getR2Credentials } from "@/lib/storage/r2-client";

export const dynamic = "force-dynamic";

/**
 * The class recording from the Atomic Pathshala Teacher app: the encoder
 * keeps a copy of the class while streaming, and after the class the app
 * uploads it here in parts (R2 multipart; resumable). On "complete" the
 * class gets it as its recording (recordingStorageKey, READY) — students'
 * "Play Class" then plays it in Atomic's own player, not YouTube.
 *
 *   {action:"init"}                              → { key, uploadId }
 *   {action:"part", key, uploadId, partNumber}   → { url }  (PUT the bytes, keep the ETag)
 *   {action:"complete", key, uploadId, parts, durationSeconds}
 *   {action:"abort", key, uploadId}
 */
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("init") }),
  z.object({ action: z.literal("part"), key: z.string().min(1), uploadId: z.string().min(1), partNumber: z.number().int().min(1).max(10000) }),
  z.object({
    action: z.literal("complete"),
    key: z.string().min(1),
    uploadId: z.string().min(1),
    parts: z.array(z.object({ PartNumber: z.number().int().min(1), ETag: z.string().min(1) })).min(1).max(10000),
    durationSeconds: z.number().int().min(0).max(24 * 3600).optional(),
  }),
  z.object({ action: z.literal("abort"), key: z.string().min(1), uploadId: z.string().min(1) }),
]);

export async function POST(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId) return apiError("Scheduled class not found", 404);
    const wb = await prisma.whiteboardSession.findUnique({ where: { batchScheduleId: scheduleId }, select: { id: true } });
    if (!wb) return apiError("This class has no session.", 404);

    const input = schema.parse(await request.json());
    const { bucketName } = getR2Credentials();
    const s3 = getR2Client();
    const prefix = `class-recordings/${scheduleId}/`;
    if (input.action !== "init" && !input.key.startsWith(prefix)) return apiError("Not this class's recording.", 400);

    if (input.action === "init") {
      const key = `${prefix}${Date.now()}.mp4`;
      const res = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucketName, Key: key, ContentType: "video/mp4" }));
      await prisma.whiteboardSession.update({ where: { id: wb.id }, data: { recordingStatus: "PROCESSING" } });
      return apiSuccess({ key, uploadId: res.UploadId });
    }
    if (input.action === "part") {
      const url = await getSignedUrl(s3, new UploadPartCommand({ Bucket: bucketName, Key: input.key, UploadId: input.uploadId, PartNumber: input.partNumber }), { expiresIn: 3600 });
      return apiSuccess({ url });
    }
    if (input.action === "complete") {
      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: input.key,
          UploadId: input.uploadId,
          MultipartUpload: { Parts: [...input.parts].sort((a, b) => a.PartNumber - b.PartNumber) },
        })
      );
      await prisma.whiteboardSession.update({
        where: { id: wb.id },
        data: { recordingStorageKey: input.key, recordingStatus: "READY", ...(input.durationSeconds ? { recordingDurationSeconds: input.durationSeconds } : {}) },
      });
      return apiSuccess({ ready: true });
    }
    await s3.send(new AbortMultipartUploadCommand({ Bucket: bucketName, Key: input.key, UploadId: input.uploadId })).catch(() => undefined);
    return apiSuccess({ aborted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
