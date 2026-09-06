import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  extractBilingualQuestionFromImage,
  extractBilingualQuestionFromText,
  generateSubjectAwareSolution,
  checkAndTranslateQuestion,
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

    // 1. Unified Auto-Extract (Image OCR or Raw Text)
    if (action === "auto_extract" || action === "ocr_image") {
      let result;
      if (payload.imageBase64) {
        result = await extractBilingualQuestionFromImage({
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType || "image/png",
          solutionImageBase64: payload.solutionImageBase64,
          solutionMimeType: payload.solutionMimeType || "image/png",
          subjectContext: payload.subject,
          chapterContext: payload.chapter,
          topicContext: payload.topic,
          difficultyContext: payload.difficulty,
        });
      } else if (payload.rawText?.trim()) {
        result = await extractBilingualQuestionFromText({
          rawText: payload.rawText.trim(),
          subjectContext: payload.subject,
          chapterContext: payload.chapter,
          topicContext: payload.topic,
          difficultyContext: payload.difficulty,
        });
      } else {
        return apiError("imageBase64 or rawText is required for auto extraction.", 400);
      }

      // Audit log the extraction
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "QUESTION_AUTO_EXTRACT",
          entityType: "QuestionExtract",
          metadata: {
            confidence: result.confidence,
            isBilingual: result.isBilingual,
            subject: result.subject,
            hasFigure: result.hasFigure,
          },
        },
      }).catch(() => {});

      return apiSuccess({ result });
    }

    // 2. CHECK TRANSLATION Action (Aligns & translates missing language)
    if (action === "check_translation") {
      const result = await checkAndTranslateQuestion({
        subject: payload.subject || "Biology",
        statementEn: payload.statementEn || "",
        statementHi: payload.statementHi || "",
        optionsEn: payload.optionsEn || {},
        optionsHi: payload.optionsHi || {},
        solutionEn: payload.solutionEn || "",
        solutionHi: payload.solutionHi || "",
      });
      return apiSuccess({ result });
    }

    // 3. Subject-Aware Solution Generation
    if (action === "solution" || action === "generate_solution" || action === "generate_subject_solution") {
      const solutionResult = await generateSubjectAwareSolution({
        subject: payload.subject || "Biology",
        statementEn: payload.statementEn || "",
        statementHi: payload.statementHi || "",
        optionsEn: payload.optionsEn || {},
        optionsHi: payload.optionsHi || {},
        correctAnswer: payload.correctAnswer,
        userSelectedAnswer: payload.userSelectedAnswer,
        userProvidedSolution: payload.userProvidedSolution,
      });
      return apiSuccess({ solution: solutionResult });
    }

    // 4. Legacy actions preserved for backwards compatibility
    if (action === "extract") {
      const result = parseQuestionFromRawText(payload.rawText || "");
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

    return apiError("Unknown AI action requested", 400);
  } catch (error: any) {
    console.error("[Questions AI Route] Execution Error:", error);
    const msg = error?.message || (typeof error === "string" ? error : "AI extraction encountered an unexpected error.");
    return apiError(msg, 500);
  }
}