import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { reconcileRecordingStatus } from "@/lib/livekit/egress";

/**
 * Catch-up recording playback & metadata endpoint.
 * Strict RBAC: Only authorized teachers, academic admins, and enrolled batch students
 * can access live class recordings.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) return apiError("Forbidden: You are not authorized to view this recording.", 403);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        batchScheduleId: true,
        teacherId: true,
        recordingStatus: true,
        recordingStorageKey: true,
        recordingDurationSeconds: true,
        recordingEgressId: true,
        actualStartedAt: true,
        startedAt: true,
        actualEndedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });

    if (!wbSession) return apiError("Live class session not found", 404);

    // Self-heal a missed egress_ended webhook via LiveKit reconciliation
    const reconciled = await reconcileRecordingStatus({
      id: params.id,
      recordingStatus: wbSession.recordingStatus,
      recordingEgressId: wbSession.recordingEgressId,
    });
    const effective = reconciled
      ? { ...wbSession, ...reconciled }
      : wbSession;

    // Look up FileAsset if storageKey exists
    let fileAsset = null;
    if (effective.recordingStorageKey) {
      fileAsset = await prisma.fileAsset.findUnique({
        where: { storageKey: effective.recordingStorageKey },
      });
    }

    const isReady = effective.recordingStatus === "READY" && Boolean(effective.recordingStorageKey);

    let presignedUrl: string | null = null;
    if (isReady && effective.recordingStorageKey) {
      presignedUrl = await createPresignedDownloadUrl({
        key: effective.recordingStorageKey,
        expiresInSeconds: 3600, // 1 hour private playback token
      });
    }

    return apiSuccess({
      recordingId: fileAsset?.id || effective.id,
      classId: effective.batchScheduleId,
      liveSessionId: effective.id,
      providerRecordingId: effective.recordingEgressId || null,
      status: effective.recordingStatus,
      available: isReady,
      url: presignedUrl,
      startedAt: effective.actualStartedAt || effective.startedAt,
      stoppedAt: effective.actualEndedAt || effective.endedAt,
      durationSeconds: effective.recordingDurationSeconds || null,
      storagePath: effective.recordingStorageKey || null,
      resourceId: fileAsset?.id || null,
      createdAt: effective.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

