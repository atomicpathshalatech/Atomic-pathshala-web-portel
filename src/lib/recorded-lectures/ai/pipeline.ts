import "server-only";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { signedObjectUrl } from "../storage";
import { parseTranscriptWindow, transcriptionPrompt, type BoardNote, type DictatedNote, type Segment } from "./format";
import {
  GeminiHttpError,
  MAX_AI_FILE_BYTES,
  VIDEO_MODELS,
  askAboutVideo,
  deleteAiFile,
  geminiKeys,
  getAiFile,
  startFileUpload,
  uploadFileChunk,
} from "./gemini";

/**
 * The AI pass over a recorded lecture, as a resumable state machine. Each
 * call to runSteps() does as much as fits in its time budget, saves its
 * progress, and hands over to a fresh invocation — a one-hour lecture takes
 * many invocations. Nothing is ever lost on a crash: every step restarts
 * from the last saved point.
 *
 *   QUEUED → TRANSFERRING (video → Gemini Files, 64 MB chunks)
 *          → AI_PREPARING (Gemini processes the file)
 *          → TRANSCRIBING (10-minute windows: speech with times, the
 *                          board, and what the teacher dictates)
 *          → READY        (notes / summary are made from it on request)
 */

const CHUNK_BYTES = 64 * 1024 * 1024;
const LOCK_MS = 290_000;


export class LectureAiError extends Error {}
/** The job was restarted while this run worked on it: stop quietly, the new run owns it. */
class SupersededRun extends Error {}

/** Starts (or restarts) the AI pass for a lecture with a verified video. */
export async function startLectureAi(lectureId: string, userId: string) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { language: true, recordedMedia: { select: { uploadStatus: true, sizeBytes: true, durationSec: true } }, aiJob: true },
  });
  if (!lecture?.recordedMedia) throw new LectureAiError("Recorded lecture not found.");
  if (lecture.recordedMedia.uploadStatus !== "READY") throw new LectureAiError("Upload and verify the video first.");
  if (lecture.recordedMedia.sizeBytes > BigInt(MAX_AI_FILE_BYTES)) {
    throw new LectureAiError("The video is over 2 GB — the AI can read files up to 2 GB. Export it at 720p and upload again.");
  }
  const keys = geminiKeys();
  if (!keys.length) throw new LectureAiError("No Gemini keys are configured on the server.");
  const old = lecture.aiJob;
  if (old?.geminiFileName) await deleteAiFile(keys[old.keyIndex % keys.length]!, old.geminiFileName).catch(() => null);
  // Newest keys first (the oldest ones are the depleted free keys); a restart moves to the next key.
  const keyIndex = (keys.length - 1 - ((old?.attempts ?? 0) % keys.length) + keys.length) % keys.length;
  const data = {
    status: "QUEUED" as const,
    stepNote: "Waiting to start",
    keyIndex,
    geminiUploadUrl: null,
    uploadedBytes: BigInt(0),
    geminiFileName: null,
    geminiFileUri: null,
    sourceLanguage: lecture.language,
    durationSec: lecture.recordedMedia.durationSec,
    windowsDone: 0,
    windowsTotal: 0,
    segments: [],
    board: [],
    dictated: [],
    error: null,
    retryAt: null,
    lockedUntil: null,
    attempts: (old?.attempts ?? 0) + 1,
    tokensIn: 0,
    tokensOut: 0,
    requestedById: userId,
    startedAt: new Date(),
    finishedAt: null,
  };
  await prisma.lectureAiJob.upsert({ where: { lectureId }, update: data, create: { lectureId, ...data } });
  triggerRun(lectureId);
}

