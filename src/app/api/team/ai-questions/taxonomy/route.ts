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

    // 2. If only subject provided, return dependent chapters
    if (subject) {
      // Look up in AcademicChapter
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

      // Also look up in legacy Chapter table
      const legacyChapters = await prisma.chapter.findMany({
        where: {
          subject: { title: { contains: subject, mode: "insensitive" } },
        },
        select: { id: true, title: true },
        take: 100,
      });

      // Merge and deduplicate by chapter title
      const seen = new Set<string>();
      const combined: Array<{ id: string; title: string; titleHindi?: string | null }> = [];

      for (const ac of academicChapters) {
        const clean = ac.title.trim().toLowerCase();
        if (!seen.has(clean)) {
          seen.add(clean);
          combined.push({ id: ac.id, title: ac.title, titleHindi: ac.titleHindi });
        }
      }

      for (const lc of legacyChapters) {
        const clean = lc.title.trim().toLowerCase();
        if (!seen.has(clean)) {
          seen.add(clean);
          combined.push({ id: lc.id, title: lc.title });
        }
      }

      return apiSuccess({ chapters: combined });
    }

    // 3. If neither, return distinct Subjects
    const academicSubjects = await prisma.academicSubject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameHindi: true },
      distinct: ["name"],
      orderBy: { order: "asc" },
    });

    const standardSubjects = [
      { name: "Biology", nameHindi: "जीव विज्ञान" },
      { name: "Physics", nameHindi: "भौतिक विज्ञान" },
      { name: "Chemistry", nameHindi: "रसायन विज्ञान" },
      { name: "Mathematics", nameHindi: "गणित" },
    ];

    const finalSubjects = standardSubjects.map((s) => {
      const match = academicSubjects.find(
        (as) => as.name.toLowerCase() === s.name.toLowerCase()
      );
      return {
        id: match?.id || s.name.toLowerCase(),
        name: s.name,
        nameHindi: match?.nameHindi || s.nameHindi,
      };
    });

    return apiSuccess({ subjects: finalSubjects });
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
    const { subject, chapter, topicTitle, subtopics } = body;

    if (!subject?.trim() || !chapter?.trim() || !topicTitle?.trim()) {
      return apiError("Subject, chapter, and topic title are required.", 400);
    }

    const result = await registerCustomTopic({
      subject,
      chapter,
      topicTitle,
      subtopics,
      userId: session.user.id,
    });

    return apiSuccess(result, result.isNew ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}
