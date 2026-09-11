import "server-only";
import { prisma } from "@/lib/db";
import { resolveBirthdayCategory, type BirthdaySubjectProfile } from "./category";
import type { BirthdayCategory } from "@prisma/client";

export type BirthdaySubject = {
  subjectType: "STUDENT" | "TEACHER";
  subjectId: string;
  userId: string;
  name: string;
  dob: Date;
  whatsappNumber: string | null;
  email: string | null;
  category: BirthdayCategory;
  board: string | null;
  activeBatchName: string | null;
};

/**
 * Everyone whose birthday is today (month+day, any year — a fresh row
 * every year would be wrong, so this compares the calendar date component
 * directly rather than storing "next birthday"). ACTIVE accounts only.
 */
export async function findTodaysBirthdaySubjects(now = new Date()): Promise<BirthdaySubject[]> {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const [students, teachers] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        userId: string;
        name: string;
        dob: Date;
        phone: string | null;
        email: string;
        class: string;
        targetExam: string;
        board: string | null;
      }>
    >`
      SELECT s.id, s."userId", u.name, s.dob, u.phone, u.email, s.class, s."targetExam", s.board
      FROM students s
      JOIN users u ON u.id = s."userId"
      WHERE EXTRACT(MONTH FROM s.dob) = ${month}
        AND EXTRACT(DAY FROM s.dob) = ${day}
        AND u.status = 'ACTIVE'
    `,
    prisma.$queryRaw<
      Array<{ id: string; userId: string; name: string; dob: Date; phone: string | null; email: string }>
    >`
      SELECT t.id, t."userId", u.name, t.dob, u.phone, u.email
      FROM teachers t
      JOIN users u ON u.id = t."userId"
      WHERE t.dob IS NOT NULL
        AND EXTRACT(MONTH FROM t.dob) = ${month}
        AND EXTRACT(DAY FROM t.dob) = ${day}
        AND u.status = 'ACTIVE'
    `,
  ]);

  const results: BirthdaySubject[] = [];

  for (const s of students) {
    // Active/primary batch is the source of truth for exam category (spec
    // section 5) — most recently enrolled ACTIVE one when there's more than one.
    const activeEnrollment = await prisma.batchEnrollment.findFirst({
      where: { studentId: s.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: { batch: { select: { name: true, targetExam: true } } },
    });

    const profile: BirthdaySubjectProfile = {
      subjectType: "STUDENT",
      targetExam: activeEnrollment?.batch.targetExam || s.targetExam,
      class: s.class,
      board: s.board,
    };
    const { category, board } = resolveBirthdayCategory(profile);

    results.push({
      subjectType: "STUDENT",
      subjectId: s.id,
      userId: s.userId,
      name: s.name,
      dob: s.dob,
      whatsappNumber: s.phone,
      email: s.email,
      category,
      board,
      activeBatchName: activeEnrollment?.batch.name ?? null,
    });
  }

  for (const t of teachers) {
    results.push({
      subjectType: "TEACHER",
      subjectId: t.id,
      userId: t.userId,
      name: t.name,
      dob: t.dob,
      whatsappNumber: t.phone,
      email: t.email,
      category: "GENERAL",
      board: null,
      activeBatchName: null,
    });
  }

  return results;
}
