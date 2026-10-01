import "server-only";
import { prisma } from "@/lib/db";
import { ROOT_FOLDER_NAME } from "@/lib/batch/folders";
import { CLASS_NOTES_FOLDER, ensureFolder } from "@/lib/batch/past-classes";

/**
 * Attaches a notes PDF to any class — live, recorded, an old class added
 * later, or a YouTube class:
 *  - the class's player shows it (lecture notes, or the class session's
 *    slides when the class has no chapter lecture), and
 *  - it is filed in the batch under Materials → Class Notes → <subject>.
 * Re-uploading replaces the earlier notes everywhere (player and Materials).
 */

export class ClassNotesError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function attachClassNotes(scheduleId: string, fileAssetId: string, userId: string) {
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      title: true,
      type: true,
      subject: true,
      batchId: true,
      lectureId: true,
      chapter: { select: { subject: { select: { title: true } } } },
      liveWhiteboardSession: { select: { id: true, presentationUrl: true } },
    },
  });
  if (!schedule) throw new ClassNotesError("Class not found", 404);
  if (schedule.type !== "LIVE_CLASS") throw new ClassNotesError("Notes can be added to classes only.");

  const asset = await prisma.fileAsset.findUnique({
    where: { id: fileAssetId },
    select: { id: true, ownerId: true, originalFilename: true, sizeBytes: true, mimeType: true, status: true },
  });
  if (!asset || asset.status !== "ACTIVE") throw new ClassNotesError("The notes PDF didn't finish uploading — upload it again.", 410);
  // Only your own upload: otherwise any staff id could expose another document.
  if (asset.ownerId !== userId) throw new ClassNotesError("You can only attach a PDF you uploaded.", 403);
  if (asset.mimeType !== "application/pdf" && !asset.originalFilename.toLowerCase().endsWith(".pdf")) {
    throw new ClassNotesError("Notes must be a PDF file.");
  }

  // Signed-in link that always opens a fresh short-lived URL (same as chapter notes).
  const openUrl = `/api/files/${asset.id}/open`;
  const subject = schedule.chapter?.subject.title ?? schedule.subject ?? "General";

  return prisma.$transaction(async (tx) => {
    const rootId = await ensureFolder(tx as typeof prisma, schedule.batchId, null, ROOT_FOLDER_NAME, userId);
    const notesId = await ensureFolder(tx as typeof prisma, schedule.batchId, rootId, CLASS_NOTES_FOLDER, userId);
    const subjectId = await ensureFolder(tx as typeof prisma, schedule.batchId, notesId, subject, userId);
    // A new upload replaces this class's earlier notes in Materials too.
    await tx.batchFolderFile.deleteMany({ where: { folderId: subjectId, title: `${schedule.title} — Notes` } });
    const file = await tx.batchFolderFile.create({
      data: {
        folderId: subjectId,
        fileAssetId: asset.id,
        title: `${schedule.title} — Notes`,
        fileName: asset.originalFilename,
        sizeBytes: Number(asset.sizeBytes),
        mimeType: "application/pdf",
        order: await tx.batchFolderFile.count({ where: { folderId: subjectId } }),
        uploadedById: userId,
      },
      select: { id: true },
    });

    let shownOn: "LECTURE" | "SESSION" | "MATERIALS_ONLY" = "MATERIALS_ONLY";
    if (schedule.lectureId) {
      await tx.lecture.update({ where: { id: schedule.lectureId }, data: { slidesUrl: openUrl } });
      shownOn = "LECTURE";
      // An earlier notes upload kept on the class session is replaced too
      // (live-class slides, stored as /access links, are left alone).
      const wb = schedule.liveWhiteboardSession;
      if (wb?.presentationUrl && /^\/api\/files\/[^/]+\/open$/.test(wb.presentationUrl)) {
        await tx.whiteboardSession.update({ where: { id: wb.id }, data: { presentationUrl: openUrl, presentationName: asset.originalFilename } });
      }
    } else if (schedule.liveWhiteboardSession) {
      await tx.whiteboardSession.update({
        where: { id: schedule.liveWhiteboardSession.id },
        data: { presentationUrl: openUrl, presentationName: asset.originalFilename, presentationType: "PDF" },
      });
      shownOn = "SESSION";
    }
    return { materialFileId: file.id, openUrl, shownOn, folder: `Class Notes → ${subject}` };
  });
}
