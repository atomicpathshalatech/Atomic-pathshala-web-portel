import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  extractBilingualQuestionFromImage,
  translateQuestionContent,
  generateExpandedSolution,
} from "@/lib/questions/gemini-engine";
import {
  parseQuestionFromRawText,
  verifyTranslation,
  generateAiMetadata,
} from "@/lib/questions/ai-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { action, payload = {} } = body;

    if (action === "extract") {
      const result = parseQuestionFromRawText(payload.rawText || "");
      return apiSuccess({ result });
    }

    if (action === "ocr_image") {
      if (!payload.imageBase64) {
        return apiError("imageBase64 is required for OCR extraction", 400);
      }

      const result = await extractBilingualQuestionFromImage({
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType || "image/png",
        solutionImageBase64: payload.solutionImageBase64,
        solutionMimeType: payload.solutionMimeType || "image/png",
      });

      // Audit log the OCR extraction
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "QUESTION_OCR_EXTRACT",
          entityType: "QuestionOCR",
          metadata: {
            confidence: result.confidence,
            isBilingual: result.isBilingual,
            subject: result.subject,
            hasFigure: result.hasFigure,
          },
        },
      });

      return apiSuccess({ result });
    }

    if (action === "translate") {
      const translated = await translateQuestionContent({
        text: payload.text || "",
        targetLang: payload.targetLang || "HINDI",
        subject: payload.subject,
      });
      return apiSuccess({ translated });
    }

    if (action === "verify_translation") {
      const verification = await verifyTranslation(
        payload.statementEn || payload.englishText || "",
        payload.statementHi || payload.hindiText || ""
      );
      return apiSuccess({ verification });
    }

    if (action === "metadata") {
      const metadata = generateAiMetadata(
        payload.statement || "",
        payload.options
      );
      return apiSuccess({ metadata });
    }

    if (action === "solution") {
      const solution = await generateExpandedSolution({
        statement: payload.statement || "",
        options: payload.options || {},
        correctAnswer: Array.isArray(payload.correctAnswer) ? payload.correctAnswer : [payload.correctAnswer || "A"],
        subject: payload.subject,
      });
      return apiSuccess({ solution });
    }

    return apiError("Unknown AI action requested", 400);
  } catch (error) {
    return handleApiError(error);
  }
}