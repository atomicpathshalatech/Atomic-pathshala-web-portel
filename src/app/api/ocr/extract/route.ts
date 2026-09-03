import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { executeOcrPipeline } from "@/lib/ocr/provider";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { imageBase64, mimeType, solutionImageBase64, language } = body;

    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length < 20) {
      return apiError("A valid question image (imageBase64) is required for extraction.", 400);
    }

    // Execute modular OCR pipeline (Self-hosted PaddleOCR with local fallback)
    const { document, question } = await executeOcrPipeline({
      imageBase64,
      mimeType: mimeType || "image/png",
      solutionImageBase64,
      language: language || "both",
    });

    // Audit log extraction
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OCR_QUESTION_EXTRACT",
        entityType: "OCRDocument",
        metadata: {
          confidence: document.confidence,
          provider: document.metadata.provider,
          elementsCount: document.elements.length,
          hasMath: document.metadata.hasMath,
          hasChemistry: document.metadata.hasChemistry,
        },
      },
    }).catch((e) => console.warn("[AuditLog] OCR log error:", e));

    return apiSuccess({
      status: "completed",
      document,
      question,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
