import "server-only";
import { prisma } from "@/lib/db";
import { headObject, readObjectHead } from "./storage";
import { sniffMatches, sniffVideo } from "./files";

/**
 * Checks an assembled upload in R2 — exact size and a real video signature —
 * and records the result: READY, or FAILED with the reason. The object is
 * never deleted here; a failed one stays recorded on the lecture.
 * Used right after an upload completes and by the reconcile job for uploads
 * that were assembled but never recorded (VERIFYING).
 */
export async function verifyAndRecord(lectureId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const media = await prisma.recordedLectureMedia.findUnique({
    where: { lectureId },
    select: { objectKey: true, sizeBytes: true, mimeType: true, durationSec: true },
  });
  if (!media) return { ok: false, error: "Recorded lecture not found." };

  const fail = async (error: string) => {
    await prisma.recordedLectureMedia.update({ where: { lectureId }, data: { uploadStatus: "FAILED", uploadError: error, multipartUploadId: null } });
    return { ok: false as const, error };
  };

  const head = await headObject(media.objectKey);
  if (!head) return fail("The uploaded file was not found in storage. Upload it again.");
  if (BigInt(head.size) !== media.sizeBytes) {
    return fail(`The stored file is ${head.size} bytes but ${media.sizeBytes} were expected — the upload is incomplete. Upload it again.`);
  }
  const first = await readObjectHead(media.objectKey, 64);
  if (!sniffMatches(media.mimeType, sniffVideo(first))) {
    return fail("The uploaded file is not a playable video (its content does not match MP4/MOV/WebM). Export it again as MP4.");
  }

  await prisma.$transaction([
    prisma.recordedLectureMedia.update({
      where: { lectureId },
      data: { uploadStatus: "READY", uploadError: null, verifiedAt: new Date(), multipartUploadId: null },
    }),
    ...(media.durationSec
      ? [prisma.lecture.update({ where: { id: lectureId }, data: { durationMin: Math.max(1, Math.round(media.durationSec / 60)) } })]
      : []),
  ]);
  return { ok: true };
}
