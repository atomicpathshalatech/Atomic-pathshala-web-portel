import "server-only";
import { prisma } from "@/lib/db";
import { APP_BLOCKS, LAST_COLUMN, LECTURE_SHEET_COLUMNS, col, letter, sheetTab, type LectureSheetColumn } from "./columns";
import type { SheetsClient } from "./sheets-client";
import { checkYoutubeVideo, type VideoCheck } from "./verify-video";
import { parseYoutubeVideoInput, youtubeWatchUrl } from "./youtube-input";

/**
 * Two-way sync between scheduled classes and the lecture-mapping Sheet.
 *
 *  App → Sheet (pushLectures): every class gets one row, found again by its
 *  lecture_id (= the class id), so an edited class updates its row and never
 *  makes a second one. Only app columns are written; a value a person typed
 *  in a person column is never overwritten.
 *
 *  Sheet → App (applyVideoMapping / pullMappings): a YouTube link or id typed
 *  in a row is checked (valid link, the class exists, the video can be played
 *  in the app) and stored on that class. Every attempt is logged; a link that
 *  would replace the class's own live video is refused, not applied.
 *
 * The database stays the source of truth for classes, batches and access.
 */

const IST = "Asia/Kolkata";
const PUSH_WINDOW_DAYS = 90;
const PUSH_BATCH = 300;

const SCHEDULE_SELECT = {
  id: true,
  title: true,
  subject: true,
  status: true,
  type: true,
  isTest: true,
  startsAt: true,
  updatedAt: true,
  youtubeUrl: true,
  classMode: true,
  batchId: true,
  batch: { select: { name: true } },
  chapterId: true,
  chapter: { select: { title: true, subject: { select: { title: true } } } },
  lecture: { select: { order: true } },
  teacherId: true,
  teacher: { select: { user: { select: { name: true } } } },
  liveWhiteboardSession: {
    select: { youtubeVideoId: true, youtubeBroadcastId: true, videoTransport: true, livePhase: true, actualStartedAt: true, updatedAt: true },
  },
  sheetRow: { select: { rowNumber: true, status: true, lastSyncedAt: true, attempts: true } },
} as const;

type ScheduleForSheet = NonNullable<Awaited<ReturnType<typeof loadSchedule>>>;

function loadSchedule(id: string) {
  return prisma.batchSchedule.findUnique({ where: { id }, select: SCHEDULE_SELECT });
}

/** The video a class plays: its own live video, or one linked from the Sheet. */
export function classVideoId(s: { youtubeUrl: string | null; liveWhiteboardSession: { youtubeVideoId: string | null } | null }): string | null {
  return s.liveWhiteboardSession?.youtubeVideoId || parseYoutubeVideoInput(s.youtubeUrl);
}

function classMode(s: ScheduleForSheet): string {
  if (s.classMode) return s.classMode; // chosen when the class was scheduled
  const wb = s.liveWhiteboardSession;
  if (wb?.youtubeBroadcastId) return "APP_ONLY"; // the class's own unlisted broadcast
  if (wb?.youtubeVideoId || s.youtubeUrl) return "APP_AND_YOUTUBE"; // a public YouTube video, also played in the app
  if (wb?.videoTransport === "LIVEKIT" && wb.actualStartedAt) return "APP_ONLY"; // the app's own video room
  return "";
}

