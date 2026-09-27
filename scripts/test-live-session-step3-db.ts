/**
 * Step 3 DB-backed checks: LiveSession lifecycle, SQL invariants, extend,
 * reschedule/new occurrence, simulcast groups and D5 ownership — against a
 * REAL, DISPOSABLE Postgres.
 *
 * Run:
 *   TEST_DATABASE_URL="postgresql://postgres:<pw>@localhost:5432/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-session-step3-db.ts
 *
 * Safety: refuses to run unless the host is localhost and the database name
 * contains "test". It RESETS that database (prisma migrate reset) first —
 * which also proves the full migration history applies cleanly.
 */
import { execSync } from "node:child_process";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error("TEST_DATABASE_URL is not set.");
  process.exit(2);
}
const parsed = new URL(testUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) || !/test/i.test(parsed.pathname)) {
  console.error(`Refusing: TEST_DATABASE_URL must point at localhost and a database whose name contains "test" (got ${parsed.hostname}${parsed.pathname}).`);
  process.exit(2);
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;

let passCount = 0;
let failCount = 0;
function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}
async function rejects(p: Promise<unknown>, match?: RegExp): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (err) {
    return match ? match.test(err instanceof Error ? err.message : String(err)) : true;
  }
}

async function run() {
  console.log(`Resetting ${parsed.pathname.slice(1)} on ${parsed.hostname} and applying all migrations…`);
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
  });

  const { prisma } = await import("../src/lib/db");
  const svc = await import("../src/lib/live-session/service");
  const simulcast = await import("../src/lib/live-session/simulcast");
  const { decideLiveClassControl } = await import("../src/lib/live-class/ownership");
  const { isPastGracePeriod } = await import("../src/lib/whiteboard/lifecycle");

  // ---- Seed -----------------------------------------------------------------
  const mkUser = (n: string) => prisma.user.create({ data: { email: `${n}@test.local`, passwordHash: "x", name: n } });
  const [uA, uB, uC] = await Promise.all([mkUser("teacher-a"), mkUser("teacher-b"), mkUser("teacher-c")]);
  const tA = await prisma.teacher.create({ data: { userId: uA.id, employeeCode: "T-A", department: "Physics" } });
  const tB = await prisma.teacher.create({ data: { userId: uB.id, employeeCode: "T-B", department: "Physics" } });
  const tC = await prisma.teacher.create({ data: { userId: uC.id, employeeCode: "T-C", department: "Physics" } });
  const batch1 = await prisma.batch.create({ data: { name: "B1", code: "B1", createdById: uA.id } });
  const batch2 = await prisma.batch.create({ data: { name: "B2", code: "B2", createdById: uA.id } });
  await prisma.batchTeacher.createMany({
    data: [
      { batchId: batch1.id, teacherId: tA.id },
      { batchId: batch1.id, teacherId: tB.id },
    ],
  });

  const start = new Date(Date.now() - 5 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const mkSchedule = (batchId: string, teacherId: string | null, title: string) =>
    prisma.batchSchedule.create({ data: { batchId, teacherId, title, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: uA.id } });
  const s1 = await mkSchedule(batch1.id, tA.id, "Class A");
  const mkWb = (scheduleId: string, teacherId: string) =>
    prisma.whiteboardSession.create({ data: { batchScheduleId: scheduleId, teacherId, title: "wb", scheduledStart: start, scheduledEnd: end } });
  const wb1 = await mkWb(s1.id, tA.id);

  // ---- D5 ownership ----------------------------------------------------------
  assert((await decideLiveClassControl(uA.id, s1)).allowed, "Assigned teacher controls the class");
  assert(!(await decideLiveClassControl(uB.id, s1)).allowed, "Batch co-teacher does NOT control another teacher's class");
  assert(!(await decideLiveClassControl(uC.id, s1)).allowed, "Unrelated teacher is denied");
  const sUnassigned = await mkSchedule(batch1.id, null, "Unassigned");
  assert((await decideLiveClassControl(uB.id, sUnassigned)).allowed, "Unassigned schedule: batch teachers may run it");

  // ---- One open occurrence per schedule (concurrent ensure) ---------------
  const ensureInput = {
    batchScheduleId: s1.id,
    whiteboardSessionId: wb1.id,
    controllingTeacherId: tA.id,
    plannedStartsAt: start,
    plannedEndsAt: end,
    videoTransport: "BOTH",
    youtubeBroadcastId: "BCAST_OCC1",
    youtubeVideoId: "BCAST_OCC1",
  };
  const racers = await Promise.all(Array.from({ length: 6 }, () => svc.ensureOpenLiveSession(ensureInput)));
  const openCount = await prisma.liveSession.count({ where: { batchScheduleId: s1.id } });
  assert(openCount === 1 && new Set(racers.map((r) => r.id)).size === 1, "6 concurrent ensureOpen calls → exactly one occurrence", `rows=${openCount}`);
  const occ1 = racers[0]!;
  assert(occ1.deliveryMode === "APP_YOUTUBE" && occ1.youtubeChannel === "APP", "Occurrence records APP_YOUTUBE on APP");

  assert(
    await rejects(
      prisma.liveSession.create({
        data: { batchScheduleId: s1.id, occurrence: 99, deliveryMode: "LEGACY_LIVEKIT", controllingTeacherId: tA.id, plannedStartsAt: start, effectiveEndsAt: end },
      })
    ),
    "SQL: a second OPEN occurrence for the same schedule is rejected"
  );

  // ---- CAS transitions --------------------------------------------------------
  assert(await rejects(svc.transitionLiveSession(occ1.id, "LIVE"), /cannot move to LIVE/), "SCHEDULED → LIVE directly is refused");
  const lived = await svc.markLiveSessionLive(occ1.id, new Date());
  assert(lived.length === 1 && lived[0]!.state === "LIVE", "markLiveSessionLive goes SCHEDULED → STARTING → LIVE");
  assert((await prisma.batchSchedule.findUnique({ where: { id: s1.id } }))!.status === "LIVE", "Schedule marked LIVE");
  const again = await svc.markLiveSessionLive(occ1.id, new Date());
  assert(again[0]!.state === "LIVE", "Starting twice is idempotent");

  // ---- Extend: one authoritative end -----------------------------------------
  await svc.extendLiveSession(occ1.id, 30);
  const afterExtend = await prisma.liveSession.findUniqueOrThrow({ where: { id: occ1.id } });
  const wbAfter = await prisma.whiteboardSession.findUniqueOrThrow({ where: { id: wb1.id } });
  assert(afterExtend.effectiveEndsAt.getTime() === end.getTime() + 30 * 60_000, "Extend moves effectiveEndsAt by 30 min");
  assert(wbAfter.scheduledEnd?.getTime() === afterExtend.effectiveEndsAt.getTime(), "Extend mirrors onto WhiteboardSession.scheduledEnd");
  const authEnd = await svc.authoritativeEndFor({ id: wb1.id, scheduledEnd: wbAfter.scheduledEnd, batchSchedule: { id: s1.id, endsAt: end } });
  const atOldEndPlusGrace = new Date(end.getTime() + 15 * 60_000);
  assert(!isPastGracePeriod(authEnd, atOldEndPlusGrace), "Auto-end does NOT fire at the old end time after extending");

  // ---- End → RECORDING_PROCESSING, never READY --------------------------------
  const ended = await svc.markLiveSessionEnded(occ1.id, { endedAt: new Date(), hasLegacyRecording: false });
  assert(ended[0]!.state === "RECORDING_PROCESSING", "APP_YOUTUBE end → RECORDING_PROCESSING (not READY)");
  assert((await prisma.batchSchedule.findUnique({ where: { id: s1.id } }))!.status === "COMPLETED", "Schedule marked COMPLETED");
  assert(ended[0]!.recordingVideoId === null, "No recordingVideoId set without YouTube confirmation");

  // ---- Re-run: fresh occurrence, no YouTube leak -------------------------------
  const occ2 = await svc.ensureOpenLiveSession({ ...ensureInput, videoTransport: "LIVEKIT", youtubeBroadcastId: null, youtubeVideoId: null });
  assert(occ2.occurrence === 2 && occ2.id !== occ1.id, "Next start after an ended run creates occurrence 2");
  assert(occ2.youtubeBroadcastId === null && occ2.youtubeVideoId === null && occ2.recordingVideoId === null, "Occurrence 2 carries no YouTube/recording state from occurrence 1");

  // ---- Reschedule / cancel of a not-yet-live occurrence ----------------------
  const later = new Date(start.getTime() + 24 * 3600_000);
  await svc.rescheduleOpenLiveSession(s1.id, later, new Date(later.getTime() + 3600_000));
  assert((await prisma.liveSession.findUniqueOrThrow({ where: { id: occ2.id } })).plannedStartsAt.getTime() === later.getTime(), "Reschedule moves the not-yet-live occurrence");
  await svc.cancelOpenLiveSession(s1.id);
  assert((await prisma.liveSession.findUniqueOrThrow({ where: { id: occ2.id } })).state === "CANCELLED", "Cancel marks the not-yet-live occurrence CANCELLED");

  // ---- Channel CHECK constraint ------------------------------------------------
  assert(
    await rejects(
      prisma.liveSession.create({
        data: { batchScheduleId: sUnassigned.id, deliveryMode: "APP_YOUTUBE", youtubeChannel: "MAIN", controllingTeacherId: tB.id, plannedStartsAt: start, effectiveEndsAt: end },
      })
    ),
    "SQL: APP_YOUTUBE on the MAIN channel is rejected"
  );

  // ---- Stream lease exclusivity -------------------------------------------------
  const stream = await prisma.youtubeIngestStream.create({ data: { channel: "APP", youtubeStreamId: "STREAM1", ingestAddress: "rtmps://x", streamNameEnc: "enc" } });
  assert(
    await rejects(prisma.youtubeIngestStream.create({ data: { channel: "MAIN", youtubeStreamId: "STREAM2", ingestAddress: "rtmps://x", streamNameEnc: "enc" } })),
    "SQL: ingest streams can only live on APP"
  );
  const sL1 = await mkSchedule(batch2.id, tC.id, "Lease 1");
  const sL2 = await mkSchedule(batch2.id, tC.id, "Lease 2");
  const mkOpen = (scheduleId: string) =>
    prisma.liveSession.create({ data: { batchScheduleId: scheduleId, deliveryMode: "LEGACY_LIVEKIT", controllingTeacherId: tC.id, plannedStartsAt: start, effectiveEndsAt: end } });
  const [ls1, ls2] = await Promise.all([mkOpen(sL1.id), mkOpen(sL2.id)]);
  const leaseResults = await Promise.allSettled([
    prisma.streamLease.create({ data: { streamId: stream.id, liveSessionId: ls1.id, expiresAt: end } }),
    prisma.streamLease.create({ data: { streamId: stream.id, liveSessionId: ls2.id, expiresAt: end } }),
  ]);
  assert(leaseResults.filter((r) => r.status === "fulfilled").length === 1, "SQL: two classes racing for one stream → exactly one lease wins");
  const won = leaseResults.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>;
  await prisma.streamLease.update({ where: { id: won.value.id }, data: { state: "RELEASED", releasedAt: new Date() } });
  const loser = leaseResults[0]!.status === "fulfilled" ? ls2 : ls1;
  assert(
    !(await rejects(prisma.streamLease.create({ data: { streamId: stream.id, liveSessionId: loser.id, expiresAt: end } }))),
    "After release, the stream can be leased again"
  );

  // ---- Simulcast group ---------------------------------------------------------
  const g1 = await mkSchedule(batch1.id, tA.id, "Group A");
  const g2 = await mkSchedule(batch2.id, tA.id, "Group B");
  const group = await simulcast.createSimulcastGroup({ scheduleIds: [g1.id, g2.id], createdById: uA.id });
  const wbG1 = await mkWb(g1.id, tA.id);
  assert((await simulcast.groupRoomRunByAnotherSchedule(g2.id)) === null, "Nobody running the group room yet");
  await svc.syncLiveSessionOnStart({ schedule: g1, wbSession: { id: wbG1.id, videoTransport: "LIVEKIT" }, teacherId: tA.id, startedAt: new Date() });
  const groupRows = await prisma.liveSession.findMany({ where: { simulcastGroupId: group.id } });
  assert(groupRows.length === 2 && groupRows.every((r) => r.state === "LIVE"), "Starting one grouped schedule puts the whole group LIVE");
  assert((await simulcast.resolveGroupWhiteboardSessionId(g2.id)) === wbG1.id, "Batch 2 students are pointed at the group room");
  assert((await simulcast.groupRoomRunByAnotherSchedule(g2.id)) === g1.id, "Batch 2 can't open a second room for the group");
  assert((await simulcast.groupBatchIdsForWhiteboardSession(wbG1.id)).sort().join() === [batch1.id, batch2.id].sort().join(), "Group room is open to both batches");
  const groupOpen = groupRows.find((r) => r.batchScheduleId === g1.id)!;
  await svc.markLiveSessionEnded(groupOpen.id, { endedAt: new Date(), hasLegacyRecording: false });
  const schedAfter = await prisma.batchSchedule.findMany({ where: { id: { in: [g1.id, g2.id] } } });
  assert(schedAfter.every((s) => s.status === "COMPLETED"), "Ending the group completes every member schedule (none left LIVE)");

  // Ungrouped siblings never move together.
  const lone = await mkSchedule(batch2.id, tA.id, "Same lecture, other batch");
  assert((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: lone.id } })).status === "SCHEDULED", "An ungrouped sibling schedule is untouched by others starting/ending");

  await prisma.$disconnect();
  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
