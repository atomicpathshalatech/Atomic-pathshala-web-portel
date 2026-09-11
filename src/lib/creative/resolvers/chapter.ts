import "server-only";
import { prisma } from "@/lib/db";
import type { CreativeContentData } from "../content-types";
import { toCreativeEducator } from "./educators";

const TEACHER_SELECT = {
  id: true,
  creativePngUrl: true,
  creativeAssetVersion: true,
  user: { select: { name: true, photoUrl: true } },
} as const;

/**
 * Chapter creative content (spec section 8). Chapter has no direct educator
 * field in the schema — it belongs to a Subject, and each Lecture under it
 * carries its own teacherId. The chapter's "owner" for a creative is
 * derived: whichever teacher has authored the most lectures in it (ties
 * broken by whoever taught the first one). Adding a redundant
 * Chapter.educatorId was deliberately avoided (spec section 23: don't
 * duplicate what a relation already expresses).
 */
export async function resolveChapterContent(chapterId: string): Promise<CreativeContentData | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      title: true,
      subject: { select: { title: true } },
      lectures: {
        select: { teacherId: true, order: true, teacher: { select: TEACHER_SELECT } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!chapter) return null;

  const byTeacher = new Map<string, { count: number; teacher: (typeof chapter.lectures)[number]["teacher"] }>();
  for (const l of chapter.lectures) {
    const entry = byTeacher.get(l.teacherId);
    if (entry) entry.count++;
    else byTeacher.set(l.teacherId, { count: 1, teacher: l.teacher });
  }
  const primary = [...byTeacher.values()].sort((a, b) => b.count - a.count)[0];

  return {
    title: chapter.title,
    chapterName: chapter.title,
    subjectName: chapter.subject.title,
    lectureCount: chapter.lectures.length,
    educators: primary ? [toCreativeEducator(primary.teacher)] : [],
  };
}
