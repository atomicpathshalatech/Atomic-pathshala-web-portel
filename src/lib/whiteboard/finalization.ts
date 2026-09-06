import "server-only";
import { prisma } from "@/lib/db";
import { uploadBufferToR2, createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { generateWhiteboardPdf, PageDataForExport } from "./pdf-generator";
import { generateWhiteboardPptx } from "./pptx-generator";
import { pusherServer, sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Orchestrates background slide generation (PDF and PPTX) upon class conclusion:
 * 1. Collects all structured slide pages and vector objects from Postgres.
 * 2. Generates 16:9 PDF with branding.
 * 3. Uploads PDF to R2: `classes/${sessionId}/slides/final.pdf`.
 * 4. Creates FileAsset record and attaches slides to Chapter / Lecture notes (`Lecture.slidesUrl`).
 * 5. Generates 16:9 PPTX with branding (independent try-catch so PPTX failure never blocks PDF).
 * 6. Uploads PPTX to R2: `classes/${sessionId}/slides/final.pptx`.
 * 7. Updates WhiteboardSession status and triggers Pusher notification.
 */
/**
 * Best-effort marker for a failure that happens before the two independent
 * PDF/PPTX try-catch blocks even start (session lookup, initial status
 * write, or page-data mapping). Without this, such an error would throw out
 * of the fire-and-forget call in lifecycle.ts and leave the session's
 * pdfStatus/pptxStatus stuck on whatever they were before (often
 * "GENERATING" from a prior attempt), so the teacher's status-polling modal
 * would spin forever with no error ever surfaced.
 */
async function markBothFailed(sessionId: string, message: string): Promise<void> {
  try {
    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pdfStatus: "FAILED",
        pptxStatus: "FAILED",
        pdfError: message,
        pptxError: message,
      },
    });
  } catch (err) {
    console.error(`[FinalizeSlides] Could not mark session ${sessionId} as FAILED:`, err);
  }
}

export async function finalizeWhiteboardSlides(sessionId: string): Promise<void> {
  let session;
  try {
    session = await prisma.whiteboardSession.findUnique({
      where: { id: sessionId },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
        batchSchedule: {
          include: {
            batch: true,
            lecture: true,
          },
        },
      },
    });
  } catch (err: any) {
    console.error(`[FinalizeSlides] Failed to load session ${sessionId}:`, err);
    await markBothFailed(sessionId, err?.message || "Failed to load session");
    return;
  }

  if (!session) {
    console.error(`[FinalizeSlides] Session not found: ${sessionId}`);
    return;
  }

  let pagesData: PageDataForExport[];
  let sessionTitle: string;
  try {
    // Mark as PENDING / GENERATING
    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pdfStatus: "GENERATING",
        pptxStatus: "GENERATING",
        pdfError: null,
        pptxError: null,
      },
    });

    pagesData = session.pages.map((p) => ({
      pageNumber: p.pageNumber,
      background: p.background,
      objects: (p.objects as any) || [],
    }));

    sessionTitle = session.title || session.batchSchedule.title || "Class Notes";
  } catch (err: any) {
    console.error(`[FinalizeSlides] Failed to initialize generation for ${sessionId}:`, err);
    await markBothFailed(sessionId, err?.message || "Failed to start slide generation");
    return;
  }

  // 1. --- PDF Generation & Storage ---
  let pdfKey: string | null = null;
  let pdfFileAssetId: string | null = null;
  let pdfFinalStatus: "READY" | "FAILED" = "FAILED";

  try {
    const pdfBuffer = await generateWhiteboardPdf(pagesData, sessionTitle);
    pdfKey = `classes/${sessionId}/slides/final.pdf`;

    await uploadBufferToR2({
      key: pdfKey,
      buffer: pdfBuffer,
      contentType: "application/pdf",
      metadata: {
        whiteboardSessionId: sessionId,
        title: sessionTitle,
      },
    });

    // Create FileAsset
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: session.teacherId,
        fileType: "PDF",
        storageProvider: "r2",
        storageKey: pdfKey,
        originalFilename: `${sessionTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Notes.pdf`,
        mimeType: "application/pdf",
        sizeBytes: BigInt(pdfBuffer.length),
        status: "ACTIVE",
        visibility: "PROTECTED",
        metadata: {
          whiteboardSessionId: sessionId,
          batchScheduleId: session.batchScheduleId,
          pageCount: pagesData.length,
          type: "CLASS_SLIDES_PDF",
        },
      },
    });
    pdfFileAssetId = fileAsset.id;

    // Attach to Lecture if BatchSchedule has an attached lecture
    if (session.batchSchedule.lectureId) {
      await prisma.lecture.update({
        where: { id: session.batchSchedule.lectureId },
        data: { slidesUrl: `/api/whiteboard/sessions/${sessionId}/slides?format=pdf` },
      });
    }

    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pdfStatus: "READY",
        pdfStorageKey: pdfKey,
        pdfFileAssetId: fileAsset.id,
      },
    });
    pdfFinalStatus = "READY";
  } catch (err: any) {
    console.error(`[FinalizeSlides] PDF Generation failed for ${sessionId}:`, err);
    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pdfStatus: "FAILED",
        pdfError: err?.message || "PDF generation error",
      },
    });
  }

  // 2. --- PPTX Generation & Storage (Independent, Teacher-Only) ---
  let pptxFinalStatus: "READY" | "FAILED" = "FAILED";
  try {
    const pptxBuffer = await generateWhiteboardPptx(pagesData, sessionTitle);
    const pptxKey = `classes/${sessionId}/slides/final.pptx`;

    await uploadBufferToR2({
      key: pptxKey,
      buffer: pptxBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      metadata: {
        whiteboardSessionId: sessionId,
        title: sessionTitle,
      },
    });

    const pptxAsset = await prisma.fileAsset.create({
      data: {
        ownerId: session.teacherId,
        fileType: "DOCUMENT",
        storageProvider: "r2",
        storageKey: pptxKey,
        originalFilename: `${sessionTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Slides.pptx`,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        sizeBytes: BigInt(pptxBuffer.length),
        status: "ACTIVE",
        visibility: "PRIVATE", // Strictly private / teacher only
        metadata: {
          whiteboardSessionId: sessionId,
          batchScheduleId: session.batchScheduleId,
          pageCount: pagesData.length,
          type: "CLASS_SLIDES_PPTX",
        },
      },
    });

    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pptxStatus: "READY",
        pptxStorageKey: pptxKey,
        pptxFileAssetId: pptxAsset.id,
        finalizedAt: new Date(),
      },
    });
    pptxFinalStatus = "READY";
  } catch (err: any) {
    console.error(`[FinalizeSlides] PPTX Generation failed for ${sessionId}:`, err);
    await prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        pptxStatus: "FAILED",
        pptxError: err?.message || "PPTX generation error",
        finalizedAt: new Date(),
      },
    });
  }

  // 3. Notify Clients via Pusher (best-effort; TeacherPostClassModal primarily
  // polls the status endpoint on a timer, so this is a supplementary nudge).
  try {
    await pusherServer.trigger(teacherChannel(sessionId), "slides-finalized", {
      pdfStatus: pdfFinalStatus,
      pptxStatus: pptxFinalStatus,
    });
  } catch {
    // Non-blocking
  }
}
