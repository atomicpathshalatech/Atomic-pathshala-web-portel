import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

/**
 * Catch-up playback endpoint. Same access rule as every other
 * /api/whiteboard/sessions/[id]/* route (resolveWhiteboardAccess) - anyone
 * who could join the live class can watch its recording, nobody else.
 *
 * Returns a short-lived presigned R2 GET url rather than a public one -
 * this bucket already serves protected assets the same way (see
 * createPresignedDownloadUrl's other callers) and recordings are class
 * content, not public marketing assets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) return apiError("Forbidden", 403);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        recordingStatus: true,
        recordingStorageKey: true,
        recordingDurationSeconds: true,
      },
    });

    if (!wbSession) return apiError("Session not found", 404);

    if (wbSession.recordingStatus !== "READY" || !wbSession.recordingStorageKey) {
      return apiSuccess({
        status: wbSession.recordingStatus,
        available: false,
        url: null,
        durationSeconds: null,
      });
    }

    const url = await createPresignedDownloadUrl({
      key: wbSession.recordingStorageKey,
      expiresInSeconds: 3600,
    });

    return apiSuccess({
      status: "READY",
      available: true,
      url,
      durationSeconds: wbSession.recordingDurationSeconds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
