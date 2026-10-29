import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";
import { abortMultipartUpload, listOpenMultipartUploads } from "@/lib/recorded-lectures/storage";
import { verifyAndRecord } from "@/lib/recorded-lectures/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;
const STUCK_VERIFY_MS = 10 * 60 * 1000;

/**
 * Daily clean-up of the recorded-lecture bucket — recoverable states only,
 * never a finished file:
 * 1. VERIFYING for over 10 min (the request that assembled the upload died
 *    before recording the result): verify now → READY or FAILED.
 * 2. UPLOADING untouched for 24 h: abort the open multipart upload (its
 *    parts are discarded) and mark it ABORTED, so it can be uploaded again.
 * 3. Open multipart uploads in the bucket that no lecture points to and are
 *    older than 24 h: aborted.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!recordedStorageStatus().ready) return NextResponse.json({ skipped: "recorded-lecture storage not configured" });

  const now = Date.now();
  const report = { verified: 0, failedVerify: 0, abandoned: 0, orphanUploads: 0, errors: 0 };

  const stuck = await prisma.recordedLectureMedia.findMany({
    where: { uploadStatus: "VERIFYING", updatedAt: { lt: new Date(now - STUCK_VERIFY_MS) } },
    select: { lectureId: true },
    take: 50,
  });
  for (const m of stuck) {
    try {
      const r = await verifyAndRecord(m.lectureId);
      if (r.ok) report.verified++;
      else report.failedVerify++;
    } catch {
      report.errors++;
    }
  }

  const stale = await prisma.recordedLectureMedia.findMany({
    where: { uploadStatus: "UPLOADING", updatedAt: { lt: new Date(now - STALE_UPLOAD_MS) } },
    select: { lectureId: true, objectKey: true, multipartUploadId: true },
    take: 100,
  });
  for (const m of stale) {
    try {
      if (m.multipartUploadId) await abortMultipartUpload({ key: m.objectKey, uploadId: m.multipartUploadId }).catch(() => null);
      await prisma.recordedLectureMedia.update({
        where: { lectureId: m.lectureId },
        data: { uploadStatus: "ABORTED", multipartUploadId: null, uploadError: "Upload abandoned for over 24 hours — start it again." },
      });
      report.abandoned++;
    } catch {
      report.errors++;
    }
  }

  try {
    const open = await listOpenMultipartUploads();
    const known = new Set(
      (
        await prisma.recordedLectureMedia.findMany({
          where: { multipartUploadId: { in: open.map((u) => u.uploadId) } },
          select: { multipartUploadId: true },
        })
      ).map((m) => m.multipartUploadId)
    );
    for (const u of open) {
      if (known.has(u.uploadId)) continue;
      if (u.initiated && now - u.initiated.getTime() < STALE_UPLOAD_MS) continue;
      await abortMultipartUpload({ key: u.key, uploadId: u.uploadId }).catch(() => null);
      report.orphanUploads++;
    }
  } catch {
    report.errors++;
  }

  return NextResponse.json({ ok: true, ...report });
}
