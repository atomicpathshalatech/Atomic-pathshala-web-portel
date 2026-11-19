import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeamUser } from "@/lib/pyq/api";

const MANDATORY_CHECKLIST_KEYS = [
  "englishStatement",
  "hindiTranslation",
  "allOptions",
  "correctAnswer",
  "solution",
  "imagesDiagrams",
] as const;

/**
 * GET /api/team/pyq/questions/[id]/review
 * Fetches complete question data for the review workspace:
 * - English and Hindi translations
 * - PYQ occurrence metadata
 * - Current checklist and review status
 * - Assignment info and sibling questions for next/previous navigation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const { id } = params;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        translations: true,
        pyqOccurrences: {
          include: {
            exam: { select: { id: true, name: true, canonicalType: true } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
        pyqVerifiedBy: { select: { id: true, name: true, email: true } },
        pyqReviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            reviewer: { select: { id: true, name: true } },
          },
        },
        pyqAssignments: {
          where: { assignment: { status: { not: "CANCELLED" } } },
          orderBy: { createdAt: "desc" },
          include: {
            assignment: {
              select: {
                id: true,
                priority: true,
                deadline: true,
                instructions: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true } },
              },
            },
          },
        },
        pyqReviewHistories: {
          orderBy: { timestamp: "desc" },
          take: 20,
          include: {
            reviewer: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const roleUpper = (sessionUser.role || "").toUpperCase();
    const isSuperAdmin =
      roleUpper === "SUPER_ADMIN" || roleUpper === "FOUNDER" || roleUpper === "ADMIN";

    // Team members who are not Super Admin/Admin can only see and review questions assigned to them
    if (!isSuperAdmin) {
      const isAssigned =
        question.assignedToId === sessionUser.id ||
        question.pyqAssignments.some(
          (pa) =>
            pa.assignment?.assignedTo?.id === sessionUser.id ||
            pa.assignment?.assignedToId === sessionUser.id
        );
      if (!isAssigned) {
        return apiError("This question is not assigned to you for review.", 403);
      }
    }

    const userSiblingScope: any = !isSuperAdmin
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

    // Find siblings in the same chapter to allow seamless next/previous question review
    const siblings = await prisma.question.findMany({
      where: {
        subject: question.subject,
        chapter: question.chapter,
        ...userSiblingScope,
      },
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        questionCode: true,
        pyqYear: true,
        pyqVerificationStatus: true,
      },
    });

    const currentIndex = siblings.findIndex((s) => s.id === question.id);
    const previousQuestionId = currentIndex > 0 ? siblings[currentIndex - 1]?.id : null;
    const nextQuestionId =
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]?.id
        : null;

    return apiSuccess({
      question,
      navigation: {
        currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
        totalInChapter: siblings.length,
        previousQuestionId,
        nextQuestionId,
      },
      currentUser: {
        id: sessionUser.id,
        name: sessionUser.name,
        role: sessionUser.role,
      },
    });
  } catch (error) {
    console.error("[pyq_review_post_error]", error);
    return handleApiError(error);
  }
}

/**
 * POST /api/team/pyq/questions/[id]/review
 * Submit review decision:
 *   - "VERIFY": Approve question (requires all 10 mandatory checks)
 *   - "NEEDS_CORRECTION": Flag question for corrections
 *   - "SAVE_LATER": Save edits and checklist progress without approving
 *   - "REOPEN": Reopen verification if a verified question is edited
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const { id } = params;
    const body = await request.json();

    const {
      action = "VERIFY", // VERIFY | NEEDS_CORRECTION | SAVE_LATER | REOPEN
      checklistData = {},
      reviewComments = "",
      flaggedIssue = "",
      correctionsNeeded = "",
      editedQuestion, // optional edits made during review
    } = body;

    const existingQuestion = await prisma.question.findUnique({
      where: { id },
      include: {
        translations: true,
        pyqOccurrences: true,
        pyqAssignments: {
          where: { assignment: { status: { not: "CANCELLED" } } },
          orderBy: { createdAt: "desc" },
          include: {
            assignment: { select: { id: true, assignedToId: true } },
          },
        },
      },
    });

    if (!existingQuestion) {
      return apiError("Question not found", 404);
    }

    const roleUpper = (sessionUser.role || "").toUpperCase();
    const isSuperAdmin =
      roleUpper === "SUPER_ADMIN" || roleUpper === "FOUNDER" || roleUpper === "ADMIN";

    const assignmentJunction =
      existingQuestion.pyqAssignments.find(
        (pa) => pa.assignment?.assignedToId === sessionUser.id
      ) || existingQuestion.pyqAssignments[0];

    if (!isSuperAdmin) {
      const isAssigned =
        existingQuestion.assignedToId === sessionUser.id ||
        Boolean(assignmentJunction && assignmentJunction.assignment?.assignedToId === sessionUser.id);
      if (!isAssigned) {
        return apiError("You cannot review or verify a question that is not assigned to you.", 403);
      }
    }

    // 1. If action is VERIFY, validate mandatory checklist (6 canonical checks)
    if (action === "VERIFY") {
      const normalizedChecklist: Record<string, boolean> = {
        ...checklistData,
        solution: Boolean(checklistData.solution ?? checklistData.explanation),
      };
      const missingChecks = MANDATORY_CHECKLIST_KEYS.filter(
        (key) => !normalizedChecklist[key]
      );
      if (missingChecks.length > 0) {
        return apiError(
          `All 6 verification checklist items must be verified before approving. Missing: ${missingChecks.join(", ")}`,
          400
        );
      }
    }

    // 2. Execute decision in Prisma transaction
    const updated = await prisma.$transaction(async (tx) => {
      // A. Apply any edits to Question if reviewer modified content
      if (editedQuestion) {
        await tx.question.update({
          where: { id },
          data: {
            subject: editedQuestion.subject || existingQuestion.subject,
            chapter: editedQuestion.chapter || existingQuestion.chapter,
            topic: editedQuestion.topic !== undefined ? editedQuestion.topic : existingQuestion.topic,
            subTopic: editedQuestion.subTopic !== undefined ? editedQuestion.subTopic : existingQuestion.subTopic,
            microConcept: editedQuestion.microConcept !== undefined ? editedQuestion.microConcept : existingQuestion.microConcept,
            difficulty: editedQuestion.difficulty || existingQuestion.difficulty,
            type: editedQuestion.type || existingQuestion.type,
            imageUrl: editedQuestion.imageUrl !== undefined ? editedQuestion.imageUrl : existingQuestion.imageUrl,
            referenceImageUrl: editedQuestion.referenceImageUrl !== undefined ? editedQuestion.referenceImageUrl : existingQuestion.referenceImageUrl,
            solution: editedQuestion.solution !== undefined ? editedQuestion.solution : existingQuestion.solution,
            bloomLevel: editedQuestion.bloomLevel !== undefined ? editedQuestion.bloomLevel : existingQuestion.bloomLevel,
            importance: editedQuestion.importance !== undefined ? editedQuestion.importance : existingQuestion.importance,
            solveTime: editedQuestion.solveTime !== undefined ? editedQuestion.solveTime : existingQuestion.solveTime,
            keySkill: editedQuestion.keySkill !== undefined ? editedQuestion.keySkill : existingQuestion.keySkill,
            ncertBook: editedQuestion.ncertBook !== undefined ? editedQuestion.ncertBook : existingQuestion.ncertBook,
            ncertClass: editedQuestion.ncertClass !== undefined ? editedQuestion.ncertClass : existingQuestion.ncertClass,
            ncertChapter: editedQuestion.ncertChapter !== undefined ? editedQuestion.ncertChapter : existingQuestion.ncertChapter,
            ncertPage: editedQuestion.ncertPage !== undefined ? editedQuestion.ncertPage : existingQuestion.ncertPage,
            ncertSection: editedQuestion.ncertSection !== undefined ? editedQuestion.ncertSection : existingQuestion.ncertSection,
            ncertLine: editedQuestion.ncertLine !== undefined ? editedQuestion.ncertLine : existingQuestion.ncertLine,
            tags: editedQuestion.tags !== undefined ? editedQuestion.tags : existingQuestion.tags,
            pyqExam: editedQuestion.pyqExam !== undefined ? editedQuestion.pyqExam : existingQuestion.pyqExam,
            pyqYear: editedQuestion.pyqYear !== undefined ? (editedQuestion.pyqYear ? parseInt(editedQuestion.pyqYear, 10) : null) : existingQuestion.pyqYear,
            pyqMonth: editedQuestion.pyqMonth !== undefined ? editedQuestion.pyqMonth : existingQuestion.pyqMonth,
            pyqQuestionNumber: editedQuestion.pyqQuestionNumber !== undefined ? editedQuestion.pyqQuestionNumber : existingQuestion.pyqQuestionNumber,
            pyqSource: editedQuestion.pyqSource !== undefined ? editedQuestion.pyqSource : existingQuestion.pyqSource,
            editedById: sessionUser.id,
            editedAt: new Date(),
          },
        });

        // Update PyqOccurrence if present
        if ((existingQuestion.pyqOccurrences?.length ?? 0) > 0 && (editedQuestion.pyqYear || editedQuestion.pyqExam || editedQuestion.session || editedQuestion.shift || editedQuestion.paper)) {
          const occ = existingQuestion.pyqOccurrences![0];
          await tx.pyqOccurrence.update({
            where: { id: occ.id },
            data: {
              year: editedQuestion.pyqYear ? parseInt(editedQuestion.pyqYear, 10) : occ.year,
              session: editedQuestion.session !== undefined ? editedQuestion.session : occ.session,
              shift: editedQuestion.shift !== undefined ? editedQuestion.shift : occ.shift,
              paper: editedQuestion.paper !== undefined ? editedQuestion.paper : occ.paper,
              questionNumber: editedQuestion.pyqQuestionNumber !== undefined ? editedQuestion.pyqQuestionNumber : occ.questionNumber,
            },
          });
        }

        // Update English translation
        if (editedQuestion.english) {
          const eng = existingQuestion.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
          if (eng) {
            await tx.questionTranslation.update({
              where: { id: eng.id },
              data: {
                statement: editedQuestion.english.statement || eng.statement,
                options: editedQuestion.english.options || eng.options,
                correctOptionIds: editedQuestion.english.correctOptionIds || eng.correctOptionIds,
                solution: editedQuestion.english.solution !== undefined ? editedQuestion.english.solution : eng.solution,
              },
            });
          }
        }

        // Update Hindi translation
        if (editedQuestion.hindi) {
          const hin = existingQuestion.translations.find((t) => t.language.toUpperCase() === "HINDI");
          if (hin) {
            await tx.questionTranslation.update({
              where: { id: hin.id },
              data: {
                statement: editedQuestion.hindi.statement || hin.statement,
                options: editedQuestion.hindi.options || hin.options,
                correctOptionIds: editedQuestion.hindi.correctOptionIds || hin.correctOptionIds,
                solution: editedQuestion.hindi.solution !== undefined ? editedQuestion.hindi.solution : hin.solution,
              },
            });
          } else if (editedQuestion.hindi.statement) {
            // Create Hindi translation if didn't exist
            await tx.questionTranslation.create({
              data: {
                questionId: id,
                language: "HINDI",
                statement: editedQuestion.hindi.statement,
                options: editedQuestion.hindi.options || {},
                correctOptionIds: editedQuestion.hindi.correctOptionIds || [],
                solution: editedQuestion.hindi.solution || "",
              },
            });
          }
        }
      }

      // B. Handle specific review action
      if (action === "VERIFY") {
        // Mark Question as VERIFIED
        await tx.question.update({
          where: { id },
          data: {
            pyqVerificationStatus: "VERIFIED",
            pyqVerifiedById: sessionUser.id,
            pyqVerifiedAt: new Date(),
            isPublished: true,
            status: "PUBLISHED",
          },
        });

        // Mark PyqOccurrence as VERIFIED
        await tx.pyqOccurrence.updateMany({
          where: { questionId: id },
          data: {
            verificationStatus: "VERIFIED",
            verifiedById: sessionUser.id,
            verifiedAt: new Date(),
          },
        });

        // Update assignment junction row if exists
        if (assignmentJunction) {
          const wasAlreadyVerified = assignmentJunction.status === "VERIFIED";

          await tx.pyqAssignmentQuestion.update({
            where: { id: assignmentJunction.id },
            data: {
              status: "VERIFIED",
              reviewedAt: new Date(),
            },
          });

          // Update assignment counts safely
          if (!wasAlreadyVerified && assignmentJunction.assignmentId) {
            const currentAssignment = await tx.pyqAssignment.findUnique({
              where: { id: assignmentJunction.assignmentId },
              select: { pendingCount: true },
            });

            await tx.pyqAssignment.update({
              where: { id: assignmentJunction.assignmentId },
              data: {
                verifiedCount: { increment: 1 },
                pendingCount: Math.max(0, (currentAssignment?.pendingCount ?? 1) - 1),
                status: "IN_PROGRESS",
              },
            });
          }

          // Check if all questions in assignment are verified
          const remainingPending = await tx.pyqAssignmentQuestion.count({
            where: {
              assignmentId: assignmentJunction.assignmentId,
              status: { not: "VERIFIED" },
            },
          });

          if (remainingPending === 0) {
            await tx.pyqAssignment.update({
              where: { id: assignmentJunction.assignmentId },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
              },
            });
          }
        }

        // Create PyqReview record
        await tx.pyqReview.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            assignmentId: assignmentJunction?.assignmentId,
            verificationStatus: "VERIFIED",
            checklistData,
            reviewComments: reviewComments || "Approved and verified through 10-point checklist.",
            reviewedAt: new Date(),
          },
        });

        // Record history
        await tx.pyqReviewHistory.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            action: "VERIFIED",
            comments: reviewComments || "Verified and approved.",
            updatedData: { verificationStatus: "VERIFIED", checklist: checklistData },
          },
        });
      } else if (action === "NEEDS_CORRECTION") {
        await tx.question.update({
          where: { id },
          data: {
            pyqVerificationStatus: "NEEDS_CORRECTION",
            correctionStatus: "REWORK",
            correctionNotes: correctionsNeeded || reviewComments,
          },
        });

        if (assignmentJunction) {
          await tx.pyqAssignmentQuestion.update({
            where: { id: assignmentJunction.id },
            data: {
              status: "NEEDS_CORRECTION",
              reviewedAt: new Date(),
            },
          });
        }

        await tx.pyqReview.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            assignmentId: assignmentJunction?.assignmentId,
            verificationStatus: "NEEDS_CORRECTION",
            checklistData,
            flaggedIssue: flaggedIssue || "NEEDS_REVIEW",
            correctionsNeeded: correctionsNeeded || reviewComments,
            reviewComments,
            reviewedAt: new Date(),
          },
        });

        await tx.pyqReviewHistory.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            action: "FLAGGED_CORRECTION",
            comments: `Correction requested: ${flaggedIssue} - ${correctionsNeeded || reviewComments}`,
            updatedData: { verificationStatus: "NEEDS_CORRECTION", flaggedIssue, correctionsNeeded },
          },
        });
      } else if (action === "SAVE_LATER") {
        await tx.question.update({
          where: { id },
          data: {
            pyqVerificationStatus: "IN_REVIEW",
          },
        });

        if (assignmentJunction) {
          await tx.pyqAssignmentQuestion.update({
            where: { id: assignmentJunction.id },
            data: {
              status: "IN_REVIEW",
              reviewedAt: new Date(),
            },
          });
        }

        await tx.pyqReview.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            assignmentId: assignmentJunction?.assignmentId,
            verificationStatus: "IN_REVIEW",
            checklistData,
            reviewComments: reviewComments || "Progress saved. Review in progress.",
            reviewedAt: new Date(),
          },
        });

        await tx.pyqReviewHistory.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            action: "SAVED_PROGRESS",
            comments: "Review progress saved.",
            updatedData: { checklist: checklistData },
          },
        });
      } else if (action === "REOPEN") {
        await tx.question.update({
          where: { id },
          data: {
            pyqVerificationStatus: "IN_REVIEW",
            pyqVerifiedAt: null,
            pyqVerifiedById: null,
          },
        });

        await tx.pyqReviewHistory.create({
          data: {
            questionId: id,
            reviewerId: sessionUser.id,
            action: "EDITED_REOPENED",
            comments: reviewComments || "Verified question was edited. Verification status reopened.",
          },
        });
      }

      return { status: action };
    });

    return apiSuccess({
      message:
        action === "VERIFY"
          ? "Question approved and marked as VERIFIED!"
          : action === "NEEDS_CORRECTION"
          ? "Question flagged for corrections."
          : action === "SAVE_LATER"
          ? "Review progress saved."
          : "Question reopened for review.",
      result: updated,
    });
  } catch (error) {
    console.error("[pyq_review_post_error]", error);
    return handleApiError(error);
  }
}
