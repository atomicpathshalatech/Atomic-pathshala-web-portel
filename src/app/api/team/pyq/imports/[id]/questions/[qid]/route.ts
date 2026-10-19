import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { approvalBlockers, updateExtracted } from "@/lib/pyq/review-service";

const opt = z.string().max(4000);
const schema = z.object({
  statement: z.string().max(20_000).optional(),
  options: z.object({ A: opt, B: opt, C: opt, D: opt }).optional(),
  correctAnswer: z.string().max(10).optional(),
  solution: z.string().max(40_000).nullable().optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
  pyqExamId: z.string().nullable().optional(),
  pyqYear: z.number().int().nullable().optional(),
  pyqSession: z.string().max(40).nullable().optional(),
  pyqShift: z.string().max(40).nullable().optional(),
  pyqPaper: z.string().max(40).nullable().optional(),
  pyqQuestionNumber: z.string().max(20).nullable().optional(),
  subject: z.string().max(40).optional(),
  chapter: z.string().max(160).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
});

/** PATCH — correct an extracted question (text, options, answer, solution, image, exam/year, chapter). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; qid: string } }) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const patch = schema.parse(await request.json());
    const exists = await prisma.extractedQuestion.findFirst({ where: { id: params.qid, jobId: params.id }, select: { id: true } });
    if (!exists) return apiError("Question not found in this import", 404);
    const updated = await updateExtracted(params.qid, patch, userId);
    return apiSuccess({ question: updated, blockers: approvalBlockers(updated) });
  } catch (error) {
    if (error instanceof Error && /Already approved|must be|looks wrong/.test(error.message)) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
