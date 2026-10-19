/**
 * A class's YouTube live link saved on its schedule before class (whoever
 * manages the schedule), used at Start — LOCAL test database only.
 *
 * Run (localhost database whose name contains "test"; needs the local
 * qc-admin@example.test admin user):
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5434/qc_test" \
 *     npx tsx --tsconfig tsconfig.json scripts/test-class-youtube-link-db.ts
 */
import "./qc/_stub";

const testUrl = process.env.TEST_DATABASE_URL ?? "";
const u = new URL(testUrl || "postgresql://x/none");
if (!["localhost", "127.0.0.1"].includes(u.hostname) || !/test/i.test(u.pathname)) {
  console.error('Refusing: TEST_DATABASE_URL must be a localhost database whose name contains "test".');
  process.exit(2);
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;

let passed = 0;
let failed = 0;
const assert = (c: unknown, l: string) => {
  if (c) passed++;
  else failed++;
  console.log(`  ${c ? "ok  " : "FAIL"} ${l}`);
};

async function run() {
  const { prisma } = await import("../src/lib/db");
  const { setLectureLiveYouTubeLink, scheduledLiveYouTubeId, lectureLiveLinks } = await import("../src/lib/live-class/class-youtube-link");
  const admin = await prisma.user.findFirst({ where: { email: "qc-admin@example.test" } });
  if (!admin) throw new Error("qc-admin@example.test is missing from the test database");
  const tag = Date.now().toString(36);
  const plain = await prisma.user.create({ data: { email: `cyl-${tag}@example.test`, passwordHash: "x", name: "No permissions" } });
  const teacher = (await prisma.teacher.findFirst()) ?? (await prisma.teacher.create({ data: { userId: admin.id, employeeCode: `CYL-${tag}`, department: "Physics" } }));
  const course = await prisma.course.create({ data: { title: `CYL ${tag}`, slug: `cyl-${tag}` } });
  const subject = await prisma.subject.create({ data: { title: "Physics", courseId: course.id } });
  const chapter = await prisma.chapter.create({ data: { title: `CYL ${tag}`, subjectId: subject.id } });
  const lecture = await prisma.lecture.create({ data: { chapterId: chapter.id, title: `CYL lecture ${tag}`, videoUrl: "", teacherId: teacher.id } as never });
  const b1 = await prisma.batch.create({ data: { name: `CYL A ${tag}`, code: `CYLA-${tag}`, createdById: admin.id } });
  const b2 = await prisma.batch.create({ data: { name: `CYL B ${tag}`, code: `CYLB-${tag}`, createdById: admin.id } });
  const at = new Date(Date.now() + 24 * 3600_000);
  const mk = (batchId: string, extra: Record<string, unknown> = {}) =>
    prisma.batchSchedule.create({
      data: { batchId, teacherId: teacher.id, title: `CYL class ${tag}`, type: "LIVE_CLASS", startsAt: at, endsAt: new Date(at.getTime() + 3600_000), createdById: admin.id, lectureId: lecture.id, chapterId: chapter.id, ...extra } as never,
    });
  const s1 = await mk(b1.id);
  const s2 = await mk(b2.id);
  const done = await mk(b1.id, { status: "COMPLETED", youtubeUrl: "https://youtu.be/OLDOLDOLD11", startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() - 82_800_000) });

  try {
    assert((await scheduledLiveYouTubeId(s1)) === null, "No saved link: Start falls back as before (no id)");
    const bad = await setLectureLiveYouTubeLink(admin.id, lecture.id, "https://example.com/not-youtube");
    assert(!bad.ok && bad.status === 400, "A link that is not YouTube is refused");
    const noPerm = await setLectureLiveYouTubeLink(plain.id, lecture.id, "https://youtube.com/live/AbCdEfGhIjK");
    assert(!noPerm.ok && noPerm.status === 403, "Someone who does not manage the schedule cannot set it");
    const ok = await setLectureLiveYouTubeLink(admin.id, lecture.id, "https://youtube.com/live/AbCdEfGhIjK?feature=share");
    assert(ok.ok && ok.updated === 2, `Saved on both batches' upcoming classes (${ok.ok ? ok.updated : ok.error})`);
    const r1 = await prisma.batchSchedule.findUnique({ where: { id: s1.id } });
    assert(r1?.classMode === "APP_AND_YOUTUBE" && r1.youtubeUrl?.includes("AbCdEfGhIjK"), "The class is marked App + YouTube with the link");
    const oldOne = await prisma.batchSchedule.findUnique({ where: { id: done.id } });
    assert(oldOne?.youtubeUrl === "https://youtu.be/OLDOLDOLD11", "A class that already ran keeps its own link (its recording)");
    assert((await scheduledLiveYouTubeId(r1!)) === "AbCdEfGhIjK", "Start gets the video id from the saved link");
    // A new batch's class of the same lecture, made later without a link, uses its sibling's.
    const s3 = await mk((await prisma.batch.create({ data: { name: `CYL C ${tag}`, code: `CYLC-${tag}`, createdById: admin.id } })).id);
    assert((await scheduledLiveYouTubeId(s3)) === "AbCdEfGhIjK", "A later batch class of the lecture uses the lecture's link");
    assert((await scheduledLiveYouTubeId({ ...r1!, classMode: "APP_ONLY" })) === null, "An App-only class never uses a public link");
    assert((await lectureLiveLinks([lecture.id])).get(lecture.id)?.includes("AbCdEfGhIjK"), "The chapter page gets the lecture's link for its form");
    const cleared = await setLectureLiveYouTubeLink(admin.id, lecture.id, "");
    const r1b = await prisma.batchSchedule.findUnique({ where: { id: s1.id } });
    assert(cleared.ok && r1b?.youtubeUrl === null && r1b.classMode === null, "An empty link removes it again");
    await prisma.batchSchedule.delete({ where: { id: s3.id } });
  } finally {
    await prisma.batchSchedule.deleteMany({ where: { lectureId: lecture.id } });
    await prisma.batch.deleteMany({ where: { code: { startsWith: "CYL" }, name: { contains: tag } } });
    await prisma.lecture.delete({ where: { id: lecture.id } }).catch(() => undefined);
    await prisma.chapter.delete({ where: { id: chapter.id } }).catch(() => undefined);
    await prisma.subject.delete({ where: { id: subject.id } }).catch(() => undefined);
    await prisma.course.delete({ where: { id: course.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: plain.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
