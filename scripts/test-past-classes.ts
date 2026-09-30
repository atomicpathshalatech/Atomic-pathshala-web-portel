/**
 * "Add past class" (recorded YouTube classes added on their real date).
 *
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-past-classes.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";
import { canonicalYouTubeUrl, checkYouTubeEmbeddable, parseYouTubeVideoId } from "../src/lib/youtube/video-link";
import { pastClassCreateSchema } from "../src/lib/validation/batch";
import { lectureUpdateSchema } from "../src/lib/validation/lecture";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ---- 1. YouTube links ---------------------------------------------------------
const ID = "dQw4w9WgXcQ";
for (const link of [
  ID,
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?feature=share&v=${ID}&t=30`,
  `https://m.youtube.com/watch?v=${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `youtu.be/${ID}`,
  `https://www.youtube.com/live/${ID}?si=xyz`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}`,
]) {
  assert(parseYouTubeVideoId(link) === ID, `YouTube link understood: ${link}`);
}
for (const bad of ["https://vimeo.com/123", "hello", "https://www.youtube.com/channel/UCabc", "https://youtu.be/short"]) {
  assert(parseYouTubeVideoId(bad) === null, `Not a video link: ${bad}`);
}
assert(canonicalYouTubeUrl(ID) === `https://www.youtube.com/watch?v=${ID}`, "Saved in the one format every player understands");

// ---- 2. Form rules --------------------------------------------------------------
const base = { chapterId: "c", teacherId: "t", title: "Cell — Lecture 1", youtubeUrl: ID };
assert(pastClassCreateSchema.safeParse({ ...base, startsAt: "2026-07-01T10:00:00+05:30" }).success, "A past date is accepted");
assert(!pastClassCreateSchema.safeParse({ ...base, startsAt: new Date(Date.now() + 86_400_000).toISOString() }).success, "A future date is refused (that's the normal schedule form)");
assert(pastClassCreateSchema.parse({ ...base, startsAt: "2026-07-01T10:00:00+05:30" }).durationMin === 60, "Duration defaults to 60 min");
assert(lectureUpdateSchema.safeParse({ slidesUrl: "/api/batch-materials/abc123?inline=1" }).success, "Editing a lecture keeps an uploaded-notes link valid");
assert(lectureUpdateSchema.safeParse({ slidesUrl: "https://example.com/n.pdf" }).success && !lectureUpdateSchema.safeParse({ slidesUrl: "javascript:alert(1)" }).success, "Notes link: full URL or app path only");

async function run() {
  // ---- 3. Embedding check (YouTube oEmbed; faked responses) ----
  const fake = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;
  assert((await checkYouTubeEmbeddable(ID, fake(200))) === "ok", "oEmbed 200 → plays in the app");
  assert((await checkYouTubeEmbeddable(ID, fake(401))) === "not_embeddable", "oEmbed 401 → embedding is off");
  assert((await checkYouTubeEmbeddable(ID, fake(404))) === "not_found", "oEmbed 404 → private / deleted");
  const offline = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert((await checkYouTubeEmbeddable(ID, offline)) === "unknown", "No network → unknown (doesn't block saving)");

  // ---- 4. Against a real database ----
  prepareTestDatabase(testUrl, parsed);
  const { prisma } = await import("../src/lib/db");
  const { createPastClass, PastClassError, pastClassOptions } = await import("../src/lib/batch/past-classes");

  const admin = await prisma.user.create({ data: { email: "admin@test.local", passwordHash: "x", name: "Admin" } });
  const other = await prisma.user.create({ data: { email: "other@test.local", passwordHash: "x", name: "Other" } });
  const tUser = await prisma.user.create({ data: { email: "t@test.local", passwordHash: "x", name: "Md Moaz Ahmed" } });
  const teacher = await prisma.teacher.create({ data: { userId: tUser.id, employeeCode: "T-1", department: "Biology" } });
  const course = await prisma.course.create({ data: { title: "NEET 2027", slug: "neet-2027" } });
  const bio = await prisma.subject.create({ data: { title: "Biology", courseId: course.id } });
  const cell = await prisma.chapter.create({ data: { title: "Cell: The Unit of Life", subjectId: bio.id, status: "PUBLISHED" } });
  const draft = await prisma.chapter.create({ data: { title: "Biomolecules", subjectId: bio.id, status: "DRAFT" } });
  const otherCourse = await prisma.course.create({ data: { title: "Other", slug: "other" } });
  const otherSubject = await prisma.subject.create({ data: { title: "Physics", courseId: otherCourse.id } });
  const foreign = await prisma.chapter.create({ data: { title: "Motion", subjectId: otherSubject.id, status: "PUBLISHED" } });
  const batch = await prisma.batch.create({ data: { name: "Batch July", code: "JUL-26", createdById: admin.id, courseId: course.id } });
  await prisma.batchTeacher.create({ data: { batchId: batch.id, teacherId: teacher.id, subject: "Biology" } });

  const opts = await pastClassOptions(batch.id);
  assert(Boolean(opts?.chapters.some((c) => c.id === cell.id) && !opts?.chapters.some((c) => c.id === foreign.id)), "Form lists this batch's chapters only");
  assert(opts?.chapters.find((c) => c.id === draft.id)?.visibleToStudents === false, "Form flags an unpublished chapter");
  assert(opts?.teachers[0]?.name === "Md Moaz Ahmed", "Form lists the batch's teachers");

  const ok = async () => "ok" as const;
  const add = (over: Partial<Parameters<typeof createPastClass>[2]> = {}, user = admin.id, checkEmbed: () => Promise<"ok" | "not_embeddable" | "not_found" | "unknown"> = ok) =>
    createPastClass(
      batch.id,
      user,
      pastClassCreateSchema.parse({ chapterId: cell.id, teacherId: teacher.id, title: "Cell — Lecture 2", youtubeUrl: `https://youtu.be/${ID}`, startsAt: "2026-07-03T10:00:00+05:30", ...over }),
      { checkEmbed }
    );
  const err = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof PastClassError ? e : null));

  const notificationsBefore = await prisma.notification.count().catch(() => 0);
  const second = await add();
  const lecture2 = await prisma.lecture.findUniqueOrThrow({ where: { id: second.lectureId } });
  const sched2 = await prisma.batchSchedule.findUniqueOrThrow({ where: { id: second.scheduleId } });
  assert(lecture2.status === "PUBLISHED" && lecture2.videoUrl === `https://www.youtube.com/watch?v=${ID}`, "Lecture published with the YouTube video");
  assert(lecture2.startTime === "10:00" && lecture2.endTime === "11:00" && lecture2.scheduledDate?.toISOString() === "2026-07-03T04:30:00.000Z", "Lecture keeps its real date and IST time");
  assert(sched2.status === "COMPLETED" && sched2.startsAt.toISOString() === "2026-07-03T04:30:00.000Z" && sched2.lectureId === lecture2.id, "Timetable: Completed, on its real date, linked to the lecture");
  assert(sched2.id === `${lecture2.id}-${batch.id}`, "Timetable id matches the chapter-assign sync (no duplicate if the chapter is re-assigned)");
  assert((await prisma.whiteboardSession.count({ where: { batchScheduleId: sched2.id } })) === 0, "No live room is created for a past class");
  assert((await prisma.notification.count().catch(() => 0)) === notificationsBefore, "Nobody is notified");
  assert((await prisma.batchChapter.count({ where: { batchId: batch.id, chapterId: cell.id } })) === 1, "Chapter is assigned to the batch");

  // Added out of order → still in date order in the chapter.
  const first = await add({ title: "Cell — Lecture 1", startsAt: new Date("2026-07-01T10:00:00+05:30") });
  const third = await add({ title: "Cell — Lecture 3", startsAt: new Date("2026-07-05T10:00:00+05:30") });
  const ordered = await prisma.lecture.findMany({ where: { chapterId: cell.id }, orderBy: { order: "asc" }, select: { id: true } });
  assert(ordered.map((l) => l.id).join() === [first.lectureId, second.lectureId, third.lectureId].join(), "Chapter lists the classes in date order even when added out of order");

  assert((await err(add()))?.status === 409, "The same class twice (same chapter + time) is refused");
  assert((await err(add({ startsAt: new Date("2026-07-07T10:00:00+05:30") }, admin.id, async () => "not_embeddable")))?.message.includes("Allow embedding") === true, "Embedding off → clear fix in the message");
  assert((await err(add({ startsAt: new Date("2026-07-07T10:00:00+05:30") }, admin.id, async () => "not_found")))?.message.includes("Unlisted") === true, "Private/deleted video → clear message");
  assert(Boolean(await add({ title: "Cell — Lecture 4", startsAt: new Date("2026-07-06T10:00:00+05:30") }, admin.id, async () => "unknown")), "YouTube unreachable → still saved");
  assert((await err(add({ chapterId: foreign.id, startsAt: new Date("2026-07-08T10:00:00+05:30") })))?.message.includes("isn't part of this batch") === true, "A chapter from another course is refused");
  assert((await err(add({ youtubeUrl: "https://vimeo.com/1", startsAt: new Date("2026-07-08T10:00:00+05:30") })))?.message.includes("YouTube") === true, "A non-YouTube link is refused");

  // Notes PDF → batch materials, linked from the lecture.
  const asset = await prisma.fileAsset.create({
    data: { ownerId: admin.id, fileType: "NOTES", storageKey: "notes/x/cell-l5.pdf", originalFilename: "cell-l5.pdf", mimeType: "application/pdf", status: "ACTIVE", sizeBytes: BigInt(1234) },
  });
  const withNotes = await add({ title: "Cell — Lecture 5", startsAt: new Date("2026-07-09T10:00:00+05:30"), notesFileAssetId: asset.id });
  const file = await prisma.batchFolderFile.findUniqueOrThrow({ where: { id: withNotes.notesFileId! }, include: { folder: { include: { parent: { include: { parent: true } } } } } });
  assert(file.folder.name === "Biology" && file.folder.parent?.name === "Class Notes" && file.folder.parent?.parent?.name === "Syllabus & Schedule", "Notes filed under Syllabus & Schedule → Class Notes → Biology");
  const lecture5 = await prisma.lecture.findUniqueOrThrow({ where: { id: withNotes.lectureId } });
  assert(lecture5.slidesUrl === `/api/batch-materials/${file.id}?inline=1`, "Lecture's notes open through the enrolment-checked material link");
  const another = await add({ title: "Cell — Lecture 6", startsAt: new Date("2026-07-10T10:00:00+05:30"), notesFileAssetId: (await prisma.fileAsset.create({ data: { ownerId: admin.id, fileType: "NOTES", storageKey: "notes/x/l6.pdf", originalFilename: "l6.pdf", mimeType: "application/pdf", status: "ACTIVE" } })).id });
  assert((await prisma.batchFolder.count({ where: { batchId: batch.id, name: "Class Notes" } })) === 1 && Boolean(another.notesFileId), "Folders are reused, not duplicated");
  const foreignAsset = await prisma.fileAsset.create({ data: { ownerId: other.id, fileType: "NOTES", storageKey: "notes/y/secret.pdf", originalFilename: "secret.pdf", mimeType: "application/pdf", status: "ACTIVE" } });
  assert((await err(add({ startsAt: new Date("2026-07-11T10:00:00+05:30"), notesFileAssetId: foreignAsset.id })))?.status === 403, "Can't attach someone else's upload");
  const notPdf = await prisma.fileAsset.create({ data: { ownerId: admin.id, fileType: "NOTES", storageKey: "notes/x/a.png", originalFilename: "a.png", mimeType: "image/png", status: "ACTIVE" } });
  assert((await err(add({ startsAt: new Date("2026-07-11T10:00:00+05:30"), notesFileAssetId: notPdf.id })))?.message.includes("PDF") === true, "Notes must be a PDF");
  const pending = await prisma.fileAsset.create({ data: { ownerId: admin.id, fileType: "NOTES", storageKey: "notes/x/p.pdf", originalFilename: "p.pdf", mimeType: "application/pdf", status: "PENDING_UPLOAD" } });
  assert((await err(add({ startsAt: new Date("2026-07-11T10:00:00+05:30"), notesFileAssetId: pending.id })))?.status === 410, "An unfinished upload is refused");
  assert((await prisma.batchSchedule.count({ where: { batchId: batch.id, startsAt: new Date("2026-07-11T10:00:00+05:30") } })) === 0, "A refused class leaves nothing behind");

  // ---- 5. Wiring ----
  const route = read("src/app/api/team/batches/[id]/past-classes/route.ts");
  assert(route.includes("PERMISSIONS.BATCH_SCHEDULE_MANAGE") && route.includes("PERMISSIONS.LECTURE_PUBLISH"), "Only staff who manage the timetable and publish lectures can add past classes");
  assert(!read("src/lib/batch/past-classes.ts").includes("triggerNotificationEvent"), "Past classes never trigger notifications");
  assert(read("src/components/team-portal/BatchScheduleManager.tsx").includes("<PastClassForm"), "\"Add Past Class\" is on the batch timetable");

  await prisma.$disconnect();
}

run()
  .then(() => finish())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
