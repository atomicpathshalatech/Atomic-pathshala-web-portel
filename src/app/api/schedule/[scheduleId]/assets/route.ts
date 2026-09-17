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
import { resolveOriginalDownloadUrl } from "@/lib/whiteboard/original-download-url";

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
        originalFilename =
          wbSession.presentationName || `${schedule.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Presentation.pdf`;
        try {
          originalDownloadUrl = await resolveOriginalDownloadUrl(presUrl, originalFilename);
          hasOriginalSlides = true;
        } catch (err) {
          // A stale "blob:" URL (an old session predating the current
          // upload pipeline) - resolveOriginalDownloadUrl throws rather
          // than returning a dead link the browser can't open. Surface
          // this as "no original slides" instead of failing the whole
          // assets request.
          console.warn("[schedule_assets_original_slides_error]", err);
          originalFilename = null;
        }
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
        // "inline" (not "attachment") — matches the whiteboard slides
        // route's own format=pdf behavior (slides/route.ts:173). A
        // student previously had no way to VIEW this PDF at all, only
        // force-download it; inline disposition opens it in the
        // browser's native PDF viewer, which still offers its own save
        // button, so downloading is still possible from there.
        notesDownloadUrl = await createPresignedDownloadUrl({
          key: activePdfKey,
          expiresInSeconds: 3600,
          contentDisposition: `inline; filename="${encodeURIComponent(notesFilename)}"`,
        });
      } else if (wbSession.pdfStatus === "GENERATING") {
        notesStatus = "PROCESSING";
      } else if (hasOriginalSlides && originalDownloadUrl) {
        // Fallback: If annotated export is not available, original slides serve as class notes
        notesStatus = "READY";
        notesDownloadUrl = originalDownloadUrl;
        notesFilename = originalFilename;
      }
      // NOTE: previously also fell back to schedule.lecture.slidesUrl here
      // when neither the annotated export nor the original slides were
      // available. That field is set by finalizeWhiteboardSlides to an
      // internal API path ("/api/whiteboard/sessions/<id>/slides?format=pdf")
      // that returns JSON ({success, data:{downloadUrl}}), not PDF bytes -
      // handing it to the browser as a direct <a href> made the student's
      // download show raw JSON text instead of a file. By this point the
      // real annotated-PDF resolution above (activePdfKey/pdfStatus) has
      // already been attempted and genuinely failed, so there's nothing
      // real to link to; notesStatus correctly falls through to
      // UNAVAILABLE below instead of promising a broken link.
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
