import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Resolves a direct presigned download URL for an original uploaded presentation or document file.
 */
async function resolveOriginalDownloadUrl(
  urlOrKey: string,
  fallbackFilename: string
): Promise<string> {
  // Case 1: Pure R2 storage key (e.g. "modules/live-classes/...")
  if (
    !urlOrKey.startsWith("http://") &&
    !urlOrKey.startsWith("https://") &&
    !urlOrKey.startsWith("/api/") &&
    !urlOrKey.startsWith("blob:")
  ) {
    return createPresignedDownloadUrl({
      key: urlOrKey,
      expiresInSeconds: 900,
      contentDisposition: `attachment; filename="${encodeURIComponent(fallbackFilename)}"`,
    });
  }

  // Case 2: FileAsset access URL (e.g. "/api/files/<id>/access")
  const fileIdMatch = urlOrKey.match(/\/api\/files\/([a-zA-Z0-9_-]+)\/access/);
  if (fileIdMatch && fileIdMatch[1]) {
    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: fileIdMatch[1] },
    });
    if (fileAsset?.storageKey) {
      return createPresignedDownloadUrl({
        key: fileAsset.storageKey,
        expiresInSeconds: 900,
        contentDisposition: `attachment; filename="${encodeURIComponent(
          fallbackFilename || fileAsset.originalFilename
        )}"`,
      });
    }
  }

  // Case 3: Absolute R2 URL with pathname
  try {
    const parsed = new URL(urlOrKey);
    const pathnameKey = parsed.pathname.replace(/^\/+/, "");
    if (pathnameKey && (pathnameKey.startsWith("modules/") || pathnameKey.startsWith("documents/") || pathnameKey.startsWith("classes/"))) {
      return createPresignedDownloadUrl({
        key: pathnameKey,
        expiresInSeconds: 900,
        contentDisposition: `attachment; filename="${encodeURIComponent(fallbackFilename)}"`,
      });
    }
  } catch {
    // ignore URL parse errors for relative paths
  }

  // If the stored URL is a local blob, throw user-friendly error instead of navigating to dead tab
  if (urlOrKey.startsWith("blob:")) {
    throw new Error("The presentation material was not saved to permanent cloud storage. Please upload the document again in Material Setup.");
  }

  // Fallback: return as-is
  return urlOrKey;
}

