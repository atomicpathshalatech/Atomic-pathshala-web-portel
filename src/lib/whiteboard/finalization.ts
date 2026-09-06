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
export async function finalizeWhiteboardSlides(sessionId: string): Promise<void> {
  const session = await prisma.whiteboardSession.findUnique({
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

  if (!session) {
    console.error(`[FinalizeSlides] Session not found: ${sessionId}`);
    return;
  }

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

  const pagesData: PageDataForExport[] = session.pages.map((p) => ({
    pageNumber: p.pageNumber,
    background: p.background,
    objects: (p.objects as any) || [],
  }));

  const sessionTitle = session.title || session.batchSchedule.title || "Class Notes";

  // 1. --- PDF Generation & Storage ---
  let pdfKey: string | null = null;
  let pdfFileAssetId: string | null = null;

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

  // 3. Notify Clients via Pusher
  try {
    await pusherServer.trigger(teacherChannel(sessionId), "slides-finalized", {
      pdfStatus: pdfKey ? "READY" : "FAILED",
      pptxStatus: "COMPLETED",
    });
  } catch {
    // Non-blocking
  }
}
