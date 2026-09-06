import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Generates presigned download URLs for finalized slide materials:
 * - PDF: Accessible by TEACHER and enrolled STUDENTS.
 * - PPTX: Strictly forbidden for STUDENTS (403). Only TEACHER (and academic heads) can download PPTX.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "status").toLowerCase();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        status: true,
        pdfStatus: true,
        pptxStatus: true,
        pdfStorageKey: true,
        pptxStorageKey: true,
        pdfError: true,
        pptxError: true,
        finalizedAt: true,
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    // Format = status: return current generation status for both
    if (format === "status") {
      return apiSuccess({
        pdfStatus: wbSession.pdfStatus,
        pptxStatus: access.role === "TEACHER" ? wbSession.pptxStatus : "FORBIDDEN",
        finalizedAt: wbSession.finalizedAt,
        pdfError: access.role === "TEACHER" ? wbSession.pdfError : null,
        pptxError: access.role === "TEACHER" ? wbSession.pptxError : null,
      });
    }

    // Format = pptx: Strictly TEACHER only
    if (format === "pptx") {
      if (access.role !== "TEACHER") {
        return apiError("PPTX source files are restricted to educators only.", 403);
      }

      if (wbSession.pptxStatus !== "READY" || !wbSession.pptxStorageKey) {
        return apiError(
          wbSession.pptxStatus === "GENERATING"
            ? "PPTX slides are still generating. Please try again in a few seconds."
            : "PPTX presentation is not available for this session.",
          404
        );
      }

      const downloadUrl = await createPresignedDownloadUrl({
        key: wbSession.pptxStorageKey,
        expiresInSeconds: 600,
        contentDisposition: `attachment; filename="${encodeURIComponent(wbSession.title || "Class_Slides")}.pptx"`,
      });

      return apiSuccess({ downloadUrl });
    }

    // Format = pdf: Available for both TEACHER and enrolled STUDENTS
    if (format === "pdf") {
      if (wbSession.pdfStatus !== "READY" || !wbSession.pdfStorageKey) {
        return apiError(
          wbSession.pdfStatus === "GENERATING"
            ? "PDF notes are still generating. Please wait a moment."
            : "PDF notes are not available for this session.",
          404
        );
      }

      const downloadUrl = await createPresignedDownloadUrl({
        key: wbSession.pdfStorageKey,
        expiresInSeconds: 900,
        contentDisposition: `inline; filename="${encodeURIComponent(wbSession.title || "Class_Notes")}.pdf"`,
      });

      return apiSuccess({ downloadUrl });
    }

    return apiError("Invalid format specified. Must be 'pdf', 'pptx', or 'status'.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
