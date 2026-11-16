import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { buildOccurrenceKey } from "@/lib/pyq/keys";

const resolveSchema = z.object({
  decision: z.enum(["MERGE_OCCURRENCE", "KEEP_BOTH", "NOT_DUPLICATE"]),
  note: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_APPROVE);
    const body = resolveSchema.parse(await request.json());

    const candidate = await prisma.questionDuplicateCandidate.findUnique({
      where: { id: params.id },
      include: {
        questionA: { include: { pyqOccurrences: true } },
        questionB: { include: { pyqOccurrences: true } },
      },
    });

    if (!candidate) {
      return apiError("Duplicate candidate not found", 404);
    }

    const now = new Date();

    if (body.decision === "MERGE_OCCURRENCE") {
      // Re-link all occurrences of Question B to Question A
      await prisma.$transaction(async (tx) => {
        for (const occ of candidate.questionB.pyqOccurrences) {
          const newKey = buildOccurrenceKey({
            questionId: candidate.questionAId,
            examId: occ.examId,
            year: occ.year,
            session: occ.session,
            shift: occ.shift,
            paper: occ.paper,
            questionNumber: occ.questionNumber,
          });

          // Check if occurrence already exists on A
          const existingOnA = await tx.pyqOccurrence.findUnique({
            where: { occurrenceKey: newKey },
          });

          if (!existingOnA) {
            await tx.pyqOccurrence.update({
              where: { id: occ.id },
              data: {
                questionId: candidate.questionAId,
                occurrenceKey: newKey,
                verifiedById: userId,
                verifiedAt: now,
              },
            });
          } else {
            // Already present on A, delete B's redundant occurrence
            await tx.pyqOccurrence.delete({ where: { id: occ.id } });
          }
        }

        // Update candidate status
        await tx.questionDuplicateCandidate.update({
          where: { id: candidate.id },
          data: {
            status: "CONFIRMED_DUPLICATE",
            decidedById: userId,
            decidedAt: now,
            decisionNote: body.note || "Merged occurrences into Question A",
          },
        });

        // Log audit
        await tx.auditLog.create({
          data: {
            userId,
            action: "PYQ_DUPLICATE_MERGE",
            entityType: "Question",
            entityId: candidate.questionAId,
            metadata: {
              sourceDuplicateQuestionId: candidate.questionBId,
              candidateId: candidate.id,
              note: body.note,
            },
          },
        });
      });

      return apiSuccess({
        message: "Successfully merged occurrences into canonical Question A.",
        canonicalQuestionId: candidate.questionAId,
      });
    }

    // KEEP_BOTH or NOT_DUPLICATE
    const newStatus = body.decision === "KEEP_BOTH" ? "KEEP_BOTH" : "NOT_DUPLICATE";
    await prisma.questionDuplicateCandidate.update({
      where: { id: candidate.id },
      data: {
        status: newStatus,
        decidedById: userId,
        decidedAt: now,
        decisionNote: body.note,
      },
    });

    return apiSuccess({
      message: `Status updated to ${newStatus}.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
