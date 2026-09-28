import "server-only";
import type { LiveSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ensureOpenLiveSession,
  getOpenLiveSession,
  markGroupMembersLive,
  setLiveSessionDelivery,
  transitionLiveSession,
} from "@/lib/live-session/service";
import {
  NoIngestCapacityError,
  acquireStreamLease,
  getActiveLease,
  leaseIngestCredentials,
  markLease,
  releaseLeasesForSession,
} from "@/lib/youtube/stream-pool";

/**
 * APP_YOUTUBE: Atomic whiteboard → teacher's encoder → a per-class stream on
 * the APP channel → students' embedded player.
 *
 *   Start   READY → STARTING: lease a free pool stream, create this
 *           occurrence's unlisted broadcast (auto-stop OFF), bind it
 *           → YOUTUBE_CONNECTING. Students still see "starting".
 *   Poll    stream active on YouTube → YOUTUBE_ACTIVE;
 *           broadcast live on YouTube → LIVE (students notified only now).
 *   End     complete the broadcast, release the lease → RECORDING_PROCESSING.
 *   Record  RECORDING_PROCESSING → RECORDING_READY only when YouTube reports
 *           the archive processed; then the lecture link is published.
 */

/** Is there at least one pool stream? Without one, App YouTube classes can't start (no master-key fallback). */
export async function appYoutubePoolConfigured(): Promise<boolean> {
  const count = await prisma.youtubeIngestStream.count({ where: { channel: "APP", status: { in: ["AVAILABLE", "LEASED"] } } });
  return count > 0;
}

export type BeginAppYoutubeInput = {
  schedule: { id: string; title: string; startsAt: Date; endsAt: Date };
  wbSession: { id: string; scheduledEnd: Date | null };
  teacherId: string;
  broadcastTitle: string;
  broadcastDescription?: string;
};

export type BeginAppYoutubeResult = {
  liveSession: LiveSession;
  youtubeBroadcastId: string;
  /** Pool stream the class is bound to (internal id — not the key). */
  leaseId: string;
};

/**
 * Start Class for APP_YOUTUBE. Idempotent: a retry while already connecting
 * or live returns the same broadcast and lease. On failure after the lease
 * was taken, the lease is released and the occurrence goes back to READY.
 */
export async function beginAppYoutubeStart(input: BeginAppYoutubeInput): Promise<BeginAppYoutubeResult> {
  const { effectiveClassEnd } = await import("@/lib/whiteboard/lifecycle");
  const classEnd = effectiveClassEnd(input.schedule.endsAt, input.wbSession.scheduledEnd);

  let session = await ensureOpenLiveSession({
    batchScheduleId: input.schedule.id,
    whiteboardSessionId: input.wbSession.id,
    controllingTeacherId: input.teacherId,
    plannedStartsAt: input.schedule.startsAt,
    plannedEndsAt: classEnd,
    videoTransport: "LIVEKIT", // provisional until the broadcast exists
  });

  if (["YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE", "LIVE"].includes(session.state) && session.youtubeBroadcastId) {
    const lease = await getActiveLease(session.id);
    if (lease) return { liveSession: session, youtubeBroadcastId: session.youtubeBroadcastId, leaseId: lease.id };
  }
  if (session.state !== "STARTING") session = await transitionLiveSession(session.id, "STARTING");

  const lease = await acquireStreamLease(session.id, session.effectiveEndsAt).catch(async (err) => {
    await transitionLiveSession(session.id, "READY").catch(() => undefined);
    throw err;
  });

  try {
    const { createLiveBroadcast, bindBroadcastToStream } = await import("@/lib/youtube/live-broadcast");
    let broadcastId = session.youtubeBroadcastId;
    if (!broadcastId) {
      // A fresh broadcast per occurrence — never a previous run's.
      const broadcast = await createLiveBroadcast(
        input.broadcastTitle,
        input.schedule.startsAt.toISOString(),
        input.broadcastDescription,
        { enableAutoStop: false }
      );
      broadcastId = broadcast.id;
      await prisma.liveSession.update({ where: { id: session.id }, data: { youtubeBroadcastId: broadcastId } });
    }
    await bindBroadcastToStream(broadcastId, lease.stream.youtubeStreamId);
    await markLease(lease.id, "BOUND");

    session = await setLiveSessionDelivery(session.id, {
      videoTransport: "YOUTUBE",
      youtubeBroadcastId: broadcastId,
      youtubeVideoId: broadcastId,
    });
    session = await transitionLiveSession(session.id, "YOUTUBE_CONNECTING");

    // Legacy mirror for code that still reads WhiteboardSession. The stream
    // key is deliberately NOT stored there any more (and any old one is
    // scrubbed) — it lives encrypted on the pool stream only.
    await prisma.whiteboardSession.update({
      where: { id: input.wbSession.id },
      data: {
        youtubeBroadcastId: broadcastId,
        youtubeVideoId: broadcastId,
        youtubeStreamId: lease.stream.youtubeStreamId,
        youtubeIngestUrl: null,
        youtubeStreamKey: null,
        youtubeStatus: "connecting",
      },
    });
    return { liveSession: session, youtubeBroadcastId: broadcastId, leaseId: lease.id };
  } catch (err) {
    await releaseLeasesForSession(session.id).catch(() => undefined);
    await transitionLiveSession(session.id, "READY").catch(() => undefined);
    throw err;
  }
}

