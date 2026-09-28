/**
 * Step 5 DB-backed checks: revocable OBS stage tokens bound to one schedule
 * and one live occurrence, and the stage payload's data minimisation.
 *
 * Run (same safety rules as scripts/lib/test-db.ts):
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-class-step5-db.ts
 */
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();

async function run() {
  prepareTestDatabase(testUrl, parsed);

  const { prisma } = await import("../src/lib/db");
  const stage = await import("../src/lib/live-class/stage-session");
  const svc = await import("../src/lib/live-session/service");
  const { GET: obsStageGET } = await import("../src/app/api/live-class/obs-stage/[scheduleId]/route");
  const { NextRequest } = await import("next/server");

  const user = await prisma.user.create({ data: { email: "t5@test.local", passwordHash: "x", name: "Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: "T-5", department: "Physics" } });
  const batch = await prisma.batch.create({ data: { name: "B5", code: "B5", createdById: user.id } });
  const start = new Date(Date.now() - 2 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const mkClass = async (title: string) => {
    const schedule = await prisma.batchSchedule.create({ data: { batchId: batch.id, teacherId: teacher.id, title, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: user.id } });
    const wb = await prisma.whiteboardSession.create({ data: { batchScheduleId: schedule.id, teacherId: teacher.id, title, scheduledStart: start, scheduledEnd: end, pages: { create: { pageNumber: 1, objects: [{ id: "s1", type: "stroke" }] } } } });
    const live = await svc.ensureOpenLiveSession({ batchScheduleId: schedule.id, whiteboardSessionId: wb.id, controllingTeacherId: teacher.id, plannedStartsAt: start, plannedEndsAt: end, videoTransport: "LIVEKIT" });
    return { schedule, wb, live };
  };
  const A = await mkClass("Class A");
  const B = await mkClass("Class B");

  const call = (scheduleId: string, token: string) =>
    obsStageGET(new NextRequest(`https://example.test/api/live-class/obs-stage/${scheduleId}?token=${encodeURIComponent(token)}`), { params: { scheduleId } });

  // ---- Issue + bind -------------------------------------------------------------
  const tokenA = (await stage.issueStageToken({ batchScheduleId: A.schedule.id, issuedToUserId: user.id }))!;
  assert(stage.looksLikeStageToken(tokenA), "Issued token has the expected shape");
  const row = await prisma.broadcastStageSession.findFirstOrThrow({ where: { liveSessionId: A.live.id } });
  assert(row.tokenHash !== tokenA && !row.tokenHash.includes(tokenA), "Only the token's hash is stored");
  assert(row.expiresAt.getTime() <= end.getTime() + 30 * 60_000 + 1000, "Token expires by class end + 30 min");

  const vA = await stage.verifyStageToken(tokenA, A.schedule.id);
  assert(vA?.whiteboardSessionId === A.wb.id && vA.liveSessionId === A.live.id, "Token verifies for its own schedule + occurrence");
  assert((await stage.verifyStageToken(tokenA, B.schedule.id)) === null, "Class A token is rejected for Class B");

  const okRes = await call(A.schedule.id, tokenA);
  assert(okRes.status === 200, "Stage route serves Class A with Class A's token", `got ${okRes.status}`);
  const crossRes = await call(B.schedule.id, tokenA);
  assert(crossRes.status === 401, "Stage route refuses Class B with Class A's token", `got ${crossRes.status}`);

  // ---- Payload minimisation --------------------------------------------------
  await prisma.quizSession.create({ data: { whiteboardSessionId: A.wb.id, options: [{ key: "A", label: "x" }, { key: "B", label: "y" }], createdById: user.id, questionText: "Q?", correctOption: "B", status: "ACTIVE" } });
  const studentUser = await prisma.user.create({ data: { email: "s5@test.local", passwordHash: "x", name: "Riya Sharma" } });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, enrollmentNumber: "E5", studentIdCode: "S5", fatherName: "F", motherName: "M", dob: new Date("2008-01-01"), gender: "FEMALE", class: "12", targetExam: "NEET", school: "S", city: "C", state: "S" },
  });
  await prisma.handRaiseEvent.create({ data: { whiteboardSessionId: A.wb.id, studentId: student.id, imageUrl: "https://r2.example/doubt.jpg" } as any });
  const body = JSON.stringify(await (await call(A.schedule.id, tokenA)).json());
  assert(!body.includes('"correctOption":"B"'), "Active quiz: answer key NOT sent to the stage");
  assert(!body.includes("Riya Sharma") && !body.includes("doubt.jpg"), "Hand raise: no student name or doubt photo on the stage");
  await prisma.quizSession.updateMany({ where: { whiteboardSessionId: A.wb.id }, data: { status: "REVEALED" } });
  const revealed = JSON.stringify(await (await call(A.schedule.id, tokenA)).json());
  assert(revealed.includes('"correctOption":"B"'), "After reveal the answer is shown (students see it too)");

  // ---- Revocation, expiry, class end ------------------------------------------
  await stage.revokeStageTokens(A.live.id);
  assert((await stage.verifyStageToken(tokenA, A.schedule.id)) === null, "Revoked token no longer verifies");
  assert((await call(A.schedule.id, tokenA)).status === 401, "Revoked token → stage route 401");

  const tokenB = (await stage.issueStageToken({ batchScheduleId: B.schedule.id, issuedToUserId: user.id }))!;
  // Its issue-time expiry has passed, but the class was EXTENDED: it keeps working.
  await prisma.broadcastStageSession.updateMany({ where: { liveSessionId: B.live.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await prisma.liveSession.update({ where: { id: B.live.id }, data: { effectiveEndsAt: new Date(Date.now() + 40 * 60_000) } });
  assert((await stage.verifyStageToken(tokenB, B.schedule.id)) !== null, "Extended class: stage token keeps working past its issue-time expiry");
  // Class end (+30 min) really passed too → expired.
  await prisma.liveSession.update({ where: { id: B.live.id }, data: { plannedStartsAt: new Date(Date.now() - 120 * 60_000), effectiveEndsAt: new Date(Date.now() - 31 * 60_000) } });
  assert((await stage.verifyStageToken(tokenB, B.schedule.id)) === null, "Expired token no longer verifies");
  await prisma.liveSession.update({ where: { id: B.live.id }, data: { plannedStartsAt: start, effectiveEndsAt: end } });

  const tokenB2 = (await stage.issueStageToken({ batchScheduleId: B.schedule.id, issuedToUserId: user.id }))!;
  await svc.markLiveSessionLive(B.live.id, new Date());
  assert((await stage.verifyStageToken(tokenB2, B.schedule.id)) !== null, "Token valid while the class is live");
  await svc.markLiveSessionEnded(B.live.id, { endedAt: new Date(), hasLegacyRecording: false });
  assert((await stage.verifyStageToken(tokenB2, B.schedule.id)) === null, "Token stops working once the occurrence has ended");

  const C = await prisma.batchSchedule.create({ data: { batchId: batch.id, teacherId: teacher.id, title: "No occurrence", type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: user.id } });
  assert((await stage.issueStageToken({ batchScheduleId: C.id, issuedToUserId: user.id })) === null, "No open occurrence → no stage token");

  await prisma.$disconnect();
  finish();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
