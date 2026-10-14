// Tests of the lecture Sheet sync with an in-memory Sheet, on a LOCAL database only.
//   DATABASE_URL=postgresql://postgres@localhost:5433/qc_test node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/test-lecture-sheet.ts
import "./qc/_stub";
import { prisma } from "../src/lib/db";
import { LECTURE_SHEET_COLUMNS, col } from "../src/lib/lecture-sheet/columns";
import { parseYoutubeVideoInput } from "../src/lib/lecture-sheet/youtube-input";
import { signBody, verifySignedRequest } from "../src/lib/lecture-sheet/signature";
import { pushLectures, pullMappings, syncLectureSheet } from "../src/lib/lecture-sheet/sync";
import type { SheetsClient } from "../src/lib/lecture-sheet/sheets-client";

let pass = 0, fail = 0;
const check = (ok: boolean, name: string, detail?: unknown) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : " → " + JSON.stringify(detail)}`); };

/** A Sheet in memory, implementing the same calls as the Google client. */
function fakeSheet(): SheetsClient & { grid: string[][] } {
  const grid: string[][] = [];
  const colIndex = (l: string) => l.charCodeAt(0) - 65;
  const parse = (range: string) => {
    const m = range.match(/!([A-Z])(\d+)(?::([A-Z])(\d*))?$/)!;
    return { c1: colIndex(m[1]!), r1: Number(m[2]), c2: m[3] ? colIndex(m[3]) : colIndex(m[1]!), r2: m[4] ? Number(m[4]) : m[3] ? Infinity : Number(m[2]) };
  };
  return {
    grid,
    async ensureTab() {},
    async read(range) {
      const { c1, r1, c2 } = parse(range);
      return grid.slice(r1 - 1).map((row) => Array.from({ length: c2 - c1 + 1 }, (_, i) => row[c1 + i] ?? ""));
    },
    async writeMany(data) {
      for (const { range, values } of data) {
        const { c1, r1 } = parse(range);
        values.forEach((vals, dr) => {
          const row = (grid[r1 - 1 + dr] ??= []);
          vals.forEach((v, dc) => (row[c1 + dc] = v));
        });
      }
    },
    async append(_tab, rows) {
      let last = grid.length;
      while (last > 0 && !(grid[last - 1] ?? []).some((c) => c)) last--;
      rows.forEach((r, i) => (grid[last + i] = [...r]));
      return last + 1;
    },
  };
}

(async () => {
  if (!/localhost/.test(process.env.DATABASE_URL ?? "")) throw new Error("local database only");

  // --- link parsing
  const id = "dQ4w9WgXcQ1";
  for (const [input, want] of [
    [id, id],
    [`https://www.youtube.com/watch?v=${id}`, id],
    [`https://youtube.com/watch?feature=share&v=${id}&t=30s`, id],
    [`https://youtu.be/${id}?si=abc`, id],
    [`https://www.youtube.com/live/${id}?si=x`, id],
    [`https://m.youtube.com/watch?v=${id}`, id],
    [`https://www.youtube.com/shorts/${id}`, id],
    [`https://www.youtube.com/embed/${id}`, id],
    [`youtube.com/watch?v=${id}`, id],
    ["https://vimeo.com/123", null],
    ["https://www.youtube.com/@channel", null],
    ["not a link", null],
    [`https://evil.com/watch?v=${id}`, null],
  ] as const) {
    check(parseYoutubeVideoInput(input) === want, `link "${input.slice(0, 50)}" → ${want}`, parseYoutubeVideoInput(input));
  }

  // --- webhook signature
  const secret = "test-secret", body = '{"lecture_id":"x"}', ts = String(Math.floor(Date.now() / 1000));
  const sig = signBody(secret, ts, body);
  check(verifySignedRequest({ secret, timestamp: ts, signature: sig, rawBody: body }).ok, "a correctly signed request is accepted");
  check(!verifySignedRequest({ secret, timestamp: ts, signature: sig, rawBody: body + " " }).ok, "a changed body is refused");
  check(!verifySignedRequest({ secret, timestamp: String(Number(ts) - 600), signature: signBody(secret, String(Number(ts) - 600), body), rawBody: body }).ok, "a 10-minute-old request is refused");
  check(!verifySignedRequest({ secret: undefined, timestamp: ts, signature: sig, rawBody: body }).ok, "no secret on the server → refused");
  check(!verifySignedRequest({ secret, timestamp: ts, signature: signBody("other", ts, body), rawBody: body }).ok, "wrong secret → refused");

  // --- fixtures
  const user = await prisma.user.findFirstOrThrow({ where: { email: "qc-test@example.test" } });
  const teacher = (await prisma.teacher.findUnique({ where: { userId: user.id } }))!;
  const chapter = await prisma.chapter.findFirstOrThrow({ where: { title: "Exam Fixture" } });
  await prisma.batch.deleteMany({ where: { code: "SHEET-TEST" } });
  await prisma.lectureVideoMapping.deleteMany({});
  await prisma.lectureSheetRow.deleteMany({});
  // Only this test's classes are in the push window.
  await prisma.batchSchedule.updateMany({ where: { type: "LIVE_CLASS" }, data: { isTest: true } });
  const batch = await prisma.batch.create({ data: { name: "Sheet Test Batch", code: "SHEET-TEST", createdById: user.id } as never });
  const mk = (title: string, hoursFromNow: number) =>
    prisma.batchSchedule.create({ data: { batchId: batch.id, title, type: "LIVE_CLASS", subject: "Physics", chapterId: chapter.id, teacherId: teacher.id, startsAt: new Date(Date.now() + hoursFromNow * 3600e3), endsAt: new Date(Date.now() + (hoursFromNow + 1) * 3600e3), createdById: user.id } as never });
  const a = await mk("Motion — Lecture 03", 24);
  const b = await mk("Motion — Lecture 04", 48);
  const c = await mk("Motion — Lecture 05", -24);
  await prisma.whiteboardSession.create({ data: { batchScheduleId: c.id, teacherId: teacher.id, title: c.title, youtubeVideoId: "OWNvideo001", youtubeBroadcastId: "OWNvideo001", status: "ENDED", livePhase: "ENDED" } as never });

  const sheet = fakeSheet();
  const okCheck = async () => "OK" as const;

  // --- push: rows appear once, with the class id
  let r = await pushLectures(sheet);
  check(r.appended === 3 && r.failed === 0, "three classes are added to the Sheet", r);
  check(JSON.stringify(sheet.grid[0]) === JSON.stringify([...LECTURE_SHEET_COLUMNS]), "the header row is written");
  const rowOf = (sid: string) => sheet.grid.findIndex((row) => row[0] === sid);
  const ra = rowOf(a.id);
  check(ra > 0 && sheet.grid[ra]![col("lecture_number")] === "03" && sheet.grid[ra]![col("batch_name")] === "Sheet Test Batch" && sheet.grid[ra]![col("teacher_id")] === teacher.id, "row has the class id, batch, teacher and lecture number", sheet.grid[ra]);
  const rc = rowOf(c.id);
  check(sheet.grid[rc]![col("youtube_video_id")] === "OWNvideo001" && sheet.grid[rc]![col("class_mode")] === "APP_ONLY" && sheet.grid[rc]![col("video_visibility")] === "unlisted", "a class with its own broadcast shows its video, APP_ONLY, unlisted", sheet.grid[rc]);

  r = await pushLectures(sheet);
  check(r.appended === 0 && r.written === 0 && sheet.grid.length === 4, "a second sync with no change does nothing", { r, rows: sheet.grid.length });

  // --- edit: the same row is updated, no duplicate
  await prisma.batchSchedule.update({ where: { id: a.id }, data: { startsAt: new Date("2026-12-01T05:30:00Z"), title: "Motion — Lecture 03 (rescheduled)" } });
  sheet.grid[ra]![col("notes")] = "teacher note";
  r = await pushLectures(sheet);
  check(r.written === 1 && r.appended === 0 && sheet.grid.length === 4, "an edited class updates its own row (no duplicate)", { r, rows: sheet.grid.length });
  check(sheet.grid[ra]![col("scheduled_date")] === "2026-12-01" && sheet.grid[ra]![col("scheduled_time")] === "11:00" && sheet.grid[ra]![col("notes")] === "teacher note", "new date/time written (IST), the person's note kept", sheet.grid[ra]);

  // --- Sheet → app: a valid link
  const rb = rowOf(b.id);
  sheet.grid[rb]![col("youtube_video_url")] = `https://youtu.be/${id}?si=zz`;
  let s = await syncLectureSheet(sheet, { check: okCheck });
  const bNow = await prisma.batchSchedule.findUniqueOrThrow({ where: { id: b.id } });
  check(s.pulled.applied === 1 && bNow.youtubeUrl === `https://www.youtube.com/watch?v=${id}`, "a valid link is stored on exactly that class", { s, url: bNow.youtubeUrl });
  check(sheet.grid[rb]![col("youtube_video_url")] === `https://youtu.be/${id}?si=zz` && sheet.grid[rb]![col("sync_status")] === "SYNCED", "the typed link is left as typed; status SYNCED", sheet.grid[rb]);
  check((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: a.id } })).youtubeUrl === null, "no other class was changed");

  s = await syncLectureSheet(sheet, { check: okCheck });
  check(s.pulled.applied === 0 && (await prisma.lectureVideoMapping.count({ where: { scheduleId: b.id } })) === 1, "syncing again does not apply or log it twice", s);

  // --- rejected inputs
  sheet.grid[ra]![col("youtube_video_url")] = "https://vimeo.com/999";
  await syncLectureSheet(sheet, { check: okCheck });
  check((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: a.id } })).youtubeUrl === null && sheet.grid[ra]![col("sync_status")].startsWith("REJECTED: not a YouTube"), "an invalid link is refused and the row says why", sheet.grid[ra]![col("sync_status")]);
  await syncLectureSheet(sheet, { check: okCheck });
  check((await prisma.lectureVideoMapping.count({ where: { scheduleId: a.id, status: "REJECTED" } })) === 1, "the same refused link is logged once, not on every sync");

  sheet.grid[ra]![col("youtube_video_url")] = `https://youtu.be/${id}`;
  await syncLectureSheet(sheet, { check: async () => "NOT_EMBEDDABLE" });
  check((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: a.id } })).youtubeUrl === null, "a video that cannot be embedded is refused");
  await syncLectureSheet(sheet, { check: async () => "UNAVAILABLE" });
  check((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: a.id } })).youtubeUrl === null, "a private/deleted video is refused");

  sheet.grid[ra]![col("youtube_video_url")] = "";
  sheet.grid[rc]![col("youtube_video_id")] = "OTHERvid001";
  sheet.grid[rc]![col("youtube_video_url")] = "https://youtu.be/OTHERvid001";
  await syncLectureSheet(sheet, { check: okCheck });
  check((await prisma.whiteboardSession.findUniqueOrThrow({ where: { batchScheduleId: c.id } })).youtubeVideoId === "OWNvideo001" && sheet.grid[rc]![col("sync_status")].includes("already has its own live video"), "a class's own live video is not replaced from the Sheet", sheet.grid[rc]![col("sync_status")]);

  sheet.grid[rb]![col("youtube_video_id")] = "ZZZZZZZZZZZ";
  await syncLectureSheet(sheet, { check: okCheck });
  check((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: b.id } })).youtubeUrl === `https://www.youtube.com/watch?v=${id}` && sheet.grid[rb]![col("sync_status")].includes("different videos"), "a row whose id and link name different videos is refused (nothing changed)", sheet.grid[rb]![col("sync_status")]);
  sheet.grid[rb]![col("youtube_video_id")] = id;

  sheet.grid.push(["not-a-real-class-id", "", "", "", "", "", "", "", "", "", "", "", "", "", `https://youtu.be/${id}`]);
  const p = await pullMappings(sheet, { check: okCheck });
  check(p.rejected >= 1 && (await prisma.lectureVideoMapping.count({ where: { lectureRef: "not-a-real-class-id", status: "REJECTED" } })) === 1, "an unknown lecture_id is refused and logged", p);

  // --- recording status after a verified link
  await pushLectures(sheet, { scheduleIds: [b.id] });
  check(sheet.grid[rb]![col("recording_status")] === "READY", "a checked, linked video shows READY", sheet.grid[rb]![col("recording_status")]);
  check(sheet.grid[ra]![col("recording_status")] === "SCHEDULED", "a future class without video shows SCHEDULED", sheet.grid[ra]![col("recording_status")]);

  // --- a failing Sheet is recorded and retried
  const broken: SheetsClient = { ...sheet, read: async () => { throw new Error("quota exceeded"); } };
  await prisma.batchSchedule.update({ where: { id: a.id }, data: { title: "Motion — Lecture 03 (again)" } });
  const f = await pushLectures(broken);
  const row = await prisma.lectureSheetRow.findUniqueOrThrow({ where: { scheduleId: a.id } });
  check(f.failed === 1 && row.status === "FAILED" && row.lastError === "quota exceeded", "a Sheet error marks the row FAILED with the reason", { f, row });
  const again = await pushLectures(sheet);
  check(again.written === 1 && (await prisma.lectureSheetRow.findUniqueOrThrow({ where: { scheduleId: a.id } })).status === "SYNCED", "the next sync retries it and succeeds", again);

  await prisma.batch.delete({ where: { id: batch.id } });
  await prisma.batchSchedule.updateMany({ where: { type: "LIVE_CLASS" }, data: { isTest: false } });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
