import "server-only";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { createPresignedDownloadUrl, getR2ObjectMetadata } from "@/lib/storage/r2-client";
import { generateCreative } from "@/lib/creative/engine";
import {
  initiateResumableUpload,
  uploadChunk,
  setThumbnail,
  isRetryableYoutubeError,
  youtubeArchiveConfigured,
  YOUTUBE_UPLOAD_CHUNK_SIZE,
} from "./upload-client";
import {
  buildYoutubeTitle,
  buildYoutubeDescription,
  buildYoutubeTags,
  normalizeYoutubeTags,
  validateYoutubeMetadata,
  type ClassMetadataInput,
  type FinalYoutubeMetadata,
} from "./metadata";

/**
 * Orchestrates archiving a finished LiveKit recording to YouTube as an
 * unlisted video, once WhiteboardSession.recordingStatus reaches "READY"
 * (see the trigger points in src/app/api/webhooks/livekit/route.ts and
 * src/lib/livekit/egress.ts).
 *
 * Vercel serverless functions have no persistent worker and no guaranteed
 * background execution after a response is sent, so the upload is modeled
 * as a checkpointed operation that may span many short invocations: each
 * call to runArchiveUpload() uploads as many chunks as fit in
 * UPLOAD_TIME_BUDGET_MS, persists its byte offset + YouTube session URI
 * after every chunk, and — if it isn't finished — fires an unawaited HTTP
 * call to its own continuation route so the next invocation picks up
 * exactly where this one left off. The once-daily cron
 * (/api/cron/youtube-archive/process) is the safety net for jobs whose
 * continuation chain breaks (a killed invocation, a dropped fetch), not the
 * primary driver.
 */

const MAX_UPLOAD_ATTEMPTS = 5;
// Stays well inside a single serverless invocation's time budget (this
// account's plan caps functions at 60s — see the cron routes' own maxDuration
// comments) so there is always time left to persist the checkpoint and fire
// the continuation call before the invocation is killed.
const UPLOAD_TIME_BUDGET_MS = 45_000;

type MetadataSnapshot = { input: ClassMetadataInput; final: FinalYoutubeMetadata };

function toFinalMetadata(input: ClassMetadataInput): FinalYoutubeMetadata {
  const titleResult = buildYoutubeTitle(input);
  const description = buildYoutubeDescription(input);
  const tagsInfo = normalizeYoutubeTags(buildYoutubeTags(input));
  return {
    title: titleResult.youtubeTitle,
    description,
    tags: tagsInfo.tags,
    categoryId: process.env.YOUTUBE_CATEGORY_ID || "27", // 27 = Education (real YouTube taxonomy id)
    privacyStatus: "unlisted",
  };
}

/** 1-based sequential "Lecture N" number for a batch, counted from real
 * scheduled LIVE_CLASS sessions chronologically up to and including this
 * one — never invented, never stored redundantly, always recomputed from
 * BatchSchedule so it stays correct even if earlier classes are added later. */
async function computeLectureOrdinal(batchId: string, scheduleStartsAt: Date): Promise<number> {
  const priorOrEqualCount = await prisma.batchSchedule.count({
    where: { batchId, type: "LIVE_CLASS", startsAt: { lte: scheduleStartsAt } },
  });
  return Math.max(1, priorOrEqualCount);
}