/**
 * Generates presigned download URLs for class teaching materials & whiteboard exports:
 * - PDF: Whiteboard Export containing all handwritten notes, annotations, math shapes, and slide backgrounds.
 * - ORIGINAL PPT / PPTX: Exact original uploaded presentation file (Strictly Faculty Only).
 * - ORIGINAL PDF: Exact original uploaded teaching document (Faculty & Enrolled Students).
 * - STATUS: Realtime readiness state of all materials.
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
        presentationUrl: true,
        presentationName: true,
        presentationType: true,
        teacherId: true,
        batchScheduleId: true,
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const hasPresentation = Boolean(wbSession.presentationUrl);
    const isPpt =
      hasPresentation &&
      (wbSession.presentationType === "PPTX" ||
        wbSession.presentationName?.toLowerCase().endsWith(".ppt") ||
        wbSession.presentationName?.toLowerCase().endsWith(".pptx") ||
        wbSession.presentationUrl?.toLowerCase().includes(".ppt") ||
        wbSession.presentationUrl?.toLowerCase().includes(".pptx"));

    const isPdf =
      hasPresentation &&
      (wbSession.presentationType === "PDF" ||
        wbSession.presentationName?.toLowerCase().endsWith(".pdf") ||
        wbSession.presentationUrl?.toLowerCase().includes(".pdf"));

    const originalPptName =
      wbSession.presentationName ||
      `${(wbSession.title || "Class_Presentation").replace(/[^a-zA-Z0-9_-]/g, "_")}.pptx`;
    const originalPdfName =
      wbSession.presentationName ||
      `${(wbSession.title || "Class_Document").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    // Format = status: return readiness of all material formats
    if (format === "status") {
      return apiSuccess({
        pdfStatus: wbSession.pdfStatus,
        pptxStatus: access.role === "TEACHER" ? (isPpt ? "READY" : wbSession.pptxStatus) : "FORBIDDEN",
        finalizedAt: wbSession.finalizedAt,
        pdfError: access.role === "TEACHER" ? wbSession.pdfError : null,
        pptxError: access.role === "TEACHER" ? wbSession.pptxError : null,
        hasOriginalPresentation: hasPresentation,
        presentationType: wbSession.presentationType,
        presentationName: wbSession.presentationName,
        hasOriginalPpt: Boolean(isPpt),
        originalPptName: isPpt ? originalPptName : null,
        hasOriginalPdf: Boolean(isPdf),
        originalPdfName: isPdf ? originalPdfName : null,
      });
    }

    // Format = original_ppt / original_pptx: Download the exact uploaded PPT/PPTX file
    if (format === "original_ppt" || format === "original_pptx" || (format === "pptx" && isPpt)) {
      if (access.role !== "TEACHER") {
        return apiError("PPTX source presentations are restricted to faculty only.", 403);
      }

      if (isPpt && wbSession.presentationUrl) {
        const downloadUrl = await resolveOriginalDownloadUrl(
          wbSession.presentationUrl,
          originalPptName
        );
        return apiSuccess({
          downloadUrl,
          filename: originalPptName,
          isOriginal: true,
        });
      }

      // If no original PPT was uploaded, check if generated PPTX is available
      if (wbSession.pptxStatus === "READY" && wbSession.pptxStorageKey) {
        const downloadUrl = await createPresignedDownloadUrl({
          key: wbSession.pptxStorageKey,
          expiresInSeconds: 600,
          contentDisposition: `attachment; filename="${encodeURIComponent(
            wbSession.title || "Class_Slides"
          )}.pptx"`,
        });
        return apiSuccess({ downloadUrl, filename: `${wbSession.title || "Class_Slides"}.pptx` });
      }

      return apiError(
        wbSession.pptxStatus === "GENERATING"
          ? "PPT slides are still processing. Please try again shortly."
          : "No original PPT presentation was uploaded for this session.",
        404
      );
    }

    // Format = original_pdf / original_document: Download the exact uploaded PDF document
    if (format === "original_pdf" || format === "original_document") {
      if (!isPdf || !wbSession.presentationUrl) {
        return apiError("No original PDF document was uploaded for this session.", 404);
      }

      const downloadUrl = await resolveOriginalDownloadUrl(
        wbSession.presentationUrl,
        originalPdfName
      );
      return apiSuccess({
        downloadUrl,
        filename: originalPdfName,
        isOriginal: true,
      });
    }

    // Format = pdf: Annotated Whiteboard Export (Available for TEACHER and STUDENTS)
    if (format === "pdf") {
      let activeStorageKey = wbSession.pdfStorageKey;

      if (!activeStorageKey || wbSession.pdfStatus !== "READY") {
        // On-demand generation: Finalize slides immediately if not already cached
        const { finalizeWhiteboardSlides } = await import("@/lib/whiteboard/finalization");
        await finalizeWhiteboardSlides(params.id).catch((err) =>
          console.warn("[on_demand_finalizeWhiteboardSlides_warning]", err)
        );

        const refreshed = await prisma.whiteboardSession.findUnique({
          where: { id: params.id },
          select: { pdfStorageKey: true, pdfStatus: true },
        });

        if (refreshed?.pdfStorageKey) {
          activeStorageKey = refreshed.pdfStorageKey;
        }
      }

      if (activeStorageKey) {
        try {
          const downloadUrl = await createPresignedDownloadUrl({
            key: activeStorageKey,
            expiresInSeconds: 900,
            contentDisposition: `inline; filename="${encodeURIComponent(
              (wbSession.title || "Class_Notes") + "_Whiteboard"
            )}.pdf"`,
          });
          return apiSuccess({
            downloadUrl,
            filename: `${(wbSession.title || "Class_Notes") + "_Whiteboard"}.pdf`,
          });
        } catch (r2Err) {
          console.warn("[r2_presign_failed_falling_back_to_direct_stream]", r2Err);
        }
      }

      // Direct Stream Fallback: Generate vector PDF in-memory and stream directly
      const sessionWithPages = await prisma.whiteboardSession.findUnique({
        where: { id: params.id },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      });

      if (!sessionWithPages) return apiError("Session not found", 404);

      const { generateWhiteboardPdf } = await import("@/lib/whiteboard/pdf-generator");
      const pagesData = sessionWithPages.pages.map((p) => ({
        pageNumber: p.pageNumber,
        background: p.background,
        objects: (p.objects as any) || [],
      }));

      const pdfBuffer = await generateWhiteboardPdf(
        pagesData,
        sessionWithPages.title || "Class Notes"
      );

      const filename = `${encodeURIComponent(
        (sessionWithPages.title || "Class_Notes") + "_Whiteboard"
      )}.pdf`;
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Content-Length": String(pdfBuffer.length),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return apiError(
      "Invalid format specified. Must be 'pdf', 'original_ppt', 'original_pdf', 'pptx', or 'status'.",
      400
    );
  } catch (error) {
    return handleApiError(error);
  }
}

