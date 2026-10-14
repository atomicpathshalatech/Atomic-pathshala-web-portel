/**
 * Whiteboard slide + participants routes against a LOCAL test database.
 * Seeds its own class (teacher, 4 students, 2 slides), calls the real route
 * handlers with the teacher's session, and checks the results.
 *
 * Run (localhost database whose name contains "test" only):
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/qc_test" \
 *     npx tsx --tsconfig tsconfig.json scripts/test-whiteboard-routes-db.ts
 */
import "./qc/_stub";

const testUrl = process.env.TEST_DATABASE_URL ?? "";
const u = new URL(testUrl || "postgresql://x/none");
if (!["localhost", "127.0.0.1"].includes(u.hostname) || !/test/i.test(u.pathname)) {
  console.error("Refusing: TEST_DATABASE_URL must be a localhost database whose name contains \"test\".");
  process.exit(2);
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;
Object.assign(process.env, { PUSHER_APP_ID: "1", PUSHER_KEY: "test-key", PUSHER_SECRET: "test-secret", PUSHER_CLUSTER: "ap2" });

// The routes read the signed-in user from next-auth; here it is the seeded teacher.
let sessionUserId = "";
const fakeSession = async () => ({ user: { id: sessionUserId } });
// next-auth re-exports getServerSession from next-auth/next through a getter, so replacing it there is enough.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("next-auth/next").getServerSession = fakeSession;

let passed = 0;
let failed = 0;
const assert = (c: unknown, l: string) => {
  if (c) passed++;
  else failed++;
  console.log(`  ${c ? "ok  " : "FAIL"} ${l}`);
};

async function run() {
  const { prisma } = await import("../src/lib/db");
  // No real Pusher here: realtime pushes become no-ops (nothing leaves this machine).
  const { pusherServer } = await import("../src/lib/realtime/pusher-server");
  (pusherServer as unknown as { trigger: () => Promise<unknown> }).trigger = async () => ({});
  const { NextRequest } = await import("next/server");
  const pagesRoute = await import("../src/app/api/whiteboard/sessions/[id]/pages/route");
  const pageRoute = await import("../src/app/api/whiteboard/sessions/[id]/pages/[pageId]/route");
  const reorderRoute = await import("../src/app/api/whiteboard/sessions/[id]/pages/reorder/route");
  const participantsRoute = await import("../src/app/api/whiteboard/sessions/[id]/participants/route");

  // ---- Seed ----
  const tag = Date.now().toString(36);
  const tUser = await prisma.user.create({ data: { email: `wbr-t-${tag}@example.test`, passwordHash: "x", name: "WBR Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: tUser.id, employeeCode: `WBR-${tag}`, department: "Physics" } });
  const batch = await prisma.batch.create({ data: { name: `WBR ${tag}`, code: `WBR-${tag}`, createdById: tUser.id } });
  const mkStudent = async (n: string) => {
    const su = await prisma.user.create({ data: { email: `wbr-${n}-${tag}@example.test`, passwordHash: "x", name: `WBR ${n}` } });
    return prisma.student.create({
      data: {
        userId: su.id, enrollmentNumber: `WBR-${n}-${tag}`, studentIdCode: `WBR${n}${tag}`, fatherName: "F", motherName: "M",
        dob: new Date("2008-01-01"), gender: "OTHER", class: "11", targetExam: "JEE", school: "S", city: "C", state: "S",
      },
    });
  };
  const online = await mkStudent("online");
  const left = await mkStudent("left");
  const absent = await mkStudent("absent");
  const guest = await mkStudent("guest");
  for (const s of [online, left, absent]) await prisma.batchEnrollment.create({ data: { batchId: batch.id, studentId: s.id } });
  const start = new Date(Date.now() - 10 * 60_000);
  const end = new Date(start.getTime() + 3600_000);
  const schedule = await prisma.batchSchedule.create({
    data: { batchId: batch.id, teacherId: teacher.id, title: `WBR ${tag}`, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: tUser.id },
  });
  const wb = await prisma.whiteboardSession.create({
    data: { batchScheduleId: schedule.id, teacherId: teacher.id, title: `WBR ${tag}`, scheduledStart: start, scheduledEnd: end },
  });
  const PPT = "https://pub-example.r2.dev/whiteboard-backgrounds/wbr-test-slide.png";
  await prisma.whiteboardPage.create({ data: { sessionId: wb.id, pageNumber: 1, objects: [], background: "dark" } });
  await prisma.whiteboardPage.create({ data: { sessionId: wb.id, pageNumber: 2, objects: [{ id: "o1", type: "stroke" }], background: PPT } });
  await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: wb.id, studentId: online.id, lastSeenAt: new Date() } });
  await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: wb.id, studentId: left.id, lastSeenAt: new Date(Date.now() - 30 * 60_000) } });
  await prisma.liveClassAttendance.create({ data: { whiteboardSessionId: wb.id, studentId: guest.id, lastSeenAt: new Date() } });
  sessionUserId = tUser.id;

  const params = { params: { id: wb.id } };
  const call = async (fn: (r: InstanceType<typeof NextRequest>, p: never) => Promise<Response>, method: string, body?: unknown, extra?: Record<string, string>) => {
    const req = new NextRequest(`https://example.test/x`, {
      method,
      ...(body !== undefined && { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    const res = await fn(req, { params: { id: wb.id, ...extra } } as never);
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  void params;

  try {
    console.log("Participants");
    const p = await call(participantsRoute.GET as never, "GET");
    const rows = (p.json?.data?.participants ?? []) as { name: string; isRecentlyActive: boolean; enrolled?: boolean }[];
    const names = rows.map((x) => `${x.name}:${x.isRecentlyActive ? "on" : "off"}`);
    assert(p.status === 200, `participants answers (${p.status})`);
    assert(!names.some((n) => n.startsWith("WBR absent")), "An enrolled student who never joined is not listed");
    assert(names.includes("WBR online:on") && names.includes("WBR guest:on") && names.includes("WBR left:off"), `Joined students, online/offline: ${names.join(", ")}`);
    assert(names[names.length - 1] === "WBR left:off", "Online students come first");
    assert(p.json?.data?.totalEnrolled === 3 && p.json?.data?.totalAttended === 3 && p.json?.data?.onlineCount === 2, "Counts: 3 enrolled, 3 joined, 2 online");
    assert(rows.find((x) => x.name === "WBR guest")?.enrolled === false, "A joined student outside the batch is marked");
    assert(new Set(rows.map((x) => x.name)).size === rows.length, "No student listed twice");

    console.log("Slides");
    const a = await call(pagesRoute.POST as never, "POST", { afterPageNumber: 1, background: "dark" });
    assert(a.status === 201 && a.json.data.page.pageNumber === 2 && a.json.data.page.background === "dark", `New slide after slide 1 keeps the dark theme (${a.status})`);
    assert(a.json?.data?.pages?.length === 3 && a.json.data.pages[2].background === PPT, "The PPT slide moved to 3 with its picture");

    const r = await call(pagesRoute.POST as never, "POST", { afterPageNumber: 0, background: "light", objects: [{ id: "r1", type: "stroke", tool: "pen", color: "#000", size: 2, points: [] }] });
    assert(r.status === 201 && r.json.data.page.pageNumber === 1 && r.json.data.page.objects.length === 1, `A deleted slide comes back first, with its ink (${r.status})`);

    const pptPage = r.json.data.pages.find((x: { background: string }) => x.background === PPT);
    const d = await call(pagesRoute.POST as never, "POST", { afterPageNumber: pptPage.pageNumber, duplicateOfPageId: pptPage.id });
    assert(d.status === 201 && d.json.data.page.background === PPT && d.json.data.page.pageNumber === pptPage.pageNumber + 1, "Duplicate goes right after, with the PPT picture");
    assert(d.json.data.page.id !== pptPage.id && JSON.stringify(d.json.data.page.objects) === JSON.stringify(pptPage.objects), "Duplicate is its own slide with the same ink");

    // Ink on the copy must not reach the original.
    const patch = await call(pageRoute.PATCH as never, "PATCH", { objects: [{ id: "o1", type: "stroke" }, { id: "copy-only", type: "stroke" }] }, { pageId: d.json.data.page.id });
    const orig = await prisma.whiteboardPage.findUnique({ where: { id: pptPage.id } });
    assert(patch.status === 200 && (orig?.objects as unknown[]).length === 1, "Drawing on the copy leaves the original unchanged");

    const del = await call(pageRoute.DELETE as never, "DELETE", undefined, { pageId: d.json.data.page.id });
    assert(del.status === 200 && del.json.data.pages.some((x: { id: string; background: string }) => x.id === pptPage.id && x.background === PPT), "Deleting the copy leaves the original PPT slide");
    const numbers = del.json.data.pages.map((x: { pageNumber: number }) => x.pageNumber).join(",");
    assert(numbers === "1,2,3,4", `Slides renumbered with no gaps (${numbers})`);

    const ids: string[] = del.json.data.pages.map((x: { id: string }) => x.id);
    const rev = [...ids].reverse();
    const ro = await call(reorderRoute.PATCH as never, "PATCH", { orderedPageIds: rev });
    const order = (res: typeof ro) => (res.json.data.pages as { id: string; pageNumber: number }[]).sort((x, y) => x.pageNumber - y.pageNumber).map((x) => x.id).join();
    assert(ro.status === 200 && order(ro) === rev.join(), `Reorder applied (${ro.status})`);
    const back = await call(reorderRoute.PATCH as never, "PATCH", { orderedPageIds: ids });
    assert(back.status === 200 && order(back) === ids.join(), "Reorder back (undo) applied");

    const bad = await call(pagesRoute.POST as never, "POST", { afterPageNumber: -1 });
    assert(bad.status === 400 || bad.status === 422, `A negative position is refused (${bad.status})`);
    const gone = await call(pagesRoute.POST as never, "POST", { duplicateOfPageId: "nope" });
    assert(gone.status === 404, `Duplicating a missing slide is refused (${gone.status})`);
    const legacy = await call(pagesRoute.POST as never, "POST");
    assert(legacy.status === 201 && legacy.json.data.page.pageNumber === 5, `The old empty add still puts a slide at the end (${legacy.status})`);

    // Someone else cannot add slides to this class.
    sessionUserId = absent.userId;
    const forbidden = await call(pagesRoute.POST as never, "POST", { afterPageNumber: 0 });
    assert(forbidden.status === 403, `A student cannot add slides (${forbidden.status})`);
  } finally {
    await prisma.whiteboardSession.delete({ where: { id: wb.id } }).catch(() => undefined);
    await prisma.batchSchedule.delete({ where: { id: schedule.id } }).catch(() => undefined);
    await prisma.batch.delete({ where: { id: batch.id } }).catch(() => undefined);
    for (const s of [online, left, absent, guest]) {
      await prisma.student.delete({ where: { id: s.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: s.userId } }).catch(() => undefined);
    }
    await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: tUser.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