async function buildMetadataInput(whiteboardSessionId: string): Promise<ClassMetadataInput | null> {
  const session = await prisma.whiteboardSession.findUnique({
    where: { id: whiteboardSessionId },
    select: {
      title: true,
      batchSchedule: {
        select: {
          title: true,
          notes: true,
          startsAt: true,
          batchId: true,
          batch: { select: { name: true, targetExam: true } },
          teacher: { select: { user: { select: { name: true } } } },
          chapter: {
            select: {
              title: true,
              description: true,
              learningObjectives: true,
              subject: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!session) return null;

  const schedule = session.batchSchedule;
  const lectureOrdinal = await computeLectureOrdinal(schedule.batchId, schedule.startsAt);

  return {
    originalClassTitle: session.title || schedule.title,
    subjectName: schedule.chapter?.subject.title ?? null,
    chapterTitle: schedule.chapter?.title ?? null,
    chapterDescription: schedule.chapter?.description ?? null,
    learningObjectives: schedule.chapter?.learningObjectives ?? null,
    classNotes: schedule.notes ?? null,
    batchName: schedule.batch.name,
    targetExam: schedule.batch.targetExam ?? null,
    teacherName: schedule.teacher?.user.name ?? null,
    classDate: schedule.startsAt,
    lectureOrdinal,
  };
}

async function markFailed(whiteboardSessionId: string, err: unknown, attempts?: number): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[youtube-archive] job failed", whiteboardSessionId, err);
  await prisma.whiteboardSession
    .update({
      where: { id: whiteboardSessionId },
      data: {
        youtubeArchiveStatus: "FAILED",
        youtubeArchiveLastError: message.slice(0, 1000),
        ...(attempts !== undefined ? { youtubeArchiveUploadAttempts: attempts } : {}),
      },
    })
    .catch((e) => console.error("[youtube-archive] failed to persist failure state", whiteboardSessionId, e));
}

/** Unawaited self-continuation call — matches this codebase's existing
 * fire-and-forget trigger pattern (finalizeWhiteboardSlides), just crossing
 * an HTTP boundary instead of an import() so the continuation runs as a
 * brand-new serverless invocation with a fresh time budget. If this fetch
 * never lands (cold start, network blip, the invocation being killed right
 * after calling it), the session is left in UPLOADING/RETRYING with a
 * checkpointed offset, and the once-daily cron safety net resumes it. */
function triggerContinuation(whiteboardSessionId: string): void {
  try {
    const secret = process.env.CRON_SECRET;
    const baseUrl = (process.env.YOUTUBE_OAUTH_PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ap.atomicpathshala.in").replace(/\/$/, "");
    // waitUntil keeps the CURRENT invocation alive long enough for this
    // fetch to actually be sent — without it, the invocation can be torn
    // down before the request leaves the process, and the continuation
    // never fires (same root cause as the recording/finalization loss this
    // fixed elsewhere).
    waitUntil(
      fetch(`${baseUrl}/api/internal/youtube-archive/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ whiteboardSessionId }),
      }).catch((err) =>
        console.error("[youtube-archive] continuation trigger did not fire (daily cron will still resume it)", whiteboardSessionId, err)
      )
    );
  } catch (err) {
    console.error("[youtube-archive] failed to schedule continuation", whiteboardSessionId, err);
  }
}

/**
 * Entry point — call fire-and-forget the instant recordingStatus flips to
 * READY. Idempotent claim via a conditional updateMany: a session already
 * PENDING/QUEUED/UPLOADING/UPLOADED/PROCESSING/COMPLETED is left alone, so
 * calling this twice for the same session (webhook + reconcile fallback
 * both firing) never double-starts a job.
 */
export async function startArchiveJob(whiteboardSessionId: string): Promise<void> {
  if (!youtubeArchiveConfigured()) {
    console.warn("[youtube-archive] skipped — YouTube OAuth env vars not configured", whiteboardSessionId);
    return;
  }

  const claim = await prisma.whiteboardSession.updateMany({
    where: { id: whiteboardSessionId, youtubeArchiveStatus: { in: ["NOT_ENABLED", "FAILED", "RETRYING"] } },
    data: { youtubeArchiveStatus: "PENDING", youtubeArchiveUploadStartedAt: new Date(), youtubeArchiveLastError: null },
  });
  if (claim.count === 0) return;

  try {
    const input = await buildMetadataInput(whiteboardSessionId);
    if (!input) throw new Error("Class metadata could not be resolved for this session.");

    const final = toFinalMetadata(input);
    const validation = validateYoutubeMetadata(final);
    if (!validation.valid) {
      await markFailed(whiteboardSessionId, new Error(`METADATA_VALIDATION_FAILED: ${validation.reason}`));
      return;
    }

    // Immutable metadata snapshot (spec Part 13) — taken once, right now.
    // A later edit to the class/chapter must never change what an
    // in-flight or already-completed archive uses.
    const snapshot: MetadataSnapshot = { input, final };
    await prisma.whiteboardSession.update({
      where: { id: whiteboardSessionId },
      data: { youtubeArchiveStatus: "QUEUED", youtubeArchiveMetadataSnapshot: snapshot as object },
    });
  } catch (err) {
    await markFailed(whiteboardSessionId, err);
    return;
  }

  await runArchiveUpload(whiteboardSessionId);
}

/**
 * Runs (or resumes) the checkpointed chunk-upload loop for one session.
 * Safe to call repeatedly/concurrently-ish: it only proceeds for sessions
 * currently QUEUED/UPLOADING/RETRYING, and every checkpoint write is
 * idempotent (re-persisting the same offset is harmless).
 */
export async function runArchiveUpload(whiteboardSessionId: string): Promise<void> {
  const session = await prisma.whiteboardSession.findUnique({ where: { id: whiteboardSessionId } });
  if (!session) return;
  if (!["QUEUED", "UPLOADING", "RETRYING"].includes(session.youtubeArchiveStatus)) return;

  // These three early-exit failures previously called markFailed() without
  // an `attempts` value, which only ever records it when explicitly
  // passed (see markFailed below) - so youtubeArchiveUploadAttempts stayed
  // at 0 forever on this path. The once-daily cron's retry selection
  // filters on `attempts < 5` (process/route.ts), so a session stuck here
  // was silently re-selected and re-failed the same way every day,
  // indefinitely, with no way to ever stop retrying.
  const nextAttempts = session.youtubeArchiveUploadAttempts + 1;

  if (!session.recordingStorageKey) {
    await markFailed(whiteboardSessionId, new Error("Session has no recordingStorageKey to archive."), nextAttempts);
    return;
  }

  const objectInfo = await getR2ObjectMetadata(session.recordingStorageKey).catch((err) => {
    throw new Error(`Could not read recording metadata from storage: ${err instanceof Error ? err.message : err}`);
  });
  if (!objectInfo.exists || !objectInfo.contentLength) {
    await markFailed(whiteboardSessionId, new Error("Recording file not found in R2 storage."), nextAttempts);
    return;
  }
  const totalSize = objectInfo.contentLength;
  const mimeType = objectInfo.contentType || "video/mp4";

  const snapshot = session.youtubeArchiveMetadataSnapshot as unknown as MetadataSnapshot | null;
  if (!snapshot?.final) {
    await markFailed(whiteboardSessionId, new Error("Missing YouTube metadata snapshot — cannot upload."), nextAttempts);
    return;
  }

  try {
    let sessionUrl = session.youtubeArchiveUploadSessionUrl;
    let offset = Number(session.youtubeArchiveUploadOffset ?? 0);

    if (!sessionUrl) {
      sessionUrl = await initiateResumableUpload({
        title: snapshot.final.title,
        description: snapshot.final.description,
        tags: snapshot.final.tags,
        categoryId: snapshot.final.categoryId,
        fileSizeBytes: totalSize,
        mimeType,
      });
      offset = 0;
      await prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: { youtubeArchiveStatus: "UPLOADING", youtubeArchiveUploadSessionUrl: sessionUrl, youtubeArchiveUploadOffset: BigInt(0) },
      });
    }

    // One presigned GET for this whole invocation's chunk batch — cheaper
    // than minting a new one per chunk, and its default 10-minute expiry
    // comfortably outlives this invocation's own UPLOAD_TIME_BUDGET_MS.
    const presignedRecordingUrl = await createPresignedDownloadUrl({ key: session.recordingStorageKey, expiresInSeconds: 3600 });

    const deadline = Date.now() + UPLOAD_TIME_BUDGET_MS;
    let videoId: string | null = null;

    while (offset < totalSize && Date.now() < deadline) {
      const chunkEnd = Math.min(offset + YOUTUBE_UPLOAD_CHUNK_SIZE, totalSize);
      const rangeRes = await fetch(presignedRecordingUrl, { headers: { Range: `bytes=${offset}-${chunkEnd - 1}` } });
      if (!rangeRes.ok && rangeRes.status !== 206) {
        throw new Error(`Failed to read recording chunk from storage (${rangeRes.status}).`);
      }
      const chunkBuffer = Buffer.from(await rangeRes.arrayBuffer());
      if (chunkBuffer.length === 0) throw new Error("Read a zero-byte chunk from storage — aborting to avoid a stuck loop.");

      const result = await uploadChunk(sessionUrl, chunkBuffer, offset, totalSize);
      offset = result.done ? totalSize : result.nextOffset;
      if (result.done) videoId = result.videoId;

      await prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: { youtubeArchiveUploadOffset: BigInt(offset) },
      });
    }

    if (videoId) {
      await prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: {
          youtubeArchiveStatus: "PROCESSING",
          youtubeArchiveVideoId: videoId,
          youtubeArchiveVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          youtubeArchiveUploadedAt: new Date(),
        },
      });

      // Thumbnail is a separate, independently-retryable step (spec Part
      // 10) — runThumbnailStep never throws, so its outcome never affects
      // youtubeArchiveStatus below.
      await runThumbnailStep(whiteboardSessionId);

      await prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: { youtubeArchiveStatus: "COMPLETED", youtubeArchiveProcessedAt: new Date() },
      });
      return;
    }

    // Time budget ran out, not bytes — the checkpoint above already has
    // the correct offset/session URI, so just hand off to a continuation.
    triggerContinuation(whiteboardSessionId);
  } catch (err) {
    const attempts = session.youtubeArchiveUploadAttempts + 1;
    if (isRetryableYoutubeError(err) && attempts < MAX_UPLOAD_ATTEMPTS) {
      await prisma.whiteboardSession.update({
        where: { id: whiteboardSessionId },
        data: {
          youtubeArchiveStatus: "RETRYING",
          youtubeArchiveUploadAttempts: attempts,
          youtubeArchiveLastError: err instanceof Error ? err.message.slice(0, 1000) : String(err),
        },
      });
      triggerContinuation(whiteboardSessionId);
    } else {
      await markFailed(whiteboardSessionId, err, attempts);
    }
  }
}

/**
 * Sets the video's thumbnail from the SAME per-class image the platform
 * already generates for the "Start Class" slide (Creative Engine's
 * LECTURE_START_SLIDE, keyed by this session's BatchSchedule) — no second,
 * manually-created thumbnail. Independent of youtubeArchiveStatus: a
 * failure here is tracked on youtubeArchiveThumbnailStatus only and NEVER
 * triggers a video re-upload.
 */
export async function runThumbnailStep(whiteboardSessionId: string): Promise<void> {
  const session = await prisma.whiteboardSession.findUnique({ where: { id: whiteboardSessionId } });
  if (!session?.youtubeArchiveVideoId) return;
  if (session.youtubeArchiveThumbnailStatus === "UPLOADED") return;

  try {
    await prisma.whiteboardSession.update({
      where: { id: whiteboardSessionId },
      data: { youtubeArchiveThumbnailStatus: "PENDING", youtubeArchiveThumbnailError: null },
    });

    const creative = await generateCreative("LECTURE_START_SLIDE", session.batchScheduleId);
    if (!creative.ok) throw new Error(`Creative engine could not produce a thumbnail: ${creative.reason}`);

    const imgRes = await fetch(creative.assetUrl);
    if (!imgRes.ok) throw new Error(`Failed to download generated thumbnail (${imgRes.status}).`);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // YouTube's thumbnails.set hard limit is 2MB — checked rather than
    // assumed, even though the Creative Engine's PNG output is normally
    // far smaller.
    if (imgBuffer.length > 2 * 1024 * 1024) {
      throw new Error(`Generated thumbnail is ${imgBuffer.length} bytes, exceeds YouTube's 2MB limit.`);
    }

    await setThumbnail(session.youtubeArchiveVideoId, imgBuffer, "image/png");
    await prisma.whiteboardSession.update({
      where: { id: whiteboardSessionId },
      data: { youtubeArchiveThumbnailStatus: "UPLOADED" },
    });
  } catch (err) {
    console.error("[youtube-archive] thumbnail step failed", whiteboardSessionId, err);
    await prisma.whiteboardSession
      .update({
        where: { id: whiteboardSessionId },
        data: {
          youtubeArchiveThumbnailStatus: "FAILED",
          youtubeArchiveThumbnailError: err instanceof Error ? err.message.slice(0, 500) : String(err),
        },
      })
      .catch(() => {});
  }
}