/** Hands the job to a fresh invocation (its own time budget). Safety nets: the status poll and the daily cron. */
export function triggerRun(lectureId: string) {
  try {
    const secret = process.env.CRON_SECRET;
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://ap.atomicpathshala.in").replace(/\/$/, "");
    waitUntil(
      fetch(`${base}/api/internal/lecture-ai/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        body: JSON.stringify({ lectureId }),
        // Only the hand-over is waited for, not the next run itself.
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
    );
  } catch {
    // the poll / cron resumes it
  }
}

/** Is the job due to run (not finished, not locked, not waiting)? */
export function jobIsDue(job: { status: string; lockedUntil: Date | null; retryAt: Date | null }) {
  const now = Date.now();
  return (
    job.status !== "READY" &&
    job.status !== "FAILED" &&
    (!job.lockedUntil || job.lockedUntil.getTime() < now) &&
    (!job.retryAt || job.retryAt.getTime() <= now)
  );
}

/**
 * Runs steps until done or the budget is used. Returns whether more work
 * remains (the caller then hands over to a new invocation).
 */
export async function runSteps(lectureId: string, budgetMs: number): Promise<{ more: boolean; status: string }> {
  const deadline = Date.now() + budgetMs;
  const claimed = await prisma.lectureAiJob.updateMany({
    where: {
      lectureId,
      status: { notIn: ["READY", "FAILED"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      AND: [{ OR: [{ retryAt: null }, { retryAt: { lte: new Date() } }] }],
    },
    data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
  });
  if (claimed.count === 0) {
    const j = await prisma.lectureAiJob.findUnique({ where: { lectureId }, select: { status: true, retryAt: true } });
    return { more: false, status: j?.status ?? "NONE" };
  }

  let status = "QUEUED";
  let myAttempt: number | null = null;
  try {
    for (;;) {
      const job = await prisma.lectureAiJob.findUnique({ where: { lectureId } });
      if (!job) return { more: false, status: "NONE" };
      status = job.status;
      if (myAttempt === null) myAttempt = job.attempts;
      else if (job.attempts !== myAttempt) return { more: false, status };
      if (job.status === "READY" || job.status === "FAILED") return { more: false, status };
      const left = deadline - Date.now();
      if (left < 20_000) return { more: true, status };
      const r = await step(job, deadline);
      if (r === "wait") return { more: false, status };
    }
  } catch (err) {
    if (err instanceof SupersededRun) return { more: false, status };
    const quota = err instanceof GeminiHttpError && err.quota;
    const message = String((err as Error)?.message ?? err).slice(0, 900);
    const job = await prisma.lectureAiJob.findUnique({ where: { lectureId }, select: { error: true, status: true } });
    // Quota: wait and continue later. Anything else: up to 3 retries of the same step, then FAILED.
    const tries = (job?.error?.match(/\(try (\d)\)/)?.[1] ? Number(job.error.match(/\(try (\d)\)/)![1]) : 0) + 1;
    if (quota || tries < 3) {
      await prisma.lectureAiJob.updateMany({
        where: { lectureId, ...(myAttempt !== null ? { attempts: myAttempt } : {}) },
        data: {
          error: quota ? `AI quota reached — continuing automatically in a few minutes. ${message}` : `${message} (try ${tries})`,
          retryAt: new Date(Date.now() + (quota ? 5 * 60_000 : 30_000)),
        },
      });
      return { more: false, status };
    }
    await prisma.lectureAiJob.updateMany({ where: { lectureId, ...(myAttempt !== null ? { attempts: myAttempt } : {}) }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    return { more: false, status: "FAILED" };
  } finally {
    await prisma.lectureAiJob.updateMany({ where: { lectureId, ...(myAttempt !== null ? { attempts: myAttempt } : {}) }, data: { lockedUntil: null } });
  }
}

type Job = NonNullable<Awaited<ReturnType<typeof prisma.lectureAiJob.findUnique>>>;

async function step(job: Job, deadline: number): Promise<"continue" | "wait"> {
  const keys = geminiKeys();
  const key = keys[job.keyIndex % keys.length];
  if (!key) throw new LectureAiError("No Gemini keys are configured.");
  const lecture = await prisma.lecture.findUnique({
    where: { id: job.lectureId },
    select: {
      title: true,
      language: true,
      chapter: { select: { title: true, subject: { select: { title: true } } } },
      recordedMedia: { select: { objectKey: true, mimeType: true, sizeBytes: true, durationSec: true } },
    },
  });
  const media = lecture?.recordedMedia;
  if (!lecture || !media) throw new LectureAiError("The lecture or its video is gone.");
  const size = Number(media.sizeBytes);
  // Only while this run's attempt is current: a restart in the meantime wins.
  const save = async (data: Parameters<typeof prisma.lectureAiJob.updateMany>[0]["data"]) => {
    const res = await prisma.lectureAiJob.updateMany({ where: { id: job.id, attempts: job.attempts }, data: { ...data, error: null, retryAt: null } });
    if (res.count === 0) throw new SupersededRun();
  };

  switch (job.status) {
    case "QUEUED": {
      const { url } = await startFileUpload(key, { size, mimeType: media.mimeType, displayName: `lecture-${job.lectureId}` });
      await save({ status: "TRANSFERRING", geminiUploadUrl: url, uploadedBytes: BigInt(0), stepNote: "Sending the video to the AI (0%)" });
      return "continue";
    }

    case "TRANSFERRING": {
      let offset = Number(job.uploadedBytes);
      const source = await signedObjectUrl(media.objectKey, 900);
      while (offset < size && deadline - Date.now() > 45_000) {
        const end = Math.min(size, offset + CHUNK_BYTES) - 1;
        const res = await fetch(source, { headers: { Range: `bytes=${offset}-${end}` } });
        if (!res.ok && res.status !== 206) throw new LectureAiError(`Reading the video from storage failed (HTTP ${res.status}).`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length !== end - offset + 1) throw new LectureAiError("Storage returned a short read; retrying.");
        const last = end + 1 >= size;
        const file = await uploadFileChunk(job.geminiUploadUrl!, offset, bytes, last);
        offset = end + 1;
        if (file) {
          await save({ status: "AI_PREPARING", uploadedBytes: BigInt(offset), geminiFileName: file.name, geminiFileUri: file.uri, geminiUploadUrl: null, stepNote: "The AI is reading the video" });
          return "continue";
        }
        await save({ uploadedBytes: BigInt(offset), stepNote: `Sending the video to the AI (${Math.round((offset / size) * 100)}%)` });
      }
      return "continue";
    }

    case "AI_PREPARING": {
      const f = await getAiFile(key, job.geminiFileName!);
      if (f.state === "FAILED") throw new LectureAiError(`The AI could not read the video: ${f.error ?? "unknown error"}`);
      if (f.state !== "ACTIVE") {
        await prisma.lectureAiJob.update({ where: { id: job.id }, data: { retryAt: new Date(Date.now() + 15_000), stepNote: "The AI is reading the video" } });
        return "wait";
      }
      const duration = job.durationSec ?? f.durationSec ?? media.durationSec;
      if (!duration) throw new LectureAiError("The video's length is unknown.");
      await save({
        status: "TRANSCRIBING",
        durationSec: duration,
        windowsTotal: Math.ceil(duration / job.windowSec),
        windowsDone: 0,
        stepNote: "Reading the board and what the teacher dictates",
      });
      return "continue";
    }

    case "TRANSCRIBING": {
      if (job.windowsDone >= job.windowsTotal) {
        await save({ status: "READY", stepNote: "Ready", finishedAt: new Date() });
        if (job.geminiFileName) await deleteAiFile(key, job.geminiFileName).catch(() => null);
        return "continue";
      }
      if (deadline - Date.now() < 150_000) return "continue"; // a window needs a fresh budget
      const from = job.windowsDone * job.windowSec;
      const to = Math.min(job.durationSec!, from + job.windowSec);
      let lastErr: unknown = null;
      for (const model of VIDEO_MODELS) {
        try {
          const r = await askAboutVideo(key, model, {
            fileUri: job.geminiFileUri!,
            mimeType: media.mimeType,
            from,
            to,
            prompt: transcriptionPrompt({ from, to, title: lecture.title, subject: lecture.chapter.subject.title, chapter: lecture.chapter.title, language: lecture.language }),
          });
          const parsed = parseTranscriptWindow(parseAiJson(r.text.replace(/```json|```/gi, "").trim()), from, to);
          await save({
            segments: [...(job.segments as Segment[]), ...parsed.segments],
            board: [...(job.board as BoardNote[]), ...parsed.board],
            dictated: [...(job.dictated as DictatedNote[]), ...parsed.dictated],
            windowsDone: job.windowsDone + 1,
            tokensIn: job.tokensIn + r.tokensIn,
            tokensOut: job.tokensOut + r.tokensOut,
            stepNote: `Reading the lecture (${Math.min(job.windowsDone + 1, job.windowsTotal)} of ${job.windowsTotal} parts)`,
          });
          return "continue";
        } catch (err) {
          lastErr = err;
          if (err instanceof GeminiHttpError && (err.status === 404 || err.status === 400)) continue; // try the next model
          throw err;
        }
      }
      throw lastErr ?? new LectureAiError("No AI model could read the video.");
    }
  }
  return "wait";
}
