import "server-only";
import { prisma } from "@/lib/db";
import { resolveBirthdayCategory } from "./category";
import type { BirthdaySubject } from "./subjects";

/** One specific student/teacher by id, for the admin manual/force/test-send actions (does not require today to actually be their birthday). */
export async function getBirthdaySubjectById(
  subjectType: "STUDENT" | "TEACHER",
  subjectId: string
): Promise<BirthdaySubject | null> {
  if (subjectType === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { id: subjectId },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (!student) return null;

    const activeEnrollment = await prisma.batchEnrollment.findFirst({
      where: { studentId: student.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: { batch: { select: { name: true, targetExam: true } } },
    });

    const { category, board } = resolveBirthdayCategory({
      subjectType: "STUDENT",
      targetExam: activeEnrollment?.batch.targetExam || student.targetExam,
      class: student.class,
      board: student.board,
    });

    return {
      subjectType: "STUDENT",
      subjectId: student.id,
      userId: student.userId,
      name: student.user.name,
      dob: student.dob,
      whatsappNumber: student.user.phone,
      email: student.user.email,
      category,
      board,
      activeBatchName: activeEnrollment?.batch.name ?? null,
    };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: subjectId },
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
  });
  if (!teacher || !teacher.dob) return null;

  return {
    subjectType: "TEACHER",
    subjectId: teacher.id,
    userId: teacher.userId,
    name: teacher.user.name,
    dob: teacher.dob,
    whatsappNumber: teacher.user.phone,
    email: teacher.user.email,
    category: "GENERAL",
    board: null,
    activeBatchName: null,
  };
}
