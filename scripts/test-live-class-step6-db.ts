/**
 * Step 6 checks: class events on a PRIVATE Pusher channel (no 100-member
 * presence cap), OBS stage tokens only on their own class's event channel,
 * and heartbeat-based online counting.
 *
 * Run (same safety rules as scripts/lib/test-db.ts):
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-class-step6-db.ts
 */
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();
Object.assign(process.env, { PUSHER_APP_ID: "1", PUSHER_KEY: "test-key", PUSHER_SECRET: "test-secret" });

async function run() {
  prepareTestDatabase(testUrl, parsed);

  const { prisma } = await import("../src/lib/db");
  const { sessionChannel, teacherChannel } = await import("../src/lib/realtime/events");
  const { STUDENT_HEARTBEAT_MS, ONLINE_WINDOW_MS } = await import("../src/lib/whiteboard/constants");
  const stage = await import("../src/lib/live-class/stage-session");
  const svc = await import("../src/lib/live-session/service");
  const { POST: pusherAuth } = await import("../src/app/api/pusher/auth/route");
  const { NextRequest } = await import("next/server");

  // ---- Channel naming / timing ---------------------------------------------
  assert(sessionChannel("abc") === "private-wb-session-abc", "Class events use a PRIVATE channel (no presence member cap)");
  assert(teacherChannel("abc") === "private-wb-teacher-abc", "Teacher channel unchanged");
  assert(ONLINE_WINDOW_MS >= 2 * STUDENT_HEARTBEAT_MS, "Online window tolerates one missed heartbeat");
  const perSecond = 500 / (STUDENT_HEARTBEAT_MS / 1000);
  assert(perSecond <= 10, `500 students → ${perSecond.toFixed(1)} heartbeats/s (was 20/s at 25 s)`);

  // ---- Seed ----------------------------------------------------------------
  const user = await prisma.user.create({ data: { email: "t6@test.local", passwordHash: "x", name: "Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: "T-6", department: "Physics" } });
  const batch = await prisma.batch.create({ data: { name: "B6", code: "B6", createdById: user.id } });
  const start = new Date(Date.now() - 60_000);
  const end = new Date(start.getTime() + 3600_000);
  const mk = async (title: string) => {
    const schedule = await prisma.batchSchedule.create({ data: { batchId: batch.id, teacherId: teacher.id, title, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: user.id } });
    const wb = await prisma.whiteboardSession.create({ data: { batchScheduleId: schedule.id, teacherId: teacher.id, title, scheduledStart: start, scheduledEnd: end } });
    await svc.ensureOpenLiveSession({ batchScheduleId: schedule.id, whiteboardSessionId: wb.id, controllingTeacherId: teacher.id, plannedStartsAt: start, plannedEndsAt: end, videoTransport: "LIVEKIT" });
    return { schedule, wb };
  };
  const A = await mk("A");
  const B = await mk("B");
  const tokenA = (await stage.issueStageToken({ batchScheduleId: A.schedule.id, issuedToUserId: user.id }))!;

  const auth = (channel: string, token?: string) => {
    const body = new URLSearchParams({ socket_id: "1234.5678", channel_name: channel, ...(token ? { broadcast_token: token } : {}) });
    return pusherAuth(
      new NextRequest("https://example.test/api/pusher/auth", {
        method: "POST",
        body: body.toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      })
    );
  };

  // ---- Stage token on Pusher -------------------------------------------------
  const own = await auth(sessionChannel(A.wb.id), tokenA);
  const ownJson = own.status === 200 ? await own.json() : null;
  assert(own.status === 200 && typeof ownJson?.auth === "string", "Stage token authorises its own class's event channel", `got ${own.status}`);
  const other = await auth(sessionChannel(B.wb.id), tokenA);
  assert(other.status === 403, "Stage token for Class A is refused on Class B's channel", `got ${other.status}`);
  const teacherCh = await auth(teacherChannel(A.wb.id), tokenA).catch(() => ({ status: 500 }) as Response);
  assert(teacherCh.status !== 200, "Stage token never gets the teacher channel (hand-raise queue with names)", `got ${teacherCh.status}`);
  await stage.revokeStageTokens((await svc.getOpenLiveSession(A.schedule.id))!.id);
  const revoked = await auth(sessionChannel(A.wb.id), tokenA);
  assert(revoked.status === 403, "Revoked stage token is refused by Pusher auth", `got ${revoked.status}`);

  // ---- Online count from heartbeats -------------------------------------------
  const mkStudent = async (i: number, lastSeenAgoMs: number) => {
    const u = await prisma.user.create({ data: { email: `s6-${i}@test.local`, passwordHash: "x", name: `S${i}` } });
    const st = await prisma.student.create({
      data: { userId: u.id, enrollmentNumber: `E6-${i}`, studentIdCode: `S6-${i}`, fatherName: "F", motherName: "M", dob: new Date("2008-01-01"), gender: "MALE", class: "12", targetExam: "NEET", school: "S", city: "C", state: "S" },
    });
    await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: A.wb.id, studentId: st.id, joinedAt: start, lastSeenAt: new Date(Date.now() - lastSeenAgoMs) } });
  };
  for (let i = 0; i < 120; i++) await mkStudent(i, i < 110 ? 30_000 : 10 * 60_000);
  const online = await prisma.liveClassAttendance.count({
    where: { whiteboardSessionId: A.wb.id, lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
  });
  assert(online === 110, "Online count (heartbeat window) counts 110 of 120 — beyond presence's 100 cap", `got ${online}`);

  await prisma.$disconnect();
  finish();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
