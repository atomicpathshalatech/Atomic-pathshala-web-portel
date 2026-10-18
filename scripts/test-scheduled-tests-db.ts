/**
 * Scheduled chapter tests, against a LOCAL test database: made for a set
 * time, a draft until then (questions can be added; students see it as
 * Upcoming and cannot open it), published by itself at that time, and locked
 * from then on. Calls the real route handlers with a team user's / a
 * student's session.
 *
 * Run (localhost database whose name contains "test"; needs the
 * qc-admin@example.test admin user that the local QC setup created):
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/qc_test" \
 *     npx tsx --tsconfig tsconfig.json scripts/test-scheduled-tests-db.ts
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

let sessionUser: { id: string; role?: string } = { id: "" };
// next-auth re-exports getServerSession from next-auth/next through a getter, so replacing it there is enough.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("next-auth/next").getServerSession = async () => ({ user: sessionUser });

let passed = 0;
let failed = 0;
const assert = (c: unknown, l: string) => {
  if (c) passed++;
  else failed++;
  console.log(`  ${c ? "ok  " : "FAIL"} ${l}`);
};

async function run() {
  const { prisma } = await import("../src/lib/db");
  const { NextRequest } = await import("next/server");
  const sp = await import("../src/lib/tests/scheduled-publish");
  const chapterTests = await import("../src/app/api/team/chapters/[id]/tests/route");
  const chapterTest = await import("../src/app/api/team/chapters/[id]/tests/[testId]/route");
  const testQuestions = await import("../src/app/api/team/tests/[id]/questions/route");
  const testQuestion = await import("../src/app/api/team/tests/[id]/questions/[testQuestionId]/route");
  const attempts = await import("../src/app/api/tests/[id]/attempts/route");
  const upcoming = await import("../src/app/api/student/upcoming-test/route");

  type Handler = (r: InstanceType<typeof NextRequest>, ctx: never) => Promise<Response>;
  const call = async (fn: unknown, method: string, params: Record<string, string>, body?: unknown) => {
    const req = new NextRequest("https://example.test/x", {
      method,
      ...(body !== undefined && { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    const res = await (fn as Handler)(req, { params } as never);
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };

  // ---- Pure rules ----
  console.log("Rules");
  const now = new Date("2026-10-15T08:00:00Z");
  const at2pm = new Date("2026-10-15T08:30:00Z");
  assert(sp.isTestEditable({ status: "DRAFT", openTime: at2pm }, now), "Draft before its time: can be changed");
  assert(sp.isTestEditable({ status: "DRAFT", openTime: at2pm }, new Date(at2pm.getTime() - 60_000)), "One minute before the time: still can be changed");
  assert(!sp.isTestEditable({ status: "DRAFT", openTime: at2pm }, at2pm), "At its time: locked");
  assert(!sp.isTestEditable({ status: "PUBLISHED", openTime: null }, now), "Published: locked");
  assert(sp.isTestEditable({ status: "DRAFT", openTime: null }, now), "Draft with no time: can be changed");

  // ---- Seed ----
  const admin = await prisma.user.findFirst({ where: { email: "qc-admin@example.test" } });
  if (!admin) throw new Error("qc-admin@example.test is missing from the test database");
  const tag = Date.now().toString(36);
  const course = await prisma.course.create({ data: { title: `STQ ${tag}`, slug: `stq-${tag}` } });
  const subject = await prisma.subject.create({ data: { title: "Physics", courseId: course.id } });
  const chapter = await prisma.chapter.create({ data: { title: `STQ Chapter ${tag}`, subjectId: subject.id } });
  const batch = await prisma.batch.create({ data: { name: `STQ ${tag}`, code: `STQ-${tag}`, createdById: admin.id, courseId: course.id } });
  const sUser = await prisma.user.create({ data: { email: `stq-s-${tag}@example.test`, passwordHash: "x", name: "STQ Student" } });
  const student = await prisma.student.create({
    data: {
      userId: sUser.id, enrollmentNumber: `STQ-${tag}`, studentIdCode: `STQ${tag}`, fatherName: "F", motherName: "M",
      dob: new Date("2008-01-01"), gender: "OTHER", class: "11", targetExam: "NEET", school: "S", city: "C", state: "S",
    },
  });
  await prisma.batchEnrollment.create({ data: { batchId: batch.id, studentId: student.id } });
  const question = await prisma.question.create({ data: { subject: "Physics", questionCode: `STQ-Q-${tag}` } });
  const created: string[] = [];
  const asTeam = () => (sessionUser = { id: admin.id });
  const asStudent = () => (sessionUser = { id: sUser.id, role: "STUDENT" });

  try {
    console.log("Creating a chapter test");
    asTeam();
    const noTime = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: "No time" });
    assert(noTime.status === 400, `A test without a date & time is refused (${noTime.status})`);
    const past = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: "Past", openTime: new Date(Date.now() - 3600_000).toISOString() });
    assert(past.status === 400, `A time in the past is refused (${past.status})`);
    const when = new Date(Date.now() + 2 * 3600_000);
    const ok = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: `STQ Test ${tag}`, openTime: when.toISOString(), durationMin: 30 });
    const test = ok.json?.data?.test;
    if (test) created.push(test.id);
    assert(ok.status === 201 && test.status === "DRAFT" && new Date(test.openTime).getTime() === when.getTime(), `Created as a draft with its time (${ok.status} ${test?.status})`);
    const secs = await prisma.section.findMany({ where: { testId: test.id } });
    assert(secs.length === 1 && secs[0]!.subject === "Physics" && secs[0]!.targetCount === 45, `One Physics section, 45 questions by default (${secs.map((x) => x.subject + ":" + x.targetCount).join(",")})`);
    const custom = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: `STQ Custom ${tag}`, openTime: when.toISOString(), questionCount: 25 });
    if (custom.json?.data?.test?.id) created.push(custom.json.data.test.id);
    const customSec = await prisma.section.findFirst({ where: { testId: custom.json?.data?.test?.id } });
    assert(custom.status === 201 && customSec?.targetCount === 25, "The team can choose its own number of questions (25)");
    const tooMany = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: "Too many", openTime: when.toISOString(), questionCount: 500 });
    assert(tooMany.status === 400, `More than 200 questions is refused (${tooMany.status})`);

    console.log("Before its time");
    const add = await call(testQuestions.POST, "POST", { id: test.id }, { questionIds: [question.id] });
    assert(add.status === 200 && add.json.data.added === 1, `Questions can be added before the time (${add.status})`);
    asStudent();
    const early = await call(attempts.POST, "POST", { id: test.id });
    assert(early.status === 409 && /opens at/i.test(early.json?.error ?? ""), `A student cannot start it early (${early.status}: ${early.json?.error})`);
    const up = await call(upcoming.GET, "GET", {});
    assert(up.json?.data?.upcomingTest?.id === test.id || up.json?.data?.upcomingTest?.testId === test.id || JSON.stringify(up.json).includes(test.id), "It shows in the student's upcoming test");
    asTeam();
    const bad = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: test.id }, { status: "ARCHIVED" });
    assert(bad.status === 400, `Setting any other status from the chapter page is refused (${bad.status})`);
    const moved = new Date(Date.now() + 3 * 3600_000);
    const resched = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: test.id }, { openTime: moved.toISOString() });
    assert(resched.status === 200 && new Date(resched.json.data.test.openTime).getTime() === moved.getTime(), "Its time can be changed before it starts");
    const recount = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: test.id }, { questionCount: 30 });
    const sec30 = await prisma.section.findFirst({ where: { testId: test.id } });
    assert(recount.status === 200 && sec30?.targetCount === 30, "Its number of questions can be changed before it starts");
    const below = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: test.id }, { questionCount: 0 });
    assert(below.status === 400, `0 questions is refused (${below.status})`);

    console.log("At its time");
    // The set time has come.
    await prisma.test.update({ where: { id: test.id }, data: { openTime: new Date(Date.now() - 1000) } });
    const late = await call(testQuestions.POST, "POST", { id: test.id }, { questionIds: [question.id] });
    assert(late.status === 409 && /started/i.test(late.json?.error ?? ""), `Questions can no longer be added (${late.status}: ${late.json?.error})`);
    const remove = await call(testQuestion.DELETE, "DELETE", { id: test.id, testQuestionId: question.id });
    assert(remove.status === 409, `…or removed (${remove.status})`);
    const rename = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: test.id }, { correctMarks: 5 });
    assert(rename.status === 409, `…and its marks can no longer change (${rename.status})`);
    asStudent();
    const start = await call(attempts.POST, "POST", { id: test.id });
    assert(start.status === 201, `The student can start it now (${start.status}: ${start.json?.error ?? ""})`);
    const after = await prisma.test.findUnique({ where: { id: test.id }, select: { status: true } });
    assert(after?.status === "PUBLISHED", "It published itself at its time");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: test.id, action: "TEST_AUTO_PUBLISHED" } });
    assert(Boolean(audit), "The automatic publish is in the audit log");
    const q = await prisma.question.findUnique({ where: { id: question.id }, select: { isPublished: true } });
    assert(q?.isPublished === true, "Its questions were published with it");

    console.log("A chapter in no batch");
    asTeam();
    const lone = await prisma.chapter.create({ data: { title: `STQ Lone ${tag}`, subjectId: (await prisma.subject.create({ data: { title: "Chemistry", courseId: (await prisma.course.create({ data: { title: `STQ2 ${tag}`, slug: `stq2-${tag}` } })).id } })).id } });
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString();
    const noBatch = await call(chapterTests.POST, "POST", { id: lone.id }, { name: `STQ Lone test ${tag}`, openTime: soon });
    if (noBatch.json?.data?.test?.id) created.push(noBatch.json.data.test.id);
    assert(noBatch.status === 201 && /no batch/i.test(noBatch.json?.data?.warning ?? ""), "A test in a chapter with no batch is made, with a warning that no student will see it");
    asStudent();
    const before = await call(upcoming.GET, "GET", {});
    assert(!JSON.stringify(before.json).includes(noBatch.json.data.test.id), "…and it is not in the student's upcoming tests");
    asTeam();
    const put = await call(chapterTest.PATCH, "PATCH", { id: lone.id, testId: noBatch.json.data.test.id }, { batchIds: [batch.id] });
    const bc = await prisma.batchChapter.findFirst({ where: { batchId: batch.id, chapterId: lone.id } });
    assert(put.status === 200 && Boolean(bc), `Choosing the batch puts the chapter in it (${put.status})`);
    const { chaptersOfBatches } = await import("../src/lib/batch/batch-chapters");
    assert((await chaptersOfBatches([batch.id])).has(lone.id), "…so the batch's schedule and batch page now include the chapter's test");
    await prisma.batchChapter.deleteMany({ where: { chapterId: lone.id } });

    console.log("A test with no questions when its time comes");
    asTeam();
    const empty = await call(chapterTests.POST, "POST", { id: chapter.id }, { name: `STQ Empty ${tag}`, openTime: new Date(Date.now() + 3600_000).toISOString() });
    const emptyId = empty.json?.data?.test?.id;
    if (emptyId) created.push(emptyId);
    await prisma.test.update({ where: { id: emptyId }, data: { openTime: new Date(Date.now() - 1000) } });
    await sp.publishDueTests({ testIds: [emptyId] });
    const stillDraft = await prisma.test.findUnique({ where: { id: emptyId }, select: { status: true } });
    assert(stillDraft?.status === "DRAFT", "It stays unpublished (nothing to take)");
    asStudent();
    const cant = await call(attempts.POST, "POST", { id: emptyId });
    assert(cant.status === 409 && /isn't published/i.test(cant.json?.error ?? ""), `A student cannot open it (${cant.status}: ${cant.json?.error})`);
    asTeam();
    const pubEmpty = await call(chapterTest.PATCH, "PATCH", { id: chapter.id, testId: emptyId }, { status: "PUBLISHED" });
    assert(pubEmpty.status === 400 && /question/i.test(pubEmpty.json?.error ?? ""), `"Publish now" explains what is missing (${pubEmpty.status}: ${pubEmpty.json?.error})`);
  } finally {
    await prisma.attempt.deleteMany({ where: { testId: { in: created } } }).catch(() => undefined);
    await prisma.sectionQuestion.deleteMany({ where: { section: { testId: { in: created } } } }).catch(() => undefined);
    await prisma.section.deleteMany({ where: { testId: { in: created } } }).catch(() => undefined);
    await prisma.test.deleteMany({ where: { id: { in: created } } }).catch(() => undefined);
    await prisma.question.delete({ where: { id: question.id } }).catch(() => undefined);
    await prisma.batch.delete({ where: { id: batch.id } }).catch(() => undefined);
    await prisma.student.delete({ where: { id: student.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: sUser.id } }).catch(() => undefined);
    await prisma.chapter.delete({ where: { id: chapter.id } }).catch(() => undefined);
    await prisma.subject.delete({ where: { id: subject.id } }).catch(() => undefined);
    await prisma.course.delete({ where: { id: course.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
