import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveBatchAccess } from "@/lib/batch/entitlement";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { reconcileRecordingStatus } from "@/lib/livekit/egress";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

/**
 * Resolves original uploaded presentation download URL
 */
async function resolveOriginalDownloadUrl(
  urlOrKey: string,
  fallbackFilename: string
): Promise<string> {
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

  try {
    const parsed = new URL(urlOrKey);
    const pathnameKey = parsed.pathname.replace(/^\/+/, "");
    if (
      pathnameKey &&
      (pathnameKey.startsWith("modules/") ||
        pathnameKey.startsWith("documents/") ||
        pathnameKey.startsWith("classes/"))
    ) {
      return createPresignedDownloadUrl({
        key: pathnameKey,
        expiresInSeconds: 900,
        contentDisposition: `attachment; filename="${encodeURIComponent(fallbackFilename)}"`,
      });
    }
  } catch {
    // URL parse fallback
  }

  return urlOrKey;
}

/**
 * Authoritative Class Asset Access Endpoint.
 * Given a BatchSchedule ID:
 * 1. Checks user authentication & entitlement (batch enrollment or teacher assignment).
 * 2. Fetches canonical schedule & whiteboard session.
 * 3. Reconciles recording & PDF processing status.
 * 4. Generates authenticated, presigned playback and download URLs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized. Please log in.", 401);
    }

    const { scheduleId } = params;
    if (!scheduleId) {
      return apiError("Missing scheduleId parameter", 400);
    }

    // 1. Fetch the canonical BatchSchedule
    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        batch: {
          select: { id: true, name: true, code: true },
        },
        teacher: {
          include: {
            user: { select: { id: true, name: true, photoUrl: true, email: true } },
          },
        },
        lecture: {
          select: { id: true, videoUrl: true, slidesUrl: true },
        },
        liveWhiteboardSession: {
          include: {
            pages: { select: { id: true } },
          },
        },
      },
    });

    if (!schedule) {
      return apiError("Class schedule not found", 404);
    }

    // 2. Strict Entitlement & Access Control
    const userId = session.user.id;
    let isAuthorized = false;

    // Check if Teacher / Admin
    const teacherProfile = await prisma.teacher.findUnique({ where: { userId } });
    if (teacherProfile) {
      if (schedule.teacherId === teacherProfile.id) {
        isAuthorized = true;
      } else {
        const batchTeacher = await prisma.batchTeacher.findFirst({
          where: { batchId: schedule.batchId, teacherId: teacherProfile.id },
        });
        if (batchTeacher) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const canAdmin = await hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
      if (canAdmin) isAuthorized = true;
    }

    // Check if Student Enrolled
    if (!isAuthorized) {
      const studentAccess = await resolveBatchAccess(userId, schedule.batchId);
      if (
        studentAccess.status === "ACTIVE_ENROLLMENT" ||
        studentAccess.status === "ACTIVE_SUBSCRIPTION" ||
        studentAccess.status === "ADMIN_GRANTED"
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError("Forbidden: You are not authorized to access this class's assets.", 403);
    }

    // 3. Resolve Recording Asset
    let wbSession = schedule.liveWhiteboardSession;

    // Self-heal recording if active / processing
    if (wbSession?.recordingEgressId && wbSession.recordingStatus !== "READY" && wbSession.recordingStatus !== "FAILED") {
      const reconciled = await reconcileRecordingStatus({
        id: wbSession.id,
        recordingStatus: wbSession.recordingStatus,
        recordingEgressId: wbSession.recordingEgressId,
      });
      if (reconciled) {
        wbSession = { ...wbSession, ...reconciled };
      }
    }

    let recordingStatus: "READY" | "PROCESSING" | "FAILED" | "NONE" = "NONE";
    let recordingUrl: string | null = null;
    let recordingType: "VIDEO" | "YOUTUBE" = "VIDEO";
    let durationSeconds: number | null = wbSession?.recordingDurationSeconds || null;

    if (wbSession) {
      const isArchivedYoutube =
        wbSession.youtubeArchiveStatus === "COMPLETED" && Boolean(wbSession.youtubeArchiveVideoUrl);
      const isDirectR2Ready =
        wbSession.recordingStatus === "READY" && Boolean(wbSession.recordingStorageKey);
      const isDirectYoutube = Boolean(wbSession.youtubeVideoId);

      if (isArchivedYoutube) {
        recordingStatus = "READY";
        recordingUrl = wbSession.youtubeArchiveVideoUrl;
        recordingType = "YOUTUBE";
      } else if (isDirectR2Ready && wbSession.recordingStorageKey) {
        recordingStatus = "READY";
        recordingUrl = await createPresignedDownloadUrl({
          key: wbSession.recordingStorageKey,
          expiresInSeconds: 7200, // 2-hour playback window
        });
        recordingType = "VIDEO";
      } else if (isDirectYoutube) {
        recordingStatus = "READY";
        recordingUrl = `https://www.youtube.com/watch?v=${wbSession.youtubeVideoId}`;
        recordingType = "YOUTUBE";
      } else if (
        wbSession.recordingStatus === "RECORDING" ||
        wbSession.recordingStatus === "STARTING" ||
        wbSession.recordingStatus === "PROCESSING" ||
        wbSession.recordingStatus === "STOPPING"
      ) {
        recordingStatus = "PROCESSING";
      } else if (wbSession.recordingStatus === "FAILED") {
        recordingStatus = "FAILED";
      } else if (schedule.lecture?.videoUrl) {
        recordingStatus = "READY";
        recordingUrl = schedule.lecture.videoUrl;
        recordingType = schedule.lecture.videoUrl.includes("youtube.com") || schedule.lecture.videoUrl.includes("youtu.be") ? "YOUTUBE" : "VIDEO";
      }
    } else if (schedule.lecture?.videoUrl) {
      recordingStatus = "READY";
      recordingUrl = schedule.lecture.videoUrl;
      recordingType = schedule.lecture.videoUrl.includes("youtube.com") || schedule.lecture.videoUrl.includes("youtu.be") ? "YOUTUBE" : "VIDEO";
    }

    // 4. Resolve Notes & PDF Asset
    let notesStatus: "READY" | "PROCESSING" | "UNAVAILABLE" = "UNAVAILABLE";
    let notesDownloadUrl: string | null = null;
    let notesFilename: string | null = null;
    let hasOriginalSlides = false;
    let originalDownloadUrl: string | null = null;
    let originalFilename: string | null = null;

    if (wbSession) {
      // Check original presentation uploaded before/during class
      const presUrl = wbSession.presentationUrl;
      if (presUrl) {
        hasOriginalSlides = true;
        originalFilename =
          wbSession.presentationName || `${schedule.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Presentation.pdf`;
        originalDownloadUrl = await resolveOriginalDownloadUrl(
          presUrl,
          originalFilename
        );
      }

      // Check annotated PDF export
      let activePdfKey = wbSession.pdfStorageKey;
      if (!activePdfKey || wbSession.pdfStatus !== "READY") {
        // If class has completed and has pages, attempt on-demand generation
        if (wbSession.pages.length > 0 && wbSession.status === "ENDED") {
          const { finalizeWhiteboardSlides } = await import("@/lib/whiteboard/finalization");
          await finalizeWhiteboardSlides(wbSession.id).catch((err) =>
            console.warn("[on_demand_finalize_error]", err)
          );

          const refreshed = await prisma.whiteboardSession.findUnique({
            where: { id: wbSession.id },
            select: { pdfStorageKey: true, pdfStatus: true },
          });

          if (refreshed?.pdfStorageKey) {
            activePdfKey = refreshed.pdfStorageKey;
            wbSession.pdfStatus = refreshed.pdfStatus;
          }
        }
      }

      if (activePdfKey && wbSession.pdfStatus === "READY") {
        notesStatus = "READY";
        notesFilename = `${schedule.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Notes.pdf`;
        notesDownloadUrl = await createPresignedDownloadUrl({
          key: activePdfKey,
          expiresInSeconds: 3600,
          contentDisposition: `attachment; filename="${encodeURIComponent(notesFilename)}"`,
        });
      } else if (wbSession.pdfStatus === "GENERATING") {
        notesStatus = "PROCESSING";
      } else if (hasOriginalSlides && originalDownloadUrl) {
        // Fallback: If annotated export is not available, original slides serve as class notes
        notesStatus = "READY";
        notesDownloadUrl = originalDownloadUrl;
        notesFilename = originalFilename;
      } else if (schedule.lecture?.slidesUrl) {
        notesStatus = "READY";
        notesDownloadUrl = schedule.lecture.slidesUrl;
        notesFilename = `${schedule.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Notes.pdf`;
      }
    } else if (schedule.lecture?.slidesUrl) {
      notesStatus = "READY";
      notesDownloadUrl = schedule.lecture.slidesUrl;
      notesFilename = `${schedule.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Notes.pdf`;
    }

    return apiSuccess({
      scheduleId: schedule.id,
      sessionId: wbSession?.id || null,
      title: schedule.title,
      subject: schedule.subject,
      batchId: schedule.batchId,
      batchName: schedule.batch.name,
      teacherName: schedule.teacher?.user?.name || "Atomic Faculty",
      teacherImage: schedule.teacher?.user?.photoUrl || null,
      startsAt: schedule.startsAt.toISOString(),
      endsAt: schedule.endsAt.toISOString(),
      status: schedule.status,
      recording: {
        status: recordingStatus,
        url: recordingUrl,
        durationSeconds,
        type: recordingType,
      },
      notes: {
        status: notesStatus,
        downloadUrl: notesDownloadUrl,
        filename: notesFilename,
        hasOriginalSlides,
        originalDownloadUrl,
        originalFilename,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
