import { prisma } from "@/lib/db";

export type MasterLectureItem = {
  id: string;
  lectureCode: string;
  title: string;
  durationMinutes: number;
  type: "LIVE_CLASS" | "RECORDED" | "PRACTICE";
  order: number;
};

export type MasterChapter = {
  id: string;
  chapterCode: string;
  title: string;
  subject: string;
  courseTitle: string;
  targetExam: string;
  facultyName: string;
  facultyId?: string;
  lectures: MasterLectureItem[];
  dppCount: number;
  testCount: number;
  pdfNotesCount: number;
  totalDurationMinutes: number;
};

/**
 * Search master chapters from database by code, title, subject, or query.
 * Only returns real chapters created in the system by Admin/Faculty.
 */
export async function searchMasterChapters(query: string = ""): Promise<MasterChapter[]> {
  const q = query.toLowerCase().trim();

  const dbChapters = await prisma.chapter.findMany({
    where: q
      ? {
          OR: [
            { chapterId: { contains: q, mode: "insensitive" } },
            { id: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { subject: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      subject: { include: { course: true } },
      lectures: { orderBy: { order: "asc" } },
      dpps: true,
      tests: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return dbChapters.map((ch, idx) => ({
    id: ch.id,
    chapterCode: ch.chapterId || ch.id.slice(0, 8).toUpperCase(),
    title: ch.title,
    subject: ch.subject?.title || "General",
    courseTitle: ch.subject?.course?.title || "Academic Program",
    targetExam: ch.subject?.course?.title || "Academic Exam",
    facultyName: "Atomic Pathshala Faculty",
    dppCount: ch.dpps?.length || 0,
    testCount: ch.tests?.length || 0,
    pdfNotesCount: 2,
    totalDurationMinutes: ch.lectures.length > 0 ? ch.lectures.length * 60 : 180,
    lectures:
      ch.lectures.length > 0
        ? ch.lectures.map((l, lIdx) => ({
            id: l.id,
            lectureCode: `LEC-${String(lIdx + 1).padStart(2, "0")}`,
            title: l.title,
            durationMinutes: 60,
            type: "LIVE_CLASS",
            order: l.order || lIdx + 1,
          }))
        : [
            { id: `${ch.id}_1`, lectureCode: "LEC-01", title: `${ch.title} — Lecture 1`, durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
          ],
  }));
}

/**
 * Fetch a single Master Chapter by its unique Chapter ID or code
 */
export async function getMasterChapterById(idOrCode: string): Promise<MasterChapter | null> {
  const normalized = idOrCode.trim();
  if (!normalized) return null;

  const ch = await prisma.chapter.findFirst({
    where: {
      OR: [
        { id: normalized },
        { chapterId: { equals: normalized, mode: "insensitive" } },
        { title: { equals: normalized, mode: "insensitive" } },
      ],
    },
    include: {
      subject: { include: { course: true } },
      lectures: { orderBy: { order: "asc" } },
      dpps: true,
      tests: true,
    },
  });

  if (!ch) return null;

  return {
    id: ch.id,
    chapterCode: ch.chapterId || ch.id.slice(0, 8).toUpperCase(),
    title: ch.title,
    subject: ch.subject?.title || "General",
    courseTitle: ch.subject?.course?.title || "Academic Program",
    targetExam: ch.subject?.course?.title || "Academic Exam",
    facultyName: "Atomic Pathshala Faculty",
    dppCount: ch.dpps?.length || 0,
    testCount: ch.tests?.length || 0,
    pdfNotesCount: 2,
    totalDurationMinutes: ch.lectures.length > 0 ? ch.lectures.length * 60 : 180,
    lectures:
      ch.lectures.length > 0
        ? ch.lectures.map((l, lIdx) => ({
            id: l.id,
            lectureCode: `LEC-${String(lIdx + 1).padStart(2, "0")}`,
            title: l.title,
            durationMinutes: 60,
            type: "LIVE_CLASS",
            order: l.order || lIdx + 1,
          }))
        : [
            { id: `${ch.id}_1`, lectureCode: "LEC-01", title: `${ch.title} — Lecture 1`, durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
          ],
  };
}
