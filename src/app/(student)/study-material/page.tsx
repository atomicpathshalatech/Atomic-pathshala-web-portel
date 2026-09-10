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

  let allowed: StudyMaterialClassExam[] = ["NEET", "JEE", "CLASS_11", "CLASS_12"];
  let materials: Awaited<ReturnType<typeof loadMaterials>> = [];

  try {
    const enrolments = await prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { batch: { select: { targetExam: true } } },
    });
    allowed = deriveClassExams(enrolments.map((e) => e.batch?.targetExam));
    materials = await loadMaterials(allowed);
  } catch (e) {
    // The Study Material feature ships behind a migration
    // (20260910120000_study_material). If it isn't applied on this
    // environment the table is absent — show an empty library instead of
    // crashing the whole route.
    console.error("[study-material] load failed:", e instanceof Error ? e.message : e);
    materials = [];
  }

  return <StudyMaterialBrowser classExams={allowed} materials={materials} />;
}

function loadMaterials(allowed: StudyMaterialClassExam[]) {
  return prisma.studyMaterial.findMany({
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
}