export { NoIngestCapacityError };

/** RTMP target for the class's current lease (controller only; caller must authorize). */
export async function encoderCredentialsForSchedule(batchScheduleId: string) {
  const session = await getOpenLiveSession(batchScheduleId);
  if (!session || session.deliveryMode !== "APP_YOUTUBE") return null;
  const lease = await getActiveLease(session.id);
  if (!lease) return null;
  return { ...leaseIngestCredentials(lease.stream), liveSessionId: session.id, state: session.state };
}

export type AppYoutubeStatus = {
  state: string;
  streamStatus: string | null;
  healthStatus: string | null;
  broadcastLifecycle: string | null;
  becameLive: boolean;
  /** Students can't watch inside the app: YouTube kept embedding off for this broadcast. */
  embedBlocked: boolean;
};

const EXPLICIT_GO_LIVE_AFTER_MS = 15_000;

/**
 * The student app plays the class in an embedded YouTube player, so the
 * broadcast MUST allow embedding. Creation already asks for it, but that
 * update can fail silently (e.g. issued before YouTube finished creating the
 * video) — and a non-embeddable video shows students only a "watch on
 * YouTube" fallback. Checked (1 unit) at the two gate steps; fixed (~50
 * units) only when off. Returns false when embedding is still off.
 */
async function ensureEmbeddable(broadcastId: string): Promise<boolean> {
  const { getYoutubeVideoInfo } = await import("@/lib/youtube/client");
  try {
    const before = await getYoutubeVideoInfo("APP", broadcastId);
    if (before?.embeddable === true) return true;
    const { ensureBroadcastEmbeddable } = await import("@/lib/youtube/live-broadcast");
    await ensureBroadcastEmbeddable(broadcastId);
    const after = await getYoutubeVideoInfo("APP", broadcastId);
    if (after?.embeddable === true) return true;
    console.error("[app_youtube_embed_still_off]", broadcastId, { embeddable: after?.embeddable ?? null });
  } catch (err) {
    console.error("[app_youtube_embed_error]", broadcastId, err);
  }
  return false;
}

/**
 * One health-gate step, driven by the teacher client polling every few
 * seconds (never by students). 1–2 quota units per call. Moves
 * YOUTUBE_CONNECTING → YOUTUBE_ACTIVE once YouTube sees the stream, and
 * YOUTUBE_ACTIVE → LIVE once the broadcast is live (auto-start, or an
 * explicit transition if auto-start hasn't fired after 15 s).
 */
export async function pollAppYoutubeStatus(liveSessionId: string): Promise<AppYoutubeStatus> {
  const { getIngestStreamHealth, getBroadcastLifecycle, transitionBroadcast } = await import("@/lib/youtube/live-broadcast");
  let session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  const out: AppYoutubeStatus = { state: session.state, streamStatus: null, healthStatus: null, broadcastLifecycle: null, becameLive: false, embedBlocked: false };
  if (session.deliveryMode !== "APP_YOUTUBE" || !session.youtubeBroadcastId) return out;
  if (!["YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE"].includes(session.state)) return out;

  const lease = await getActiveLease(session.id);
  if (!lease) return out;

  const health = await getIngestStreamHealth(lease.stream.youtubeStreamId);
  out.streamStatus = health?.streamStatus ?? null;
  out.healthStatus = health?.healthStatus ?? null;

  if (session.state === "YOUTUBE_CONNECTING") {
    if (health?.streamStatus !== "active") return out;
    session = await transitionLiveSession(session.id, "YOUTUBE_ACTIVE");
    await markLease(lease.id, "ACTIVE");
    out.state = session.state;
    // Before any student is let in: the in-app player needs embedding on.
    out.embedBlocked = !(await ensureEmbeddable(session.youtubeBroadcastId!));
  }

  const lifecycle = await getBroadcastLifecycle(session.youtubeBroadcastId!);
  out.broadcastLifecycle = lifecycle;
  await prisma.liveSession.update({ where: { id: session.id }, data: { youtubeLifecycle: lifecycle } });

  if (lifecycle === "complete" || lifecycle === "revoked") {
    session = await transitionLiveSession(session.id, "FAILED", { failureReason: `broadcast_${lifecycle}_before_live` });
    await releaseLeasesForSession(session.id);
    out.state = session.state;
    return out;
  }

  if (lifecycle !== "live") {
    const waitedMs = Date.now() - session.stateChangedAt.getTime();
    if ((lifecycle === "ready" || lifecycle === "testing") && health?.streamStatus === "active" && waitedMs > EXPLICIT_GO_LIVE_AFTER_MS) {
      await transitionBroadcast(session.youtubeBroadcastId!, "live"); // auto-start didn't fire; ~50 units, once
    }
    return out;
  }

  const now = new Date();
  // Second (last) check as students are let in — covers a first attempt
  // that ran before YouTube had the video ready.
  out.embedBlocked = !(await ensureEmbeddable(session.youtubeBroadcastId!));
  session = await transitionLiveSession(session.id, "LIVE", { actualStartedAt: session.actualStartedAt ?? now });
  await markGroupMembersLive(session.id, now);
  await prisma.batchSchedule.update({ where: { id: session.batchScheduleId }, data: { status: "LIVE" } });
  if (session.whiteboardSessionId) {
    await prisma.whiteboardSession.update({ where: { id: session.whiteboardSessionId }, data: { youtubeStatus: "live" } });
  }
  out.state = session.state;
  out.becameLive = true;
  return out;
}

