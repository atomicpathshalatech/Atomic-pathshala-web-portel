import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeamUser } from "@/lib/pyq/api";
import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";

/**
 * GET /api/team/pyq/chapter-view
 * Query params: exam (slug or id), subject, chapter, tab (unverified | verified), status (ALL | UNVERIFIED | ASSIGNED | IN_REVIEW | NEEDS_CORRECTION | UNASSIGNED)
 * Returns chapter information, verified/unverified metrics, year-wise distribution,
 * topic distribution, and questions list with assignment & review states.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const roleUpper = (sessionUser.role || "").toUpperCase();
    const isSuperAdmin =
      roleUpper === "SUPER_ADMIN" || roleUpper === "FOUNDER" || roleUpper === "ADMIN";

    // Team members who are not Super Admin/Admin can only see questions assigned to them
    const userAssignmentScope: any = !isSuperAdmin
      ? {
          OR: [
            { assignedToId: sessionUser.id },
            {
              pyqAssignments: {
                some: {
                  assignment: {
                    assignedToId: sessionUser.id,
                    status: { not: "CANCELLED" },
                  },
                },
              },
            },
          ],
        }
      : {};

    const sp = request.nextUrl.searchParams;
    const examParam = sp.get("exam")?.trim();
    const subjectParam = sp.get("subject")?.trim();
    const chapterParam = sp.get("chapter")?.trim();
    const tabParam = sp.get("tab")?.toLowerCase() || "unverified";
    const statusParam = sp.get("status")?.toUpperCase() || "ALL";

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
      const chapterCounts = await prisma.question.groupBy({
        by: ["chapter"],
        where: {
          subject: { equals: normSubject, mode: "insensitive" },
          ...(examId
            ? {
                pyqOccurrences: {
                  some: { examId },
                },
              }
            : {}),
          ...userAssignmentScope,
        },
        _count: { id: true },
      });

      const countMap = new Map(
        chapterCounts.map((c) => [c.chapter?.toLowerCase().trim(), c._count.id])
      );

      const chaptersWithCounts = allMasterChapters.map((ch) => {
        const cleanTitle = ch.title.toLowerCase().trim();
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
        isSuperAdmin,
        chapters: chaptersWithCounts,
      });
    }

    // 3. For a specific chapter, get detailed counts, distribution and questions
    const baseChapterWhere: any = {
      subject: { equals: normSubject, mode: "insensitive" },
      chapter: { contains: chapterParam, mode: "insensitive" },
      ...(examId
        ? {
            pyqOccurrences: {
              some: { examId },
            },
          }
        : {}),
      ...userAssignmentScope,
    };

    // Calculate metrics across all questions in this chapter
    const [
      totalQuestions,
      verifiedCount,
      assignedCount,
      inReviewCount,
      needsCorrectionCount,
      topicGrouping,
      occurrences,
    ] = await Promise.all([
      prisma.question.count({ where: baseChapterWhere }),
      prisma.question.count({
        where: { ...baseChapterWhere, pyqVerificationStatus: "VERIFIED" },
      }),
      prisma.question.count({
        where: { ...baseChapterWhere, pyqVerificationStatus: "ASSIGNED" },
      }),
      prisma.question.count({
        where: { ...baseChapterWhere, pyqVerificationStatus: "IN_REVIEW" },
      }),
      prisma.question.count({
        where: { ...baseChapterWhere, pyqVerificationStatus: "NEEDS_CORRECTION" },
      }),
      prisma.question.groupBy({
        by: ["topic"],
        where: baseChapterWhere,
        _count: { id: true },
      }),
      prisma.pyqOccurrence.findMany({
        where: {
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

    const unverifiedCount = Math.max(0, totalQuestions - verifiedCount);
    const unassignedCount = Math.max(
      0,
      unverifiedCount - (assignedCount + inReviewCount + needsCorrectionCount)
    );

    // Build query for current tab
    const isVerifiedTab = tabParam === "verified";
    let tabWhere: any = { ...baseChapterWhere };

    if (isVerifiedTab) {
      tabWhere.pyqVerificationStatus = "VERIFIED";
    } else {
      if (statusParam === "ASSIGNED") {
        tabWhere.pyqVerificationStatus = "ASSIGNED";
      } else if (statusParam === "IN_REVIEW") {
        tabWhere.pyqVerificationStatus = "IN_REVIEW";
      } else if (statusParam === "NEEDS_CORRECTION") {
        tabWhere.pyqVerificationStatus = "NEEDS_CORRECTION";
      } else if (statusParam === "UNASSIGNED") {
        tabWhere.AND = [
          { OR: [{ pyqVerificationStatus: "UNVERIFIED" }, { pyqVerificationStatus: null }] },
          { assignedToId: null },
        ];
      } else {
        // ALL unverified
        tabWhere.OR = [
          { pyqVerificationStatus: { not: "VERIFIED" } },
          { pyqVerificationStatus: null },
        ];
      }
    }

    const questions = await prisma.question.findMany({
      where: tabWhere,
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      take: 200,
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
        pyqVerificationStatus: true,
        pyqVerifiedAt: true,
        assignedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
        pyqVerifiedBy: { select: { id: true, name: true, email: true } },
        translations: {
          select: {
            id: true,
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: true,
          },
        },
        pyqOccurrences: {
          select: {
            id: true,
            year: true,
            session: true,
            shift: true,
            paper: true,
            questionNumber: true,
            sourceLabel: true,
            verificationStatus: true,
            exam: { select: { id: true, name: true, canonicalType: true } },
          },
        },
        pyqReviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            verificationStatus: true,
            checklistData: true,
            reviewComments: true,
            flaggedIssue: true,
            correctionsNeeded: true,
            reviewedAt: true,
            reviewer: { select: { id: true, name: true } },
          },
        },
        pyqAssignments: {
          where: { assignment: { status: { not: "CANCELLED" } } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            assignment: {
              select: {
                id: true,
                priority: true,
                deadline: true,
                instructions: true,
                assignedTo: { select: { id: true, name: true } },
              },
            },
          },
        },
        pyqReviewHistories: {
          orderBy: { timestamp: "desc" },
          take: 5,
          select: {
            id: true,
            action: true,
            comments: true,
            timestamp: true,
            reviewer: { select: { name: true } },
          },
        },
      },
    });

    // Calculate year distribution
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
      isSuperAdmin,
      currentUserId: sessionUser.id,
      tab: isVerifiedTab ? "verified" : "unverified",
      statusFilter: statusParam,
      metrics: {
        totalQuestions,
        unverifiedCount,
        verifiedCount,
        assignedCount,
        unassignedCount,
        inReviewCount,
        needsCorrectionCount,
      },
      yearDistribution,
      topicDistribution,
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
