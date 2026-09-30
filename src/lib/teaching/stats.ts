import "server-only";
import { prisma } from "@/lib/db";
import { parseYouTubeVideoId } from "@/lib/youtube/video-link";

/**
 * A teacher's ACTUAL teaching time and reach — never the scheduled time.
 *
 *   App class      → each live occurrence's real start → real end
 *                    (LiveSession; older classes: WhiteboardSession).
 *   YouTube class  → the real length of the video (a recorded class added
 *                    with "Add Past Class"), from YouTube itself.
 *   A class counts once: a lecture whose class ran in the app is counted by
 *   the app time, not again by its video.
 *
 * Views = YouTube views of the teacher's class videos (plays inside the app
 * are part of YouTube's count, since the app embeds YouTube) + app views of
 * classes that never went through YouTube (LiveKit classes, app-stored
 * recordings). So nothing is counted twice.
 */

/**
 * Until `prisma migrate deploy` has created the newer tables
 * (youtube_video_stats, video_watches), read them as empty instead of
 * failing the page — profiles and the teacher dashboard use these numbers.
 * Any other error still throws.
 */
export async function missingTableAsEmpty<T>(query: Promise<T>, empty: T): Promise<T> {
  try {
    return await query;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2021") {
      console.warn("[teaching_stats] table missing — run prisma migrate deploy", (err as { meta?: unknown }).meta);
      return empty;
    }
    throw err;
  }
}

/** A class left running for days must not count as days of teaching. */
export const MAX_CLASS_MINUTES = 6 * 60;

export function occurrenceMinutes(start: Date | null | undefined, end: Date | null | undefined): number {
  if (!start || !end) return 0;
  const min = (end.getTime() - start.getTime()) / 60_000;
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.min(MAX_CLASS_MINUTES, Math.round(min));
}

export interface TeacherTeachingStats {
  teacherId: string;
  appMinutes: number;
  youtubeMinutes: number;
  totalMinutes: number;
  appClasses: number;
  youtubeClasses: number;
  /** YouTube classes whose length YouTube hasn't reported yet (counted once it does). */
  youtubePending: number;
  youtubeViews: number;
  appViews: number;
  totalViews: number;
  videoCount: number;
}

function empty(teacherId: string): TeacherTeachingStats {
  return { teacherId, appMinutes: 0, youtubeMinutes: 0, totalMinutes: 0, appClasses: 0, youtubeClasses: 0, youtubePending: 0, youtubeViews: 0, appViews: 0, totalViews: 0, videoCount: 0 };
}

