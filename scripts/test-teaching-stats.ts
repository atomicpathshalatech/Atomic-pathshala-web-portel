/**
 * Actual teaching time, views, student watch time and the Super Admin boards.
 *
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-teaching-stats.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";
import { allowedIncrement, parseContentKey, playedBetween } from "../src/lib/video/watch-time";
import { matchesActivity, pickDir, pickSort, sortRows } from "../src/lib/performance/sort";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ---- 1. Watch-time rules (pure) --------------------------------------------------
assert(parseContentKey("lecture:clx123abc")?.kind === "lecture" && parseContentKey("schedule:abc123-def")?.id === "abc123-def", "Watch key: lecture / schedule");
assert(parseContentKey("user:abc123") === null && parseContentKey("lecture:x") === null, "Watch key: anything else is refused");
assert(allowedIncrement(30, null) === 30 && allowedIncrement(500, null) === 45, "A beat adds what played, at most 45 s");
assert(allowedIncrement(30, 10_000) === 15, "Never more than the wall time since the last beat (+5 s) — two tabs can't double it");
assert(allowedIncrement(-5, null) === 0 && allowedIncrement(Number.NaN, null) === 0, "Nonsense adds nothing");
assert(playedBetween({ at: 0, pos: 10 }, { at: 5000, pos: 15 }) === 5, "Playing: wall time counts");
assert(playedBetween({ at: 0, pos: 10 }, { at: 5000, pos: 10 }) === 0, "Paused: nothing counts");
assert(playedBetween({ at: 0, pos: 10 }, { at: 5000, pos: 600 }) === 0, "A seek forward isn't watching");
assert(playedBetween({ at: 0, pos: 10 }, { at: 5000, pos: 20 }) === 5, "2x speed: wall time, not video time");
assert(playedBetween(null, { at: 5000, pos: 20 }) === 0, "First sample only starts the clock");

// ---- Sorting & filters for the boards (pure) ----
{
  type R = { name: string; mins: number; last: Date | null };
  const spec = { name: (r: R) => r.name, mins: (r: R) => r.mins, last: (r: R) => r.last };
  const rows: R[] = [
    { name: "banti", mins: 30, last: new Date("2026-09-01") },
    { name: "Amit", mins: 120, last: null },
    { name: "chetan", mins: 30, last: new Date("2026-09-20") },
  ];
  assert(sortRows(rows, spec, "mins", "desc").map((r) => r.name).join() === "Amit,banti,chetan", "Sort high→low (ties keep their order)");
  assert(sortRows(rows, spec, "mins", "asc").map((r) => r.name).join() === "banti,chetan,Amit", "Sort low→high");
  assert(sortRows(rows, spec, "name", "asc").map((r) => r.name).join() === "Amit,banti,chetan", "Sort by name A→Z, ignoring capitals");
  assert(sortRows(rows, spec, "last", "desc").map((r) => r.name).join() === "chetan,banti,Amit" && sortRows(rows, spec, "last", "asc").at(-1)?.name === "Amit", "Empty values (never) always go last, either direction");
  assert(pickSort(spec, "hack", "mins") === "mins" && pickSort(spec, "name", "mins") === "name" && pickDir("sideways") === "desc", "Unknown sort column / direction from the URL falls back");
  const now = new Date("2026-10-01T00:00:00Z").getTime();
  assert(matchesActivity(new Date("2026-09-28"), "7d", now) && !matchesActivity(new Date("2026-09-01"), "7d", now), "Active in last 7 days");
  assert(matchesActivity(new Date("2026-09-01"), "inactive7", now) && matchesActivity(null, "inactive7", now) && matchesActivity(null, "never", now) && !matchesActivity(new Date(), "never", now), "Inactive 7+ days / never active");
}

async function run() {
  prepareTestDatabase(testUrl, parsed);
  const { prisma } = await import("../src/lib/db");
  const { occurrenceMinutes, computeTeachingStats, allClassVideoIds, formatTeachingTime } = await import("../src/lib/teaching/stats");
  const { parseIsoDuration } = await import("../src/lib/youtube/video-stats");

  assert(parseIsoDuration("PT1H10M5S") === 4205 && parseIsoDuration("PT45M") === 2700 && parseIsoDuration("P1DT2H") === 93600 && parseIsoDuration("junk") === null, "YouTube durations read");
  assert(occurrenceMinutes(new Date(0), new Date(70 * 60_000)) === 70 && occurrenceMinutes(new Date(0), new Date(10 * 3_600_000)) === 360 && occurrenceMinutes(new Date(100), new Date(0)) === 0, "Class minutes: real, capped at 6 h, never negative");
  assert(formatTeachingTime(3250) === "54h 10m" && formatTeachingTime(45) === "45m", "Time format");

  // ---- 2. A teacher's actual teaching ----
  const admin = await prisma.user.create({ data: { email: "admin@t.local", passwordHash: "x", name: "Admin" } });
  const mk = async (name: string, code: string) => {
    const u = await prisma.user.create({ data: { email: `${code}@t.local`, passwordHash: "x", name } });
    return prisma.teacher.create({ data: { userId: u.id, employeeCode: code, department: "Biology" } });
  };
  const moaz = await mk("Md Moaz Ahmed", "T-1");
  const other = await mk("Other Teacher", "T-2");
  const course = await prisma.course.create({ data: { title: "NEET", slug: "neet" } });
  const subject = await prisma.subject.create({ data: { title: "Biology", courseId: course.id } });
  const chapter = await prisma.chapter.create({ data: { title: "Cell", subjectId: subject.id, status: "PUBLISHED" } });
  const batch = await prisma.batch.create({ data: { name: "July", code: "JUL", createdById: admin.id, courseId: course.id } });
  const t0 = new Date("2026-07-10T04:30:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const sched = (title: string, teacherId: string, extra: Record<string, unknown> = {}) =>
    prisma.batchSchedule.create({ data: { batchId: batch.id, title, teacherId, startsAt: t0, endsAt: at(60), createdById: admin.id, ...extra } });

  // App class scheduled 60 min, taught 70 min, then restarted for 20 more.
  const s1 = await sched("Cell L1", moaz.id);
  const wb1 = await prisma.whiteboardSession.create({ data: { batchScheduleId: s1.id, teacherId: moaz.id, title: "Cell L1", videoTransport: "YOUTUBE", youtubeVideoId: "AAAAAAAAAA1", actualStartedAt: t0, actualEndedAt: at(70) } });
  await prisma.liveSession.create({ data: { batchScheduleId: s1.id, occurrence: 1, whiteboardSessionId: wb1.id, deliveryMode: "APP_YOUTUBE", state: "COMPLETED", controllingTeacherId: moaz.id, plannedStartsAt: t0, effectiveEndsAt: at(60), actualStartedAt: t0, actualEndedAt: at(70), youtubeVideoId: "AAAAAAAAAA1" } });
  await prisma.liveSession.create({ data: { batchScheduleId: s1.id, occurrence: 2, deliveryMode: "APP_YOUTUBE", state: "COMPLETED", controllingTeacherId: moaz.id, plannedStartsAt: at(100), effectiveEndsAt: at(160), actualStartedAt: at(100), actualEndedAt: at(120) } });
  // Older class (no LiveSession rows): only the room's real times — a LiveKit class.
  const s2 = await sched("Cell L0", moaz.id);
  const wb2 = await prisma.whiteboardSession.create({ data: { batchScheduleId: s2.id, teacherId: moaz.id, title: "Cell L0", videoTransport: "LIVEKIT", actualStartedAt: t0, actualEndedAt: at(45) } });
  // Scheduled but never started: nothing.
  const s3 = await sched("Cell L-missed", moaz.id);
  await prisma.whiteboardSession.create({ data: { batchScheduleId: s3.id, teacherId: moaz.id, title: "missed" } });
  // Test Lab room: never counted.
  const s4 = await sched("Test lab", moaz.id, { isTest: true });
  await prisma.whiteboardSession.create({ data: { batchScheduleId: s4.id, teacherId: moaz.id, title: "lab", actualStartedAt: t0, actualEndedAt: at(30) } });
  // Left running all day: capped.
  const s5 = await sched("Forgot to end", other.id);
  await prisma.whiteboardSession.create({ data: { batchScheduleId: s5.id, teacherId: other.id, title: "long", actualStartedAt: t0, actualEndedAt: at(600) } });

  // Recorded YouTube classes.
  const lec = (title: string, videoUrl: string, extra: Record<string, unknown> = {}) =>
    prisma.lecture.create({ data: { chapterId: chapter.id, title, teacherId: moaz.id, videoUrl, status: "PUBLISHED", scheduledDate: t0, ...extra } });
  const pastA = await lec("Past class A", "https://www.youtube.com/watch?v=BBBBBBBBBB1");
  await lec("Same video, second batch", "https://youtu.be/BBBBBBBBBB1"); // same video → one class
  await lec("Past class B (length not known yet)", "https://www.youtube.com/watch?v=CCCCCCCCCC1");
  const liveLecture = await lec("Lecture of the app class", "https://www.youtube.com/watch?v=DDDDDDDDDD1");
  await prisma.batchSchedule.update({ where: { id: s1.id }, data: { lectureId: liveLecture.id } }); // taught in the app → not again by video
  await lec("Draft", "https://www.youtube.com/watch?v=EEEEEEEEEE1", { status: "DRAFT" });
  await prisma.youtubeVideoStat.createMany({
    data: [
      { videoId: "AAAAAAAAAA1", durationSec: 4300, viewCount: 120 },
      { videoId: "BBBBBBBBBB1", durationSec: 4205, viewCount: 300 },
      { videoId: "DDDDDDDDDD1", durationSec: 3000, viewCount: 50 },
    ],
  });

  const stats = await computeTeachingStats({ teacherIds: [moaz.id, other.id] });
  const m = stats.get(moaz.id)!;
  assert(m.appMinutes === 70 + 20 + 45, `App time = real start→end of each run, not the schedule (${m.appMinutes} min)`);
  assert(m.appClasses === 2, `A restarted class is one class taught (${m.appClasses})`);
  assert(m.youtubeMinutes === 70 && m.youtubeClasses === 1, `YouTube time = the video's real length, a reused video counted once (${m.youtubeMinutes} min, ${m.youtubeClasses})`);
  assert(m.youtubePending === 1, "A video whose length YouTube hasn't reported yet waits (not guessed)");
  assert(m.totalMinutes === 205, `Total = app + YouTube (${formatTeachingTime(m.totalMinutes)})`);
  assert(stats.get(other.id)!.appMinutes === 360, "A class left running all day counts at most 6 h");

  // Views: YouTube views of every class video + app views of non-YouTube classes.
  const studentUser = await prisma.user.create({ data: { email: "s@t.local", passwordHash: "x", name: "Priti" } });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, enrollmentNumber: "E1", studentIdCode: "S1", fatherName: "F", motherName: "M", dob: new Date("2008-01-01"), gender: "FEMALE", class: "12", targetExam: "NEET", school: "X", city: "Y", state: "Z" },
  });
  await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: wb2.id, studentId: student.id, activeDurationSec: 2400 } }); // LiveKit class → app view
  await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: wb1.id, studentId: student.id, activeDurationSec: 3900 } }); // YouTube class → in YouTube's count
  const r2Lecture = await lec("App-stored recording", "https://files.example.com/rec.mp4");
  await prisma.videoWatch.create({ data: { studentId: student.id, contentKey: `lecture:${r2Lecture.id}`, lectureId: r2Lecture.id, watchedSec: 600 } }); // non-YouTube → app view
  await prisma.videoWatch.create({ data: { studentId: student.id, contentKey: `lecture:${pastA.id}`, lectureId: pastA.id, watchedSec: 1800, durationSec: 4205 } }); // YouTube → already a YouTube view
  const v = (await computeTeachingStats({ teacherIds: [moaz.id] })).get(moaz.id)!;
  assert(v.youtubeViews === 120 + 300 + 50, `YouTube views: each of the teacher's videos once (${v.youtubeViews})`);
  assert(v.appViews === 2, `App views: only classes that didn't go through YouTube — no double count (${v.appViews})`);
  assert(v.totalViews === 472, "Total views = YouTube + app");

  const july = await computeTeachingStats({ teacherIds: [moaz.id], from: new Date("2026-08-01T00:00:00Z") });
  assert(july.get(moaz.id)!.totalMinutes === 0, "A period filter only counts classes taught in it");
  const ids = await allClassVideoIds();
  assert(["AAAAAAAAAA1", "BBBBBBBBBB1", "CCCCCCCCCC1", "DDDDDDDDDD1"].every((id) => ids.includes(id)), "Daily refresh covers every class video");

  // ---- 3. Super Admin boards ----
  const q1 = await prisma.question.create({ data: { subject: "Biology" } });
  const q2 = await prisma.question.create({ data: { subject: "Biology" } });
  const q3 = await prisma.question.create({ data: { subject: "Biology" } });
  const dpp = await prisma.dpp.create({ data: { code: "DPP-1", name: "Cell DPP 1", subject: "Biology", chapter: "Cell", chapterId: chapter.id, createdById: moaz.userId } });
  await prisma.dppQuestion.createMany({ data: [q1, q2, q3].map((q, i) => ({ dppId: dpp.id, questionId: q.id, order: i })) });
  const attempt = await prisma.attempt.create({ data: { dppId: dpp.id, studentId: student.id, status: "SUBMITTED", submittedAt: at(300), score: 3 } });
  await prisma.attemptAnswer.createMany({
    data: [
      { attemptId: attempt.id, questionId: q1.id, selectedOptionIds: ["a"], isCorrect: true, timeTakenSec: 40 },
      { attemptId: attempt.id, questionId: q2.id, selectedOptionIds: ["b"], isCorrect: false, timeTakenSec: 50 },
      { attemptId: attempt.id, questionId: q3.id, selectedOptionIds: [], isCorrect: null, timeTakenSec: 5 },
    ],
  });
  const { listStudentPerformance, studentPerformanceDetail } = await import("../src/lib/performance/students");
  const list = await listStudentPerformance({ search: "priti" });
  const row = list.rows[0];
  assert(list.total === 1 && row?.dppsAttempted === 1 && row.questionsAnswered === 2 && row.questionsCorrect === 1, "Student list: DPPs, questions answered, correct");
  assert(row?.liveClasses === 2 && row.liveMinutes === 105 && row.recordedMinutes === 40, `Student list: live classes + minutes present, recorded minutes watched (${row?.liveMinutes}/${row?.recordedMinutes})`);
  // Sort + filter across ALL students (not just the page on screen).
  const aaravUser = await prisma.user.create({ data: { email: "aarav@t.local", passwordHash: "x", name: "Aarav" } });
  const aarav = await prisma.student.create({
    data: { userId: aaravUser.id, enrollmentNumber: "E2", studentIdCode: "S2", fatherName: "F", motherName: "M", dob: new Date("2008-01-01"), gender: "MALE", class: "12", targetExam: "NEET", school: "X", city: "Y", state: "Z" },
  });
  await prisma.batchEnrollment.create({ data: { batchId: batch.id, studentId: student.id, status: "ACTIVE" } });
  const byQuestions = await listStudentPerformance({ sort: "questions", dir: "desc", take: 1 });
  assert(byQuestions.total === 2 && byQuestions.rows[0]?.studentId === student.id, "Students: top by questions done — sorted before paging");
  const byName = await listStudentPerformance({ sort: "name", dir: "asc", take: 1 });
  assert(byName.rows[0]?.studentId === aarav.id, "Students: A→Z by name");
  const inBatch = await listStudentPerformance({ batchId: batch.id });
  assert(inBatch.total === 1 && inBatch.rows[0]?.studentId === student.id, "Students: batch filter");
  const never = await listStudentPerformance({ activity: "never" });
  assert(never.total === 1 && never.rows[0]?.studentId === aarav.id, "Students: 'never active' filter");
  const bogus = await listStudentPerformance({ sort: "passwordHash" });
  assert(bogus.sort === "lastActive", "Students: an unknown sort column falls back safely");

  const detail = await studentPerformanceDetail(student.id);
  const d1 = detail?.practice[0];
  assert(d1?.title === "Cell DPP 1" && d1.totalQuestions === 3 && d1.answered === 2 && d1.notAnswered === 1 && d1.correct === 1 && d1.wrong === 1, "Student detail: per DPP — questions, answered, left, right, wrong");
  assert(detail?.recorded.find((r) => r.title === "Past class A")?.percent === 43, "Student detail: how much of each recorded class was watched");
  assert(detail?.liveClasses.some((l) => l.minutesPresent === 65 && l.classMinutes === 70) === true, "Student detail: minutes present vs class length");

  const { teacherBoard, staffBoard } = await import("../src/lib/performance/team");
  const board = await teacherBoard();
  const mb = board.find((b) => b.teacherId === moaz.id)!;
  assert(mb.totalMinutes === 205 && mb.dppsCreated === 1 && mb.classesScheduled === 3 && mb.studentsPresent === 2, `Teacher board: time, DPPs made, classes scheduled (Test Lab excluded), students present`);
  const salesRole = await prisma.role.create({ data: { name: "SALES", label: "Sales" } });
  const sales = await prisma.user.create({ data: { email: "sales@t.local", passwordHash: "x", name: "Sales Person", roleId: salesRole.id } });
  await prisma.auditLog.createMany({ data: [{ userId: sales.id, action: "LEAD_CREATED", entityType: "Lead" }, { userId: sales.id, action: "LEAD_UPDATED", entityType: "Lead" }] });
  const staff = await staffBoard();
  const sp = staff.find((s) => s.userId === sales.id);
  assert(sp?.actions30d === 2 && sp.topWork[0]?.entityType === "Lead" && !staff.some((s) => s.userId === moaz.userId), "Staff board: other staff with their recorded work; teachers are on their own board");

  // ---- Before `migrate deploy`: the new tables don't exist yet ----
  await prisma.$executeRawUnsafe(`ALTER TABLE "video_watches" RENAME TO "video_watches_off"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "youtube_video_stats" RENAME TO "youtube_video_stats_off"`);
  try {
    const pre = (await computeTeachingStats({ teacherIds: [moaz.id] })).get(moaz.id)!;
    assert(pre.appMinutes === 135 && pre.youtubeMinutes === 0 && pre.youtubePending === 2, "Without the new tables: teaching stats still work (app time; YouTube lengths wait)");
    const preBoard = await teacherBoard().then(() => true, () => false);
    const preList = await listStudentPerformance({}).then((r) => r.rows.length === 2, () => false);
    const preDetail = await studentPerformanceDetail(student.id).then((d) => d?.recorded.length === 0, () => false);
    assert(preBoard && preList && preDetail, "Without the new tables: Performance Boards and student pages open (no crash)");
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "video_watches_off" RENAME TO "video_watches"`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "youtube_video_stats_off" RENAME TO "youtube_video_stats"`);
  }

  // ---- 4. Access + wiring ----
  const { isSuperAdmin } = await import("../src/lib/rbac/super-admin");
  const superRole = await prisma.role.create({ data: { name: "SUPER_ADMIN", label: "Super Admin" } });
  const adminRole = await prisma.role.create({ data: { name: "ADMIN", label: "Admin" } });
  const boss = await prisma.user.create({ data: { email: "boss@t.local", passwordHash: "x", name: "Boss", roleId: superRole.id } });
  const plainAdmin = await prisma.user.create({ data: { email: "adm@t.local", passwordHash: "x", name: "Admin", roleId: adminRole.id } });
  const suspended = await prisma.user.create({ data: { email: "old@t.local", passwordHash: "x", name: "Old", roleId: superRole.id, status: "SUSPENDED" } });
  assert((await isSuperAdmin(boss.id)) && !(await isSuperAdmin(plainAdmin.id)) && !(await isSuperAdmin(suspended.id)) && !(await isSuperAdmin(null)), "Boards: Super Admin only (not Admin, not a suspended account)");
  assert(read("src/app/(team)/team/performance/page.tsx").includes("isSuperAdmin(session.user.id)") && read("src/app/(team)/team/performance/students/[id]/page.tsx").includes("isSuperAdmin(session.user.id)"), "Both board pages check Super Admin on the server");
  assert(read("src/app/(team)/team/layout.tsx").includes("superAdminOnly: true"), "Sidebar link only for Super Admin");
  assert(read("src/lib/teacher-dashboard/analytics.ts").includes("computeTeachingStats") && !read("src/lib/teacher-dashboard/analytics.ts").includes("sum + (s.endsAt.getTime() - s.startsAt.getTime())"), "Teacher dashboard shows actual hours, not scheduled");
  assert(read("src/components/video-player/LectureVideoPlayer.tsx").includes("useWatchHeartbeat(") && read("src/components/student/LecturePlayer.tsx").includes("watchContentKey={`lecture:${lectureId}`}"), "Recorded classes report watch time");
  assert(read("vercel.json").includes("/api/cron/youtube-video-stats"), "Daily YouTube refresh is scheduled");

  await prisma.$disconnect();
}

run()
  .then(() => finish())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
