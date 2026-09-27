/**
 * LOCAL DEV ONLY: rebuilds a disposable local test database and seeds one
 * teacher, one student, a batch and two live classes starting now (an App
 * class and a YouTube class) for checking the live-class UI in a browser.
 *
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/dev-seed-live-class.ts
 *
 * Same safety guard as the DB tests (localhost "test" DB only). Generated
 * passwords are written to .env.dev-accounts (gitignored), never printed.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prepareTestDatabase, requireTestDatabase } from "./lib/test-db";

const { testUrl, parsed } = requireTestDatabase();

async function run() {
  prepareTestDatabase(testUrl, parsed);
  const bcrypt = (await import("bcryptjs")).default;
  const { prisma } = await import("../src/lib/db");

  const pw = () => randomBytes(9).toString("base64url");
  const teacherPw = pw();
  const studentPw = pw();

  const [teacherRole, studentRole] = await Promise.all([
    prisma.role.create({ data: { name: "TEACHER", label: "Teacher" } }),
    prisma.role.create({ data: { name: "STUDENT", label: "Student" } }),
  ]);
  const tUser = await prisma.user.create({
    data: { email: "teacher.dev@atomic.test", name: "Dev Teacher", passwordHash: await bcrypt.hash(teacherPw, 10), status: "ACTIVE", roleId: teacherRole.id },
  });
  const sUser = await prisma.user.create({
    data: { email: "student.dev@atomic.test", name: "Dev Student", passwordHash: await bcrypt.hash(studentPw, 10), status: "ACTIVE", roleId: studentRole.id },
  });
  const teacher = await prisma.teacher.create({ data: { userId: tUser.id, employeeCode: "DEV-T1", department: "Physics" } });
  const student = await prisma.student.create({
    data: { userId: sUser.id, enrollmentNumber: "DEV-E1", studentIdCode: "DEV-S1", fatherName: "F", motherName: "M", dob: new Date("2008-01-01"), gender: "MALE", class: "12", targetExam: "NEET", school: "Dev School", city: "Dev", state: "Dev" },
  });
  const batch = await prisma.batch.create({ data: { name: "Dev Batch", code: "DEV-B1", createdById: tUser.id, status: "ACTIVE" } as any });
  await prisma.batchTeacher.create({ data: { batchId: batch.id, teacherId: teacher.id } });
  await prisma.batchEnrollment.create({ data: { batchId: batch.id, studentId: student.id, status: "ACTIVE" } });

  const start = new Date(Date.now() + 2 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const mk = async (title: string, videoTransport: "LIVEKIT" | "YOUTUBE") => {
    const s = await prisma.batchSchedule.create({
      data: { batchId: batch.id, teacherId: teacher.id, title, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: tUser.id },
    });
    await prisma.whiteboardSession.create({
      data: { batchScheduleId: s.id, teacherId: teacher.id, title, videoTransport, livePhase: "SCHEDULED", scheduledStart: start, scheduledEnd: end },
    });
    return s.id;
  };
  const appClass = await mk("Dev App Class (room)", "LIVEKIT");
  const ytClass = await mk("Dev YouTube Class", "YOUTUBE");

  writeFileSync(
    ".env.dev-accounts",
    [
      `# Local dev accounts for ${parsed.pathname.slice(1)} on ${parsed.hostname} — generated ${new Date().toISOString()}`,
      `DEV_TEACHER_EMAIL=teacher.dev@atomic.test`,
      `DEV_TEACHER_PASSWORD=${teacherPw}`,
      `DEV_STUDENT_EMAIL=student.dev@atomic.test`,
      `DEV_STUDENT_PASSWORD=${studentPw}`,
      `DEV_APP_CLASS_ID=${appClass}`,
      `DEV_YOUTUBE_CLASS_ID=${ytClass}`,
      "",
    ].join("\n")
  );
  console.log(`Seeded. App class ${appClass}, YouTube class ${ytClass}. Credentials in .env.dev-accounts`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
