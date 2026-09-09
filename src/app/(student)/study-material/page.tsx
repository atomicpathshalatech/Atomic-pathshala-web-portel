import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudyMaterialBrowser } from "@/components/student/StudyMaterialBrowser";

export const metadata: Metadata = {
  title: "Study Material — Atomic Pathshala",
};

export default async function StudentStudyMaterialPage() {
  const { student } = await requireStudentSession();

  const enrolments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batch: { select: { courseId: true } } },
  });
  const courseIds = Array.from(
    new Set(enrolments.map((e) => e.batch?.courseId).filter((x): x is string => !!x))
  );

  const subjects = courseIds.length
    ? await prisma.subject.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          chapters: {
            where: { status: { in: ["PUBLISHED", "APPROVED"] } },
            orderBy: [{ order: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              studyMaterials: {
                where: { isPublished: true },
                orderBy: [{ type: "asc" }, { order: "asc" }],
                select: {
                  id: true,
                  type: true,
                  title: true,
                  fileName: true,
                  sizeBytes: true,
                  allowDownload: true,
                },
              },
            },
          },
        },
      })
    : [];

  // Keep only chapters that actually have material.
  const cleaned = subjects
    .map((s) => ({
      id: s.id,
      title: s.title,
      chapters: s.chapters.filter((c) => c.studyMaterials.length > 0),
    }))
    .filter((s) => s.chapters.length > 0);

  return <StudyMaterialBrowser subjects={cleaned} />;
}
