import type { Metadata } from "next";
import type { StudyMaterialClassExam } from "@prisma/client";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudyMaterialBrowser } from "@/components/student/StudyMaterialBrowser";

export const metadata: Metadata = {
  title: "Study Material — Atomic Pathshala",
};

/** Loose map from a batch's free-text target exam to our Class/Exam enum. */
function deriveClassExams(targetExams: (string | null | undefined)[]): StudyMaterialClassExam[] {
  const set = new Set<StudyMaterialClassExam>();
  for (const raw of targetExams) {
    const t = (raw || "").toLowerCase();
    if (t.includes("neet")) set.add("NEET");
    if (t.includes("jee")) set.add("JEE");
    if (t.includes("12")) set.add("CLASS_12");
    if (t.includes("11")) set.add("CLASS_11");
  }
  return set.size ? [...set] : ["NEET", "JEE", "CLASS_11", "CLASS_12"];
}

export default async function StudentStudyMaterialPage() {
  const { student } = await requireStudentSession();

  const enrolments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batch: { select: { targetExam: true } } },
  });
  const allowed = deriveClassExams(enrolments.map((e) => e.batch?.targetExam));

  const materials = await prisma.studyMaterial.findMany({
    where: { isPublished: true, classExam: { in: allowed } },
    orderBy: [{ subject: "asc" }, { chapterClass: "asc" }, { chapterTitle: "asc" }, { type: "asc" }, { order: "asc" }],
    select: {
      id: true,
      classExam: true,
      subject: true,
      chapterTitle: true,
      chapterClass: true,
      language: true,
      type: true,
      title: true,
      fileName: true,
      sizeBytes: true,
      allowDownload: true,
    },
  });

  return <StudyMaterialBrowser classExams={allowed} materials={materials} />;
}