/** "54h 10m" */
export function formatTeachingTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export async function computeTeachingStats(opts: { teacherIds?: string[]; from?: Date; to?: Date } = {}): Promise<Map<string, TeacherTeachingStats>> {
  const inTeachers = opts.teacherIds ? { in: opts.teacherIds } : undefined;
  const range = opts.from || opts.to ? { ...(opts.from && { gte: opts.from }), ...(opts.to && { lt: opts.to }) } : undefined;
  const out = new Map<string, TeacherTeachingStats>();
  const get = (id: string) => {
    let s = out.get(id);
    if (!s) out.set(id, (s = empty(id)));
    return s;
  };
  for (const id of opts.teacherIds ?? []) get(id);
  // A class restarted (a second occurrence) is still one class taught.
  const taught = new Set<string>();
  const countClass = (teacherId: string, scheduleId: string) => {
    const key = `${teacherId}:${scheduleId}`;
    if (taught.has(key)) return;
    taught.add(key);
    get(teacherId).appClasses += 1;
  };

  // ---- App classes: every live occurrence that really started and ended ----
  const occurrences = await prisma.liveSession.findMany({
    where: {
      actualStartedAt: { not: null, ...(range ?? {}) },
      actualEndedAt: { not: null },
      batchSchedule: { isTest: false },
      ...(inTeachers && { controllingTeacherId: inTeachers }),
    },
    select: { batchScheduleId: true, controllingTeacherId: true, actualStartedAt: true, actualEndedAt: true },
  });
  const ranInApp = new Set<string>(); // batchScheduleIds taught in the app
  for (const o of occurrences) {
    const min = occurrenceMinutes(o.actualStartedAt, o.actualEndedAt);
    ranInApp.add(o.batchScheduleId);
    if (min <= 0) continue;
    get(o.controllingTeacherId).appMinutes += min;
    countClass(o.controllingTeacherId, o.batchScheduleId);
  }
  // Classes from before per-occurrence tracking: the room's own real times.
  const olderRooms = await prisma.whiteboardSession.findMany({
    where: {
      actualStartedAt: { not: null, ...(range ?? {}) },
      actualEndedAt: { not: null },
      batchSchedule: { isTest: false, liveSessions: { none: { actualStartedAt: { not: null } } } },
      ...(inTeachers && { teacherId: inTeachers }),
    },
    select: { batchScheduleId: true, teacherId: true, actualStartedAt: true, actualEndedAt: true },
  });
  for (const r of olderRooms) {
    const min = occurrenceMinutes(r.actualStartedAt, r.actualEndedAt);
    ranInApp.add(r.batchScheduleId);
    if (min <= 0) continue;
    get(r.teacherId).appMinutes += min;
    countClass(r.teacherId, r.batchScheduleId);
  }

  // ---- YouTube classes: published lectures with a YouTube video ----
  const lectures = await prisma.lecture.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ videoUrl: { contains: "youtube.com" } }, { videoUrl: { contains: "youtu.be" } }],
      ...(inTeachers && { teacherId: inTeachers }),
    },
    select: {
      teacherId: true,
      videoUrl: true,
      scheduledDate: true,
      createdAt: true,
      batchSchedules: {
        select: {
          id: true,
          liveSessions: { where: { actualStartedAt: { not: null } }, select: { id: true } },
          liveWhiteboardSession: { select: { actualStartedAt: true } },
        },
      },
    },
  });

  // ---- Every class video of each teacher (for views) ----
  const videosByTeacher = new Map<string, Set<string>>();
  const addVideo = (teacherId: string, id: string | null | undefined) => {
    const vid = id ? parseYouTubeVideoId(id) : null;
    if (!vid) return;
    let set = videosByTeacher.get(teacherId);
    if (!set) videosByTeacher.set(teacherId, (set = new Set()));
    set.add(vid);
  };

  const youtubeClassVideos: Array<{ teacherId: string; videoId: string }> = [];
  for (const l of lectures) {
    const videoId = parseYouTubeVideoId(l.videoUrl);
    if (!videoId) continue;
    addVideo(l.teacherId, videoId);
    const taughtInApp = l.batchSchedules.some((b) => ranInApp.has(b.id) || b.liveSessions.length > 0 || b.liveWhiteboardSession?.actualStartedAt);
    if (taughtInApp) continue;
    const when = l.scheduledDate ?? l.createdAt;
    if (opts.from && when < opts.from) continue;
    if (opts.to && when >= opts.to) continue;
    youtubeClassVideos.push({ teacherId: l.teacherId, videoId });
  }

  const [liveVideoRows, roomVideoRows] = await Promise.all([
    prisma.liveSession.findMany({
      where: { batchSchedule: { isTest: false }, ...(inTeachers && { controllingTeacherId: inTeachers }), OR: [{ youtubeVideoId: { not: null } }, { recordingVideoId: { not: null } }] },
      select: { controllingTeacherId: true, youtubeVideoId: true, recordingVideoId: true },
    }),
    prisma.whiteboardSession.findMany({
      where: { batchSchedule: { isTest: false }, ...(inTeachers && { teacherId: inTeachers }), OR: [{ youtubeVideoId: { not: null } }, { youtubeArchiveVideoId: { not: null } }] },
      select: { teacherId: true, youtubeVideoId: true, youtubeArchiveVideoId: true },
    }),
  ]);
  for (const r of liveVideoRows) {
    addVideo(r.controllingTeacherId, r.youtubeVideoId);
    addVideo(r.controllingTeacherId, r.recordingVideoId);
  }
  for (const r of roomVideoRows) {
    addVideo(r.teacherId, r.youtubeVideoId);
    addVideo(r.teacherId, r.youtubeArchiveVideoId);
  }

  const allIds = new Set<string>();
  for (const set of videosByTeacher.values()) for (const id of set) allIds.add(id);
  for (const v of youtubeClassVideos) allIds.add(v.videoId);
  const stats = allIds.size
    ? await missingTableAsEmpty(prisma.youtubeVideoStat.findMany({ where: { videoId: { in: Array.from(allIds) } }, select: { videoId: true, durationSec: true, viewCount: true } }), [])
    : [];
  const statById = new Map(stats.map((s) => [s.videoId, s]));

  // The same video added twice (e.g. two batches) is one class of teaching.
  const seenClass = new Set<string>();
  for (const v of youtubeClassVideos) {
    const key = `${v.teacherId}:${v.videoId}`;
    if (seenClass.has(key)) continue;
    seenClass.add(key);
    const s = get(v.teacherId);
    const dur = statById.get(v.videoId)?.durationSec;
    if (dur && dur > 0) {
      s.youtubeMinutes += Math.min(MAX_CLASS_MINUTES, Math.round(dur / 60));
      s.youtubeClasses += 1;
    } else {
      s.youtubePending += 1;
    }
  }
  for (const [teacherId, ids] of videosByTeacher) {
    const s = get(teacherId);
    s.videoCount = ids.size;
    for (const id of ids) s.youtubeViews += statById.get(id)?.viewCount ?? 0;
  }

  // ---- App views of classes that never went through YouTube ----
  const liveKitJoins = await prisma.liveClassAttendance.groupBy({
    by: ["whiteboardSessionId"],
    where: { whiteboardSession: { videoTransport: "LIVEKIT", batchSchedule: { isTest: false }, ...(inTeachers && { teacherId: inTeachers }) } },
    _count: { _all: true },
  });
  if (liveKitJoins.length) {
    const rooms = await prisma.whiteboardSession.findMany({ where: { id: { in: liveKitJoins.map((j) => j.whiteboardSessionId) } }, select: { id: true, teacherId: true } });
    const teacherOf = new Map(rooms.map((r) => [r.id, r.teacherId]));
    for (const j of liveKitJoins) {
      const t = teacherOf.get(j.whiteboardSessionId);
      if (t) get(t).appViews += j._count._all;
    }
  }
  const watches = await missingTableAsEmpty(prisma.videoWatch.findMany({
    where: {
      OR: [
        { lecture: { NOT: [{ videoUrl: { contains: "youtube.com" } }, { videoUrl: { contains: "youtu.be" } }], ...(inTeachers && { teacherId: inTeachers }) } },
        {
          lectureId: null,
          batchSchedule: {
            ...(inTeachers && { teacherId: inTeachers }),
            liveWhiteboardSession: { youtubeVideoId: null, youtubeArchiveVideoId: null },
          },
        },
      ],
    },
    select: { lecture: { select: { teacherId: true } }, batchSchedule: { select: { teacherId: true } } },
  }), []);
  for (const w of watches) {
    const t = w.lecture?.teacherId ?? w.batchSchedule?.teacherId;
    if (t) get(t).appViews += 1;
  }

  for (const s of out.values()) {
    s.totalMinutes = s.appMinutes + s.youtubeMinutes;
    s.totalViews = s.youtubeViews + s.appViews;
  }
  return out;
}

