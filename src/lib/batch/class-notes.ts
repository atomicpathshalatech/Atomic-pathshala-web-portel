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

const OPEN_LINK = /^\/api\/files\/([^/]+)\/open$/;

/**
 * The notes PDF a teacher uploaded for this class, if any — the one PDF
 * students get with the class. Uploaded notes are stored as
 * /api/files/<id>/open on the chapter lecture (any upload) or on the class
 * session (only a NOTES file: the session's link can also be the slides PDF
 * prepared before class, which is not notes). The newest upload wins.
 * Null: no uploaded notes — the board PDF made from the whiteboard is used.
 */
export async function currentClassNotes(args: { lectureSlidesUrl?: string | null; sessionPresentationUrl?: string | null }) {
  const ids = new Map<string, "LECTURE" | "SESSION">();
  const fromLecture = args.lectureSlidesUrl?.match(OPEN_LINK)?.[1];
  const fromSession = args.sessionPresentationUrl?.match(OPEN_LINK)?.[1];
  if (fromLecture) ids.set(fromLecture, "LECTURE");
  if (fromSession && !ids.has(fromSession)) ids.set(fromSession, "SESSION");
  if (ids.size === 0) return null;
  const assets = await prisma.fileAsset.findMany({
    where: { id: { in: [...ids.keys()] }, status: "ACTIVE" },
    select: { id: true, fileType: true, originalFilename: true, storageKey: true, createdAt: true },
  });
  const usable = assets
    .filter((a) => ids.get(a.id) === "LECTURE" || a.fileType === "NOTES")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pick = usable[0];
  return pick ? { fileAssetId: pick.id, url: `/api/files/${pick.id}/open`, filename: pick.originalFilename, storageKey: pick.storageKey } : null;
}

/** Every notes upload for a class, newest first, with what each one replaced (staff only). */
export async function classNotesHistory(scheduleId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { action: "CLASS_NOTES_ATTACHED", entityType: "BatchSchedule", entityId: scheduleId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { createdAt: true, metadata: true, user: { select: { name: true } } },
  });
  return logs.map((l) => {
    const m = (l.metadata ?? {}) as Record<string, unknown>;
    return {
      at: l.createdAt.toISOString(),
      by: l.user?.name ?? null,
      fileAssetId: String(m.fileAssetId ?? ""),
      fileName: String(m.fileName ?? ""),
      url: m.fileAssetId ? `/api/files/${m.fileAssetId}/open` : null,
      replaced: (m.replaced ?? null) as { fileName?: string | null; url?: string | null } | null,
    };
  });
}

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
      lecture: { select: { slidesUrl: true } },
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

  // What students see now — recorded as "replaced" so the earlier PDF can be found again.
  const previous = await currentClassNotes({ lectureSlidesUrl: schedule.lecture?.slidesUrl, sessionPresentationUrl: schedule.liveWhiteboardSession?.presentationUrl });

  return prisma.$transaction(async (tx) => {
    const rootId = await ensureFolder(tx as typeof prisma, schedule.batchId, null, ROOT_FOLDER_NAME, userId);
    const notesId = await ensureFolder(tx as typeof prisma, schedule.batchId, rootId, CLASS_NOTES_FOLDER, userId);
    const subjectId = await ensureFolder(tx as typeof prisma, schedule.batchId, notesId, subject, userId);
    // A new upload replaces this class's earlier notes in Materials too. The
    // earlier entry is kept (hidden from students, marked as replaced) so the
    // old PDF can still be checked or brought back.
    const stamp = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
    const older = await tx.batchFolderFile.findMany({ where: { folderId: subjectId, title: `${schedule.title} — Notes` }, select: { id: true } });
    for (const o of older) {
      await tx.batchFolderFile.update({ where: { id: o.id }, data: { isPublished: false, title: `${schedule.title} — Notes (replaced ${stamp})` } });
    }
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
    await tx.auditLog.create({
      data: {
        userId,
        action: "CLASS_NOTES_ATTACHED",
        entityType: "BatchSchedule",
        entityId: schedule.id,
        metadata: {
          fileAssetId: asset.id,
          fileName: asset.originalFilename,
          shownOn,
          replaced: previous ? { fileAssetId: previous.fileAssetId, fileName: previous.filename, url: previous.url } : null,
          // The class's slides link before this upload (it is overwritten when the class has no chapter lecture).
          previousSessionPresentationUrl: schedule.liveWhiteboardSession?.presentationUrl ?? null,
          hiddenMaterialFiles: older.map((o) => o.id),
        },
      },
    });
    return { materialFileId: file.id, openUrl, shownOn, folder: `Class Notes → ${subject}` };
  });
}
