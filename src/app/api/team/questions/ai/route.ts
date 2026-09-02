import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  parseQuestionFromRawText,
  extractFromImage,
  generateEducationalTranslation,
  verifyTranslation,
  generateAiMetadata,
  generateAiSolution,
} from "@/lib/questions/ai-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { action, payload } = body;

    if (action === "extract") {
      const result = parseQuestionFromRawText(payload.rawText || "");
      return apiSuccess({ result });
    }

    if (action === "ocr_image") {
      if (!payload.imageBase64) {
        return apiError("imageBase64 is required for OCR extraction", 400);
      }
      const result = await extractFromImage(
        payload.imageBase64,
        payload.mimeType || "image/png"
      );

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "QUESTION_OCR_EXTRACT",
          entityType: "QuestionOCR",
          metadata: {
            confidence: result.confidence,
            hasOptions: Boolean(result.optionA && result.optionB),
          },
        },
      });

      return apiSuccess({ result });
    }

    if (action === "translate") {
      const translation = await generateEducationalTranslation(
        payload.text || "",
        payload.sourceLanguage || "ENGLISH"
      );
      return apiSuccess({ translation });
    }

    if (action === "verify_translation") {
      const report = await verifyTranslation(
        payload.englishText || "",
        payload.hindiText || ""
      );
      return apiSuccess({ report });
    }

    if (action === "metadata") {
      const metadata = generateAiMetadata(
        payload.statement || "",
        payload.options
      );
      return apiSuccess({ metadata });
    }

    if (action === "solution") {
      const solution = generateAiSolution(
        payload.statement || "",
        payload.options || {},
        payload.correctAnswer || "A"
      );
      return apiSuccess({ solution });
    }

    return apiError("Unknown AI action requested", 400);
  } catch (error) {
    return handleApiError(error);
  }
}