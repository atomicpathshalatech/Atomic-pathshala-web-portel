/**
 * Step 7 checks: versioned (compare-and-set) whiteboard page saves, and the
 * board-changed realtime signal carrying no stroke data.
 *
 * Run (same safety rules as scripts/lib/test-db.ts):
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-class-step7-db.ts
 */
import { readFileSync } from "node:fs";
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();

async function run() {
  prepareTestDatabase(testUrl, parsed);

  const { prisma } = await import("../src/lib/db");
  const { saveWhiteboardPage } = await import("../src/lib/whiteboard/page-save");

  const user = await prisma.user.create({ data: { email: "t7@test.local", passwordHash: "x", name: "Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: "T-7", department: "Physics" } });
  const batch = await prisma.batch.create({ data: { name: "B7", code: "B7", createdById: user.id } });
  const start = new Date();
  const schedule = await prisma.batchSchedule.create({
    data: { batchId: batch.id, teacherId: teacher.id, title: "C", type: "LIVE_CLASS", startsAt: start, endsAt: new Date(start.getTime() + 3600_000), createdById: user.id },
  });
  const wb = await prisma.whiteboardSession.create({ data: { batchScheduleId: schedule.id, teacherId: teacher.id, title: "C" } });
  const page = await prisma.whiteboardPage.create({ data: { sessionId: wb.id, pageNumber: 1, objects: [] } });
  const strokes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, type: "pen" }));
  const stored = async () => prisma.whiteboardPage.findUniqueOrThrow({ where: { id: page.id } });

  assert(page.version === 0, "New page starts at version 0");

  // Normal sequence: each save builds on the previous version.
  let r = await saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(1), baseVersion: 0 });
  assert(r.ok && r.page.version === 1, "Save on the current version succeeds and bumps to 1");
  r = await saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(2), baseVersion: 1 });
  assert(r.ok && r.page.version === 2, "Next save bumps to 2");

  // The old bug: an OLDER save (built on version 1, only 1 stroke) arriving late.
  r = await saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(1), baseVersion: 1 });
  const afterLate = await stored();
  assert(!r.ok && r.currentVersion === 2, "Late-arriving older save is rejected with the current version");
  assert((afterLate.objects as unknown[]).length === 2, "Newer strokes survive (not overwritten by the older save)");

  // Two saves racing on the same base version: exactly one wins.
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) => saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(10 + i), baseVersion: 2 }))
  );
  const winners = results.filter((x) => x.ok).length;
  const now = await stored();
  assert(winners === 1 && now.version === 3, "5 concurrent saves on one version → exactly one applies", `winners=${winners} v=${now.version}`);

  // Client retry after 409: resend on the version the server reported.
  const conflict = results.find((x) => !x.ok) as { ok: false; currentVersion: number | null };
  r = await saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(20), baseVersion: conflict.currentVersion! });
  assert(r.ok && r.page.version === 4 && (r.page.objects as unknown[]).length === 20, "Retry on the reported version succeeds");

  // Wrong session can't write someone else's page.
  const otherWb = await prisma.whiteboardSession.create({
    data: {
      batchScheduleId: (await prisma.batchSchedule.create({ data: { batchId: batch.id, teacherId: teacher.id, title: "D", type: "LIVE_CLASS", startsAt: start, endsAt: new Date(start.getTime() + 3600_000), createdById: user.id } })).id,
      teacherId: teacher.id,
      title: "D",
    },
  });
  r = await saveWhiteboardPage({ sessionId: otherWb.id, pageId: page.id, objects: [], baseVersion: 4 });
  assert(!r.ok && (await stored()).version === 4, "A save scoped to another session never touches this page");

  // Older clients without baseVersion still save (and still bump the version).
  r = await saveWhiteboardPage({ sessionId: wb.id, pageId: page.id, objects: strokes(3) });
  assert(r.ok && r.page.version === 5, "Save without baseVersion (old client) still works and bumps the version");

  // Realtime signal carries no stroke data.
  const mirror = readFileSync("src/lib/whiteboard/board-mirror.ts", "utf8");
  const pushFn = mirror.slice(mirror.indexOf("export async function pushBoardUpdated"), mirror.indexOf("export async function pushPageChanged"));
  assert(/pageNumber,\s*version,/.test(pushFn) && !/objects/.test(pushFn.replace(/\/\/.*$/gm, "")), "BOARD_UPDATED sends only { pageNumber, version }");
  const signalBytes = Buffer.byteLength(JSON.stringify({ pageNumber: 12, version: 123456 }));
  const oldBytes = Buffer.byteLength(JSON.stringify({ pageNumber: 12, objects: strokes(200).map((s) => ({ ...s, points: Array(40).fill([123.45, 678.9]) })) }));
  assert(signalBytes < 100 && oldBytes > 10_240, `Signal is ${signalBytes} B; the old payload for a 200-stroke page was ${Math.round(oldBytes / 1024)} KB (> Pusher's 10 KB limit)`);

  await prisma.$disconnect();
  finish();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
