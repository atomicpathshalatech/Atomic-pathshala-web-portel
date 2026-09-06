import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { startGenerationJob } from "@/lib/ai-question-engine/job-runner";
import { GenerationLanguage, NeetDifficulty } from "@/lib/ai-question-engine/types";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const {
      method = "AI",
      subject,
      chapter,
      selectedTopics = [],
      selectedSubtopics = [],
      difficulties = ["MEDIUM"],
      questionTypes = ["SINGLE_CORRECT"],
      language = "BOTH",
      totalQuestions = 10,
      generationPlan,
      sourcePdfId,
    } = body;

    if (!subject?.trim()) return apiError("Subject is required.", 400);
    if (!chapter?.trim()) return apiError("Chapter is required.", 400);
    if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return apiError("At least one topic must be selected.", 400);
    }
    if (method === "PDF" && !sourcePdfId) {
      return apiError("sourcePdfId is mandatory for BY PDF generation mode.", 400);
    }

    const qty = Math.max(1, Math.min(100, Number(totalQuestions) || 10));

    // Construct default generation plan if not provided
    const plan = generationPlan || {
      totalQuestions: qty,
      items: questionTypes.map((t: string) => ({
        questionTypeId: t,
        typeName: t,
        count: Math.max(1, Math.floor(qty / questionTypes.length)),
      })),
      difficultyMix: difficulties.reduce((acc: any, d: string) => {
        acc[d] = Math.max(1, Math.floor(qty / difficulties.length));
        return acc;
      }, {}),
      language,
    };

    const jobResult = await startGenerationJob({
      method: method as "AI" | "PDF",
      subject: subject.trim(),
      chapter: chapter.trim(),
      selectedTopics,
      selectedSubtopics,
      difficulties: difficulties as NeetDifficulty[],
      questionTypes,
      language: language as GenerationLanguage,
      totalQuestions: qty,
      generationPlan: plan,
      sourcePdfId,
      userId: session.user.id,
    });

    return apiSuccess(jobResult, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