/** Every class video id in the system (for the daily YouTube stats refresh). */
export async function allClassVideoIds(): Promise<string[]> {
  const [lectures, live, rooms] = await Promise.all([
    prisma.lecture.findMany({ where: { OR: [{ videoUrl: { contains: "youtube.com" } }, { videoUrl: { contains: "youtu.be" } }] }, select: { videoUrl: true } }),
    prisma.liveSession.findMany({ where: { OR: [{ youtubeVideoId: { not: null } }, { recordingVideoId: { not: null } }] }, select: { youtubeVideoId: true, recordingVideoId: true } }),
    prisma.whiteboardSession.findMany({ where: { OR: [{ youtubeVideoId: { not: null } }, { youtubeArchiveVideoId: { not: null } }] }, select: { youtubeVideoId: true, youtubeArchiveVideoId: true } }),
  ]);
  const ids = new Set<string>();
  const add = (v: string | null | undefined) => {
    const id = v ? parseYouTubeVideoId(v) : null;
    if (id) ids.add(id);
  };
  lectures.forEach((l) => add(l.videoUrl));
  live.forEach((l) => (add(l.youtubeVideoId), add(l.recordingVideoId)));
  rooms.forEach((r) => (add(r.youtubeVideoId), add(r.youtubeArchiveVideoId)));
  return Array.from(ids);
}
