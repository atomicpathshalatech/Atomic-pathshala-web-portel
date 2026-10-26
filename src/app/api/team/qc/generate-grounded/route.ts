import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateAndAuditQuestion } from "@/lib/ai-provider/multi-model-hub";
import { retrieveSourceContext } from "@/lib/source-library/service";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const generateSchema = z.object({
  subject: z.string().min(1),
  classLevel: z.string().default("CLASS_11"),
  chapter: z.string().min(1),
  topic: z.string().optional(),
  subTopic: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "ULTRA"]).default("MEDIUM"),
  questionType: z.enum(["SINGLE_CORRECT", "ASSERTION_REASON", "STATEMENT", "MATCH"]).default("SINGLE_CORRECT"),
  sourceMaterialId: z.string().optional(),
  customInstructions: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
    const userId = session.user.id;

    const body = generateSchema.parse(await req.json());

    // 1. Retrieve grounded source passages from PostgreSQL
    const sourceContext = await retrieveSourceContext({
      subject: body.subject,
      chapter: body.chapter,
      topic: body.topic,
      sourceMaterialId: body.sourceMaterialId,
    });

    // 2. Generate with Gemini + audit independently across Gemini, OpenAI, Claude + deterministic checks
    const result = await generateAndAuditQuestion(
      {
        subject: body.subject,
        classLevel: body.classLevel,
        chapter: body.chapter,
        topic: body.topic,
        subTopic: body.subTopic,
        difficulty: body.difficulty,
        questionType: body.questionType,
        sourceMaterialId: body.sourceMaterialId,
        customInstructions: body.customInstructions,
      },
      sourceContext,
      { userId }
    );

    return apiSuccess(result);
  } catch (err: any) {
    return handleApiError(err);
  }
}
