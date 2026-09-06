import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  getTopicsForSubjectAndChapter,
  registerCustomTopic,
} from "@/lib/ai-question-engine/taxonomy-memory";
import {
  getMasterNcertSubjects,
  getMasterNcertChapters,
} from "@/lib/academic/master-ncert-catalog";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();

    // 1. If subject and chapter provided, return topics & subtopics
    if (subject && chapter) {
      const topics = await getTopicsForSubjectAndChapter(subject, chapter);
      return apiSuccess({ topics });
    }

    // 2. If only subject provided, return all NCERT chapters (Class 11 & Class 12) + DB custom chapters
    if (subject) {
      const seen = new Set<string>();
      const combined: Array<{
        id: string;
        title: string;
        titleHindi?: string | null;
        displayTitle?: string;
        classNumber?: number;
      }> = [];

      // A. Master NCERT Official Catalog Chapters
      const masterChapters = getMasterNcertChapters(subject);
      for (const mc of masterChapters) {
        const clean = mc.title.trim().toLowerCase();
        if (!seen.has(clean)) {
          seen.add(clean);
          combined.push({
            id: mc.id,
            title: mc.title,
            titleHindi: mc.titleHindi,
            displayTitle: mc.displayTitle,
            classNumber: mc.classNumber,
          });
        }
      }

      // B. Supplement from AcademicChapter in Database
      try {
        const academicChapters = await prisma.academicChapter.findMany({
          where: {
            subject: { name: { contains: subject, mode: "insensitive" } },
            isActive: true,
          },
          select: {
            id: true,
            title: true,
            titleHindi: true,
            chapterNumber: true,
          },
          orderBy: { chapterNumber: "asc" },
        });

        for (const ac of academicChapters) {
          const clean = ac.title.trim().toLowerCase();
          if (!seen.has(clean)) {
            seen.add(clean);
            combined.push({
              id: ac.id,
              title: ac.title,
              titleHindi: ac.titleHindi,
              displayTitle: ac.title,
            });
          }
        }
      } catch (err) {
        console.warn("[TaxonomyRoute] AcademicChapter query warning:", err);
      }

      // C. Supplement from legacy Chapter table
      try {
        const legacyChapters = await prisma.chapter.findMany({
          where: {
            subject: { title: { contains: subject, mode: "insensitive" } },
          },
          select: { id: true, title: true },
          take: 100,
        });

        for (const lc of legacyChapters) {
          const clean = lc.title.trim().toLowerCase();
          if (!seen.has(clean)) {
            seen.add(clean);
            combined.push({ id: lc.id, title: lc.title, displayTitle: lc.title });
          }
        }
      } catch (err) {
        console.warn("[TaxonomyRoute] Legacy chapter query warning:", err);
      }

      return apiSuccess({ chapters: combined });
    }

    // 3. If neither provided, return Master NCERT Subjects
    const standardSubjects = getMasterNcertSubjects();

    // Check if additional subjects exist in DB
    try {
      const academicSubjects = await prisma.academicSubject.findMany({
        where: { isActive: true },
        select: { id: true, name: true, nameHindi: true },
        distinct: ["name"],
        orderBy: { order: "asc" },
      });

      const finalSubjects = standardSubjects.map((s) => {
        const match = academicSubjects.find(
          (as) => as.name.toLowerCase() === s.name.toLowerCase()
        );
        return {
          id: match?.id || s.name,
          name: s.name,
          nameHindi: match?.nameHindi || s.nameHindi,
        };
      });

      return apiSuccess({ subjects: finalSubjects });
    } catch {
      return apiSuccess({ subjects: standardSubjects });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { subject, chapter, topicTitle, customTopic, subtopics, customSubtopic } = body;
    const finalTopicTitle = (topicTitle || customTopic)?.trim();

    if (!subject?.trim() || !chapter?.trim() || !finalTopicTitle) {
      return apiError("Subject, chapter, and topic title are required.", 400);
    }

    const subtopicsList = Array.isArray(subtopics)
      ? subtopics
      : customSubtopic
      ? [customSubtopic]
      : [];

    const result = await registerCustomTopic({
      subject: subject.trim(),
      chapter: chapter.trim(),
      topicTitle: finalTopicTitle,
      subtopics: subtopicsList,
      userId: session.user.id,
    });

    return apiSuccess(result, result.isNew ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}
