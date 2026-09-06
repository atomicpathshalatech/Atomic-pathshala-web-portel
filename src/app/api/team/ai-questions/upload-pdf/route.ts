import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { processSourcePdf } from "@/lib/ai-question-engine/pdf-processor";
import { defaultAiProvider } from "@/lib/ai-question-engine/gemini-provider";

export const maxDuration = 120; // 2 minutes timeout for large PDF processing

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const subject = (formData.get("subject") as string)?.trim();
    const chapter = (formData.get("chapter") as string)?.trim();

    if (!file) {
      return apiError("Please upload a source PDF file.", 400);
    }

    if (file.type && !file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return apiError("Invalid file type. Only PDF documents are supported.", 400);
    }

    // Check file size (max 30MB)
    const MAX_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return apiError("File exceeds maximum allowed size of 30MB.", 400);
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Basic PDF header verification
    if (!fileBuffer.subarray(0, 5).toString("utf-8").includes("%PDF")) {
      return apiError("Corrupted or invalid PDF file header.", 400);
    }

    // Process PDF and extract chunks/images
    const processed = await processSourcePdf({
      fileBuffer,
      fileName: file.name,
      userId: session.user.id,
      subject,
      chapter,
    });

    // If subject and chapter provided, detect syllabus topics
    let detectedTopics: Array<{
      topic: string;
      topicHindi?: string;
      subtopics: string[];
      pageEstimate: number[];
      conceptSummary: string;
      hasDiagramReferences: boolean;
    }> = [];

    if (subject && chapter && processed.extractedText) {
      try {
        detectedTopics = await defaultAiProvider.detectTopicsFromPdf({
          pdfText: processed.extractedText,
          subject,
          chapter,
        });
      } catch (topicErr) {
        console.warn("[UploadPdfRoute] Topic detection warning:", topicErr);
      }
    }

    return apiSuccess({
      sourcePdfId: processed.sourcePdfId,
      resourceId: processed.resourceId,
      fileName: processed.fileName,
      fileUrl: processed.fileUrl,
      fileSize: processed.fileSize,
      pageCount: processed.pageCount,
      fileHash: processed.fileHash,
      isDuplicate: processed.isDuplicate,
      chunksCount: processed.chunks.length,
      images: processed.images,
      detectedTopics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