function lectureNumber(s: ScheduleForSheet): string {
  if (s.lecture?.order && s.lecture.order > 0) return String(s.lecture.order).padStart(2, "0");
  const m = s.title.match(/lecture\s*[-:#]?\s*0*(\d+)/i);
  return m ? m[1]!.padStart(2, "0") : "";
}

function recordingStatus(s: ScheduleForSheet, lastApplied: { videoId: string | null } | null, now: Date): string {
  if (s.status === "CANCELLED") return "CANCELLED";
  const live = s.liveWhiteboardSession?.livePhase === "LIVE" || s.status === "LIVE";
  if (live) return "LIVE";
  const video = classVideoId(s);
  if (!video) return s.startsAt > now ? "SCHEDULED" : "NO_VIDEO";
  // READY only when this exact video was checked playable when it was linked.
  return lastApplied?.videoId === video ? "READY" : "VIDEO_LINKED";
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST }); // 2026-10-14
const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" }); // 15:30
const stamp = (d: Date) => `${fmtDate(d)} ${d.toLocaleTimeString("en-GB", { timeZone: IST })} IST`;

/** App-column values for a class (person columns are left undefined). */
export function appValues(
  s: ScheduleForSheet,
  ctx: { now: Date; lastLog: { status: string; reason: string | null; input: string } | null; lastApplied: { videoId: string | null } | null }
): Partial<Record<LectureSheetColumn, string>> {
  const syncStatus =
    ctx.lastLog && ctx.lastLog.status === "REJECTED"
      ? `REJECTED: ${ctx.lastLog.reason ?? "invalid link"} (${ctx.lastLog.input.slice(0, 60)})`
      : "SYNCED";
  return {
    lecture_id: s.id,
    batch_id: s.batchId,
    batch_name: s.batch.name,
    subject: s.chapter?.subject.title ?? s.subject ?? "",
    chapter_id: s.chapterId ?? "",
    chapter_name: s.chapter?.title ?? "",
    lecture_number: lectureNumber(s),
    lecture_title: s.title,
    teacher_id: s.teacherId ?? "",
    teacher_name: s.teacher?.user.name ?? "",
    scheduled_date: fmtDate(s.startsAt),
    scheduled_time: fmtTime(s.startsAt),
    class_mode: classMode(s),
    recording_status: recordingStatus(s, ctx.lastApplied, ctx.now),
    sync_status: syncStatus,
    last_synced_at: stamp(ctx.now),
  };
}

/** Person columns the app may fill while they are still empty (the class's own video). */
function fillIfEmpty(s: ScheduleForSheet): Partial<Record<LectureSheetColumn, string>> {
  const video = classVideoId(s);
  if (!video) return {};
  const own = Boolean(s.liveWhiteboardSession?.youtubeBroadcastId);
  return {
    youtube_video_id: video,
    youtube_video_url: youtubeWatchUrl(video),
    ...(own ? { video_visibility: "unlisted", youtube_channel: "Atomic Pathshala (app channel)" } : {}),
  };
}

async function ensureHeader(client: SheetsClient, tab: string, firstRow: string[] | undefined) {
  const want = [...LECTURE_SHEET_COLUMNS];
  if (firstRow && want.every((h, i) => (firstRow[i] ?? "").trim() === h)) return;
  if (firstRow && firstRow.some((c) => c.trim()) && (firstRow[0] ?? "").trim() !== "lecture_id") {
    throw new Error(`Row 1 of the "${tab}" tab is not the lecture header. Use an empty tab named "${tab}" for this integration.`);
  }
  await client.writeMany([{ range: `${tab}!A1:${LAST_COLUMN}1`, values: [want] }]);
}

async function latestLogs(scheduleIds: string[]) {
  const logs = await prisma.lectureVideoMapping.findMany({
    where: { scheduleId: { in: scheduleIds } },
    orderBy: { createdAt: "desc" },
    select: { scheduleId: true, status: true, reason: true, input: true, videoId: true },
  });
  const last = new Map<string, (typeof logs)[number]>();
  const lastApplied = new Map<string, (typeof logs)[number]>();
  for (const l of logs) {
    if (!l.scheduleId) continue;
    if (!last.has(l.scheduleId)) last.set(l.scheduleId, l);
    if (l.status === "APPLIED" && !lastApplied.has(l.scheduleId)) lastApplied.set(l.scheduleId, l);
  }
  return { last, lastApplied };
}

/**
 * Writes the given classes (or every class that changed since its last sync)
 * to the Sheet. Safe to run again: rows are matched by lecture_id.
 */
export async function pushLectures(client: SheetsClient, opts: { scheduleIds?: string[]; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const tab = sheetTab();

  let schedules: ScheduleForSheet[];
  if (opts.scheduleIds) {
    schedules = (await prisma.batchSchedule.findMany({ where: { id: { in: opts.scheduleIds }, type: "LIVE_CLASS" }, select: SCHEDULE_SELECT })) as ScheduleForSheet[];
  } else {
    const since = new Date(now.getTime() - PUSH_WINDOW_DAYS * 86_400_000);
    const candidates = (await prisma.batchSchedule.findMany({
      where: { type: "LIVE_CLASS", isTest: false, startsAt: { gte: since } },
      select: SCHEDULE_SELECT,
      orderBy: { startsAt: "asc" },
    })) as ScheduleForSheet[];
    schedules = candidates
      .filter((s) => {
        const row = s.sheetRow;
        if (!row || row.status !== "SYNCED" || !row.lastSyncedAt) return !row || row.attempts < 20;
        const changedAt = Math.max(s.updatedAt.getTime(), s.liveWhiteboardSession?.updatedAt.getTime() ?? 0);
        return changedAt > row.lastSyncedAt.getTime();
      })
      .slice(0, PUSH_BATCH);
  }
  if (schedules.length === 0) return { written: 0, appended: 0, failed: 0 };

  try {
    await client.ensureTab(tab);
    const sheet = await client.read(`${tab}!A1:${LAST_COLUMN}`);
    await ensureHeader(client, tab, sheet[0]);

    const rowOf = new Map<string, number>();
    sheet.forEach((r, i) => {
      const id = (r[0] ?? "").trim();
      if (i > 0 && id && !rowOf.has(id)) rowOf.set(id, i + 1);
    });

    const { last, lastApplied } = await latestLogs(schedules.map((s) => s.id));
    const writes: { range: string; values: string[][] }[] = [];
    const toAppend: { s: ScheduleForSheet; values: string[] }[] = [];

    for (const s of schedules) {
      const app = appValues(s, { now, lastLog: last.get(s.id) ?? null, lastApplied: lastApplied.get(s.id) ?? null });
      const fill = fillIfEmpty(s);
      const rowNumber = rowOf.get(s.id);
      if (rowNumber) {
        for (const [from, to] of APP_BLOCKS) {
          const names = LECTURE_SHEET_COLUMNS.slice(col(from), col(to) + 1);
          writes.push({ range: `${tab}!${letter(col(from))}${rowNumber}:${letter(col(to))}${rowNumber}`, values: [names.map((n) => app[n] ?? "")] });
        }
        const existing = sheet[rowNumber - 1] ?? [];
        for (const [name, value] of Object.entries(fill) as [LectureSheetColumn, string][]) {
          if (!(existing[col(name)] ?? "").trim()) writes.push({ range: `${tab}!${letter(col(name))}${rowNumber}`, values: [[value]] });
        }
      } else {
        toAppend.push({ s, values: LECTURE_SHEET_COLUMNS.map((n) => app[n] ?? fill[n] ?? "") });
      }
    }

    await client.writeMany(writes);
    let firstNew = -1;
    if (toAppend.length) firstNew = await client.append(tab, toAppend.map((a) => a.values));

    await prisma.$transaction(
      schedules.map((s) => {
        const appendedAt = toAppend.findIndex((a) => a.s.id === s.id);
        const rowNumber = rowOf.get(s.id) ?? (appendedAt >= 0 && firstNew > 0 ? firstNew + appendedAt : null);
        return prisma.lectureSheetRow.upsert({
          where: { scheduleId: s.id },
          create: { scheduleId: s.id, rowNumber, status: "SYNCED", lastSyncedAt: now, attempts: 0 },
          update: { rowNumber, status: "SYNCED", lastSyncedAt: now, lastError: null, attempts: 0 },
        });
      })
    );
    return { written: schedules.length - toAppend.length, appended: toAppend.length, failed: 0 };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    console.error("[lecture_sheet_push_failed]", message);
    for (const s of schedules) {
      await prisma.lectureSheetRow
        .upsert({
          where: { scheduleId: s.id },
          create: { scheduleId: s.id, status: "FAILED", lastError: message, attempts: 1 },
          update: { status: "FAILED", lastError: message, attempts: { increment: 1 } },
        })
        .catch(() => undefined);
    }
    return { written: 0, appended: 0, failed: schedules.length, error: message };
  }
}

export type MappingResult = { status: "APPLIED" | "UNCHANGED" | "REJECTED"; reason?: string; videoId?: string; scheduleId?: string };

/**
 * Links a YouTube video typed in the Sheet to its class. Nothing is changed
 * unless the link is valid, the class exists and the video can be played in
 * the app; every attempt is logged.
 */
export async function applyVideoMapping(args: {
  lectureRef: string;
  inputs: { videoId?: string | null; videoUrl?: string | null; liveUrl?: string | null };
  source: "SHEET_WEBHOOK" | "SHEET_PULL";
  check?: (videoId: string) => Promise<VideoCheck>;
}): Promise<MappingResult> {
  const lectureRef = (args.lectureRef ?? "").trim();
  const typed = [args.inputs.videoUrl, args.inputs.videoId, args.inputs.liveUrl].map((v) => (v ?? "").trim()).find(Boolean) ?? "";
  const check = args.check ?? ((id: string) => checkYoutubeVideo(id));

  const log = async (r: MappingResult & { previousUrl?: string | null }, scheduleId: string | null) => {
    // The same rejected value is logged once, not on every sync.
    if (r.status === "REJECTED" && scheduleId) {
      const prev = await prisma.lectureVideoMapping.findFirst({ where: { scheduleId }, orderBy: { createdAt: "desc" }, select: { status: true, input: true, reason: true } });
      if (prev?.status === "REJECTED" && prev.input === typed && prev.reason === r.reason) return;
    }
    if (r.status === "UNCHANGED") return;
    await prisma.lectureVideoMapping.create({
      data: { scheduleId, lectureRef: lectureRef.slice(0, 100), input: typed.slice(0, 500), videoId: r.videoId ?? null, status: r.status, reason: r.reason ?? null, source: args.source, previousUrl: r.previousUrl ?? null },
    });
  };
  const reject = async (reason: string, scheduleId: string | null = null, videoId?: string): Promise<MappingResult> => {
    const r: MappingResult = { status: "REJECTED", reason, videoId, scheduleId: scheduleId ?? undefined };
    await log(r, scheduleId);
    return r;
  };

  if (!lectureRef) return reject("the row has no lecture_id");
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: lectureRef },
    select: { id: true, type: true, youtubeUrl: true, liveWhiteboardSession: { select: { youtubeVideoId: true } } },
  });
  if (!schedule) return reject("no class with this lecture_id");
  if (schedule.type !== "LIVE_CLASS") return reject("this lecture_id is not a class", schedule.id);
  if (!typed) return { status: "UNCHANGED", scheduleId: schedule.id };

  const filled = [args.inputs.videoUrl, args.inputs.videoId, args.inputs.liveUrl].map((v) => (v ?? "").trim()).filter(Boolean);
  const ids = filled.map((v) => parseYoutubeVideoInput(v));
  if (ids.some((v) => !v)) return reject("not a YouTube video link or id", schedule.id);
  // The id and the links of one row must name the same video; otherwise nobody can tell which was meant.
  if (new Set(ids).size > 1) return reject("the video id and link(s) in this row are different videos — make them the same or clear the old one", schedule.id);
  const videoId = ids[0]!;

  const own = schedule.liveWhiteboardSession?.youtubeVideoId ?? null;
  if (own && own !== videoId) {
    return reject(`this class already has its own live video (${own}); it is not replaced from the Sheet`, schedule.id, videoId);
  }
  if (classVideoId(schedule) === videoId) return { status: "UNCHANGED", videoId, scheduleId: schedule.id };

  const state = await check(videoId);
  if (state === "UNAVAILABLE") return reject("the video is private, deleted or does not exist", schedule.id, videoId);
  if (state === "NOT_EMBEDDABLE") return reject("embedding is turned off for this video, so students cannot play it in the app", schedule.id, videoId);
  if (state === "UNKNOWN") return reject("YouTube could not be reached to check the video; it is tried again on the next sync", schedule.id, videoId);

  const previousUrl = schedule.youtubeUrl;
  await prisma.batchSchedule.update({ where: { id: schedule.id }, data: { youtubeUrl: youtubeWatchUrl(videoId) } });
  const r: MappingResult = { status: "APPLIED", videoId, scheduleId: schedule.id };
  await log({ ...r, previousUrl }, schedule.id);
  return r;
}

