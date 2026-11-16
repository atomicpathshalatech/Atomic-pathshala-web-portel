import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";

/**
 * GET /api/team/pyq/chapter-view
 * Query params: exam (slug or id), subject, chapter
 * Returns chapter information, total approved questions, year-wise distribution,
 * topic-wise distribution, and questions list.
 */
export async function GET(request: NextRequest) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);
    const sp = request.nextUrl.searchParams;
    const examParam = sp.get("exam")?.trim();
    const subjectParam = sp.get("subject")?.trim();
    const chapterParam = sp.get("chapter")?.trim();

    if (!subjectParam) {
      return apiError("Subject is required", 400);
    }

    const normSubject = normalizeSubjectName(subjectParam);

    // 1. Resolve exam if provided
    let examId: string | null = null;
    let examName: string | null = null;
    if (examParam) {
      const exam = await prisma.pyqExam.findFirst({
        where: {
          OR: [{ id: examParam }, { slug: examParam }, { canonicalType: examParam }],
          isActive: true,
        },
      });
      if (exam) {
        examId = exam.id;
        examName = exam.name;
      }
    }

    // 2. Fetch master NCERT chapters for subject to return full syllabus tree
    const allMasterChapters = getMasterNcertChapters(normSubject);

    // If no chapter selected, return the subject chapter list with question counts
    if (!chapterParam) {
      // Group counts by chapter
      const chapterCounts = await prisma.question.groupBy({
        by: ["chapter"],
        where: {
          subject: { equals: normSubject, mode: "insensitive" },
          ...(examId
            ? {
                pyqOccurrences: {
                  some: { examId, verificationStatus: "VERIFIED" },
                },
              }
            : {}),
        },
        _count: { id: true },
      });

      const countMap = new Map(
        chapterCounts.map((c) => [c.chapter?.toLowerCase().trim(), c._count.id])
      );

      const chaptersWithCounts = allMasterChapters.map((ch) => {
        const cleanTitle = ch.title.toLowerCase().trim();
        // Match either raw title or prefixed title
        const count =
          countMap.get(cleanTitle) ??
          countMap.get(ch.displayTitle.toLowerCase().trim()) ??
          0;
        return {
          id: ch.id,
          title: ch.title,
          displayTitle: ch.displayTitle,
          chapterNumber: ch.chapterNumber,
          classNumber: ch.classNumber,
          count,
        };
      });

      return apiSuccess({
        subject: normSubject,
        examId,
        examName,
        chapters: chaptersWithCounts,
      });
    }

    // 3. For a specific chapter, get detailed distribution and questions
    const whereCondition: any = {
      subject: { equals: normSubject, mode: "insensitive" },
      chapter: { contains: chapterParam, mode: "insensitive" },
      ...(examId
        ? {
            pyqOccurrences: {
              some: { examId, verificationStatus: "VERIFIED" },
            },
          }
        : {}),
    };

    const [totalQuestions, questions, topicGrouping, occurrences] = await Promise.all([
      prisma.question.count({ where: whereCondition }),
      prisma.question.findMany({
        where: whereCondition,
        orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          slug: true,
          questionCode: true,
          type: true,
          difficulty: true,
          subject: true,
          chapter: true,
          topic: true,
          subTopic: true,
          status: true,
          isPublished: true,
          solution: true,
          imageUrl: true,
          pyqExam: true,
          pyqYear: true,
          pyqMonth: true,
          pyqQuestionNumber: true,
          pyqSource: true,
          translations: {
            select: {
              language: true,
              statement: true,
              options: true,
              correctOptionIds: true,
              solution: true,
            },
          },
          pyqOccurrences: {
            where: { verificationStatus: "VERIFIED" },
            select: {
              id: true,
              year: true,
              session: true,
              shift: true,
              paper: true,
              questionNumber: true,
              sourceLabel: true,
              exam: { select: { id: true, name: true, canonicalType: true } },
            },
          },
        },
      }),
      prisma.question.groupBy({
        by: ["topic"],
        where: whereCondition,
        _count: { id: true },
      }),
      prisma.pyqOccurrence.findMany({
        where: {
          verificationStatus: "VERIFIED",
          ...(examId ? { examId } : {}),
          question: {
            subject: { equals: normSubject, mode: "insensitive" },
            chapter: { contains: chapterParam, mode: "insensitive" },
          },
        },
        select: {
          year: true,
        },
      }),
    ]);

    // Calculate year distribution from verified occurrences
    const yearCountMap = new Map<number, number>();
    for (const occ of occurrences) {
      if (occ.year) {
        yearCountMap.set(occ.year, (yearCountMap.get(occ.year) ?? 0) + 1);
      }
    }

    const yearDistribution = Array.from(yearCountMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);

    const topicDistribution = topicGrouping
      .filter((t) => t.topic)
      .map((t) => ({ topic: t.topic!, count: t._count.id }))
      .sort((a, b) => b.count - a.count);

    return apiSuccess({
      subject: normSubject,
      chapter: chapterParam,
      examId,
      examName,
      totalQuestions,
      yearDistribution,
      topicDistribution,
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
