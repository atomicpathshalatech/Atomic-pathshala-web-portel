import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { runMultiModelAudit } from "@/lib/ai-provider/multi-model-hub";
import { retrieveSourceContext } from "@/lib/source-library/service";
import { QuestionSnapshot } from "@/lib/ai-provider/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const auditRequestSchema = z.object({
  questionId: z.string().optional(),
  sourceMaterialId: z.string().optional(),
  snapshot: z
    .object({
      id: z.string().optional(),
      questionCode: z.string().optional(),
      statement: z.string().min(1),
      options: z.record(z.string()),
      storedAnswer: z.array(z.string()),
      solution: z.string().optional().default(""),
      subject: z.string().min(1),
      chapter: z.string().optional(),
      topic: z.string().optional(),
      subTopic: z.string().optional(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD", "ULTRA"]).optional(),
      type: z.string().optional(),
      language: z.enum(["ENGLISH", "HINDI", "BOTH"]).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
    const userId = session.user.id;

    const body = auditRequestSchema.parse(await req.json());

    let snapshot: QuestionSnapshot;

    if (body.snapshot) {
      snapshot = {
        ...body.snapshot,
        solution: body.snapshot.solution || "",
      };
    } else if (body.questionId) {
      const q = await prisma.question.findUnique({
        where: { id: body.questionId },
        include: { translations: true },
      });
      if (!q) {
        return handleApiError(new Error("Question not found"), 404);
      }

      const enTrans = q.translations.find((t) => t.language === "ENGLISH") || q.translations[0];
      const parsedOptions: Record<string, string> = {};
      if (enTrans?.options && Array.isArray(enTrans.options)) {
        enTrans.options.forEach((opt: any) => {
          parsedOptions[opt.key || ""] = opt.text || "";
        });
      }

      snapshot = {
        id: q.id,
        questionCode: q.questionCode || undefined,
        statement: enTrans?.statement || "",
        options: parsedOptions,
        storedAnswer: enTrans?.correctAnswer || [],
        solution: q.solution || enTrans?.solution || "",
        subject: q.subject,
        chapter: q.chapter || undefined,
        topic: q.topic || undefined,
        subTopic: q.subTopic || undefined,
        difficulty: (q.difficulty as any) || "MEDIUM",
        type: q.type || "SINGLE_CORRECT",
      };
    } else {
      return handleApiError(new Error("Either questionId or snapshot is required"), 400);
    }

    // Retrieve source material grounding context if available
    const sourceContext = await retrieveSourceContext({
      subject: snapshot.subject,
      chapter: snapshot.chapter || "",
      topic: snapshot.topic,
      sourceMaterialId: body.sourceMaterialId,
    });

    // Run the multi-model audit (Gemini L1, OpenAI L2, Claude L3 + Math & Chem Validators)
    const result = await runMultiModelAudit(snapshot, sourceContext, {
      persist: true,
      userId,
      sourceMaterialId: body.sourceMaterialId,
    });

    return apiSuccess(result);
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");
    const auditId = searchParams.get("auditId");

    if (auditId) {
      const audit = await prisma.questionReviewAudit.findUnique({
        where: { id: auditId },
        include: { overriddenBy: { select: { name: true, email: true } } },
      });
      return apiSuccess(audit);
    }

    if (questionId) {
      const audits = await prisma.questionReviewAudit.findMany({
        where: { questionId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { overriddenBy: { select: { name: true, email: true } } },
      });
      return apiSuccess(audits);
    }

    const recentAudits = await prisma.questionReviewAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { overriddenBy: { select: { name: true, email: true } } },
    });
    return apiSuccess(recentAudits);
  } catch (err: any) {
    return handleApiError(err);
  }
}