/** Reads the person columns of every row and applies the links that differ from what the class has. */
export async function pullMappings(client: SheetsClient, opts: { check?: (videoId: string) => Promise<VideoCheck> } = {}) {
  const tab = sheetTab();
  const rows = await client.read(`${tab}!A2:${LAST_COLUMN}`);
  const touched: string[] = [];
  const counts = { applied: 0, rejected: 0, unchanged: 0 };
  for (const r of rows) {
    const lectureRef = (r[col("lecture_id")] ?? "").trim();
    const inputs = { videoId: r[col("youtube_video_id")], videoUrl: r[col("youtube_video_url")], liveUrl: r[col("youtube_live_url")] };
    if (!lectureRef || ![inputs.videoId, inputs.videoUrl, inputs.liveUrl].some((v) => (v ?? "").trim())) continue;
    const res = await applyVideoMapping({ lectureRef, inputs, source: "SHEET_PULL", check: opts.check });
    if (res.status === "APPLIED") counts.applied++;
    else if (res.status === "REJECTED") counts.rejected++;
    else counts.unchanged++;
    if (res.scheduleId && res.status !== "UNCHANGED") touched.push(res.scheduleId);
  }
  return { ...counts, touched };
}

/** Full round: classes → Sheet, links → classes, then the touched rows again (their status). */
export async function syncLectureSheet(client: SheetsClient, opts: { check?: (videoId: string) => Promise<VideoCheck> } = {}) {
  const pushed = await pushLectures(client);
  const pulled = await pullMappings(client, opts);
  const refreshed = pulled.touched.length ? await pushLectures(client, { scheduleIds: pulled.touched }) : null;
  return { pushed, pulled: { applied: pulled.applied, rejected: pulled.rejected, unchanged: pulled.unchanged }, refreshed };
}