/**
 * End Class for an APP_YOUTUBE occurrence (called after markLiveSessionEnded
 * has moved it on): complete the broadcast, then return the stream to the
 * pool. A class ended before it ever went live gets its unused broadcast
 * deleted instead (a never-live broadcast can't be completed).
 */
export async function finishAppYoutubeBroadcast(liveSessionId: string, endedBeforeLive: boolean) {
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  if (session.deliveryMode !== "APP_YOUTUBE" || !session.youtubeBroadcastId) {
    await releaseLeasesForSession(session.id);
    return;
  }
  const { transitionBroadcast, deleteLiveBroadcast } = await import("@/lib/youtube/live-broadcast");
  try {
    if (endedBeforeLive) await deleteLiveBroadcast(session.youtubeBroadcastId);
    else await transitionBroadcast(session.youtubeBroadcastId, "complete");
    await releaseLeasesForSession(session.id);
  } catch (err) {
    // Leave the lease in RELEASING; the stale-lease sweep returns it once
    // the class is past its end.
    const lease = await getActiveLease(session.id);
    if (lease) await markLease(lease.id, "RELEASING").catch(() => undefined);
    throw err;
  }
}

/** Pre-live states a class can be ended from without ever having gone live. */
export const PRE_LIVE_YOUTUBE_STATES = ["STARTING", "YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE"] as const;

const RECORDING_CHECK_INTERVAL_MS = 2 * 60_000;
const RECORDING_GIVE_UP_MS = 48 * 60 * 60_000;

/**
 * Asks YouTube whether this occurrence's recording is watchable — at most
 * once per 2 minutes per class no matter how many students open the replay
 * page (single-flight via a conditional update on recordingCheckedAt).
 * Only when YouTube reports the archive processed does Atomic set
 * recordingVideoId / READY and publish the lecture link.
 */
export async function checkRecordingReadiness(liveSessionId: string, opts: { force?: boolean } = {}): Promise<string> {
  const now = new Date();
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  if (session.state !== "RECORDING_PROCESSING" || !session.youtubeVideoId) return session.state;

  if (!opts.force) {
    const claimed = await prisma.liveSession.updateMany({
      where: {
        id: session.id,
        OR: [{ recordingCheckedAt: null }, { recordingCheckedAt: { lt: new Date(now.getTime() - RECORDING_CHECK_INTERVAL_MS) } }],
      },
      data: { recordingCheckedAt: now },
    });
    if (claimed.count === 0) return session.state;
  }

  const { getYoutubeVideoInfo } = await import("@/lib/youtube/client");
  const channel = session.youtubeChannel ?? "APP"; // EXTERNAL ids are read with APP credentials (read-only)
  const info = await getYoutubeVideoInfo(channel, session.youtubeVideoId);
  const endedAt = session.actualEndedAt ?? session.stateChangedAt;

  if (!info || info.uploadStatus === "failed" || info.uploadStatus === "rejected" || info.uploadStatus === "deleted") {
    if (info || now.getTime() - endedAt.getTime() > RECORDING_GIVE_UP_MS) {
      await transitionLiveSession(session.id, "FAILED", { failureReason: info ? `recording_${info.uploadStatus}` : "recording_not_found" });
      return "FAILED";
    }
    return session.state;
  }

  const archiveReady = info.uploadStatus === "processed" && info.liveBroadcastContent === "none";
  if (!archiveReady) {
    if (now.getTime() - endedAt.getTime() > RECORDING_GIVE_UP_MS) {
      await transitionLiveSession(session.id, "FAILED", { failureReason: "recording_not_ready_48h" });
      return "FAILED";
    }
    return session.state;
  }

  await transitionLiveSession(session.id, "RECORDING_READY", { recordingVideoId: info.videoId });
  if (session.whiteboardSessionId) {
    await prisma.whiteboardSession.update({
      where: { id: session.whiteboardSessionId },
      data: { recordingStatus: "READY", recordingVideoId: info.videoId },
    });
  }
  const schedule = await prisma.batchSchedule.findUnique({ where: { id: session.batchScheduleId }, select: { lectureId: true } });
  if (schedule?.lectureId) {
    await prisma.lecture
      .update({ where: { id: schedule.lectureId }, data: { videoUrl: `https://www.youtube.com/watch?v=${info.videoId}`, status: "PUBLISHED" } })
      .catch((err) => console.warn("[recording_ready_lecture_update_warning]", err));
  }
  await transitionLiveSession(session.id, "COMPLETED");
  return "RECORDING_READY";
}
