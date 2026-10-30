import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { studentRecordedAccess } from "@/lib/recorded-lectures/access";
import { claimPlayback } from "@/lib/recorded-lectures/viewers";
import { signedPlaybackUrl } from "@/lib/recorded-lectures/storage";
import { RecordedStorageNotConfiguredError } from "@/lib/recorded-lectures/storage";

export const dynamic = "force-dynamic";

// Short: a copied video link stops working within minutes.
const URL_TTL_SECONDS = 300;

/**
 * Playback authorisation for one recorded lecture: re-checks the student's
 * enrollment, chosen-student limit and the lecture's published state on
 * EVERY request, then hands out a 5-minute signed URL to the private
 * object. The player asks again before it expires (and after an error).
 *
 * One device at a time: the request carries the device's id; starting on a
 * new device takes over, and the old device's next heartbeat
 * ({heartbeat: true}, every minute while playing) is refused, so a shared
 * login cannot watch on two devices at once.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const rate = await checkRateLimit(request, "PUBLIC", `recorded-play:${session.user.id}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found.", 404);

    const access = await studentRecordedAccess(student.id, params.id);
    if (!access.ok) {
      const message =
        access.reason === "NOT_ENROLLED"
          ? "This lecture is for students of another batch."
          : access.reason === "NOT_PUBLISHED" || access.reason === "NOT_SELECTED"
            ? "This lecture is not available right now."
            : "Lecture not found.";
      return apiError(message, access.reason === "NOT_FOUND" ? 404 : 403, { code: access.reason });
    }

    const body = (await request.json().catch(() => ({}))) as { deviceId?: unknown; heartbeat?: unknown; renew?: unknown };
    const deviceId = typeof body.deviceId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId) ? body.deviceId : null;
    if (!deviceId) return apiError("Reload the page to play this lecture.", 400, { code: "NO_DEVICE" });
    const heartbeat = body.heartbeat === true;
    // Only a fresh start (opening / Retry) takes over from another device; a heartbeat or URL renewal does not.
    const mine = await claimPlayback({ studentId: student.id, deviceId, lectureId: params.id, takeOver: !heartbeat && body.renew !== true });
    if (!mine) {
      return apiError("Your account started a lecture on another device, so it stopped here. Only one device can play at a time.", 409, { code: "OTHER_DEVICE" });
    }
    if (heartbeat) return apiSuccess({ ok: true });

    // Scheduled for this batch: nothing to play before the slot starts.
    const premiere = access.premiere;
    if (premiere?.state === "UPCOMING") {
      return apiError("This lecture starts at its scheduled time.", 403, { code: "NOT_YET", details: { startsAt: premiere.startsAt.toISOString() } });
    }

    const media = await prisma.recordedLectureMedia.findUnique({ where: { lectureId: params.id }, select: { objectKey: true, mimeType: true } });
    if (!media) return apiError("Lecture not found.", 404);
    const url = await signedPlaybackUrl(media.objectKey, URL_TTL_SECONDS);
    const res = apiSuccess({
      url,
      mimeType: media.mimeType,
      expiresInSeconds: URL_TTL_SECONDS,
      // In its slot: played like a live class (the player keeps everyone at the live point).
      live:
        premiere?.state === "LIVE"
          ? { startsAt: premiere.startsAt.toISOString(), endsAt: premiere.endsAt.toISOString(), serverNow: new Date().toISOString() }
          : null,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error) {
    if (error instanceof RecordedStorageNotConfiguredError) return apiError("Video storage is temporarily unavailable.", 503);
    return handleApiError(error);
  }
}
