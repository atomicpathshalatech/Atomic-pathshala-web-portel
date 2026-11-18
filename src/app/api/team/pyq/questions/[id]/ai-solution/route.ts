import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError } from "@/lib/api/response";
import { requireTeamUser } from "@/lib/pyq/api";
import { runOneClickQuestionIntelligence } from "@/lib/pyq/one-click-ai-intelligence";

/**
 * POST /api/team/pyq/questions/[id]/ai-solution
 * ATOMIC PATHSHALA — ONE-CLICK AI QUESTION INTELLIGENCE ENGINE
 * Single API Call: Complete Academic QC + Structured Bilingual Solutions + NCERT Mapping + Metadata
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const { id } = params;

    if (!id) {
      return apiError("Question ID is required", 400);
    }

    // Run unified one-click intelligence
    const intelligence = await runOneClickQuestionIntelligence(id, sessionUser.id);

    // Record non-blocking audit trail entry
    try {
      await prisma.pyqReviewHistory.create({
        data: {
          questionId: id,
          reviewerId: sessionUser.id,
          action: "AI_INTELLIGENCE",
          comments: `One-Click AI Question Intelligence Engine generated all tabs (Model: ${intelligence.performance.modelUsed}, Latency: ${intelligence.performance.latencyMs}ms, Ref: ${intelligence.performance.correlationId})`,
        },
      });
    } catch {
      // non-blocking
    }

    return apiSuccess({
      ...intelligence,
      // Backward-compatible aliases for legacy callers if any
      solutionEn: intelligence.structuredSolutions.english,
      solutionHi: intelligence.structuredSolutions.hindi,
      markdownEn: intelligence.structuredSolutions.markdownEn,
      markdownHi: intelligence.structuredSolutions.markdownHi,
      derivedOption: intelligence.answerVerification.suggestedAnswer,
      mismatchWarning: intelligence.answerVerification.mismatchWarning,
    });
  } catch (error: any) {
    console.error(`[OneClickAI Error] CorrelationID: ${correlationId}`, error);
    const msg = error?.message || "An unexpected error occurred during AI intelligence processing.";
    return apiError(`AI Intelligence Engine: ${msg} (Ref: ${correlationId})`, 500, {
      correlationId,
      code: "AI_PROCESSING_ERROR",
    });
  }
}
