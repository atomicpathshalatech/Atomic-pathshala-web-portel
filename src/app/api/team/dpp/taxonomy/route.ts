import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";
import { getTopicsForSubjectAndChapter } from "@/lib/ai-question-engine/taxonomy-memory";
import { classNumberOf } from "@/lib/dpp/hierarchy";

export const dynamic = "force-dynamic";

/**
 * Cascading lists for the DPP form (the same syllabus the Question Bank uses).
 *
 * GET ?subjectId=&className=          → chapters: syllabus chapters of that class
 *                                        + the subject's Chapter Management chapters
 * GET ?subjectId=&chapter=<title>     → topics (with sub-topics) of that chapter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_READ);

    const sp = request.nextUrl.searchParams;
    const subjectId = sp.get("subjectId")?.trim() ?? "";
    const subjectRow = subjectId
      ? await prisma.subject.findUnique({ where: { id: subjectId }, select: { title: true } })
      : null;
    const subject = subjectRow?.title ?? sp.get("subject")?.trim() ?? "";
    if (!subject) return apiSuccess({ chapters: [], topics: [] });

    const chapter = sp.get("chapter")?.trim();
    if (chapter) {
      const topics = await getTopicsForSubjectAndChapter(subject, chapter);
      return apiSuccess({
        topics: topics.map((t) => ({ title: t.title, subtopics: Array.from(new Set(t.subtopics.filter(Boolean))) })),
      });
    }

    const classNo = classNumberOf(sp.get("className"));
    // Chapter Management chapters of every subject row with this title (the
    // form merges duplicate "Chemistry" rows the same way).
    const managed = await prisma.chapter.findMany({
      where: { subject: { title: { equals: subject, mode: "insensitive" } } },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: 300,
    });
    const managedByTitle = new Map(managed.map((c) => [c.title.trim().toLowerCase(), c.id]));

    const seen = new Set<string>();
    const chapters: { title: string; label: string; chapterId: string | null; classNumber: number | null }[] = [];
    for (const mc of getMasterNcertChapters(subject)) {
      if (classNo && mc.classNumber !== classNo) continue;
      const key = mc.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      chapters.push({
        title: mc.title,
        label: mc.chapterNumber ? `Ch ${mc.chapterNumber} · ${mc.title}` : mc.title,
        chapterId: managedByTitle.get(key) ?? null,
        classNumber: mc.classNumber,
      });
    }
    // Chapters the team created themselves (not in the syllabus list) are always offered.
    for (const c of managed) {
      const key = c.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      chapters.push({ title: c.title, label: c.title, chapterId: c.id, classNumber: null });
    }
    return apiSuccess({ chapters });
  } catch (error) {
    return handleApiError(error);
  }
}
