import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveTeacherForSchedule, toScheduleAccessTarget } from "@/lib/classroom/access";
import { canTeacherStartClass } from "@/lib/schedule/access-rules";
import { ensureYoutubeBroadcast, youtubeClassroomConfigured } from "@/lib/classroom/youtube-broadcast";
import { createRelayPathForSession, mediaRelayConfigured } from "@/lib/classroom/media-relay";

const startSchema = z.object({
  streamMethod: z.enum(["BROWSER_RELAY", "EXTERNAL_ENCODER"]),
});

/**
 * Configures (idempotently) the classroom for a scheduled lecture: creates
 * the ClassroomSession row if needed, creates/reuses its YouTube broadcast,
 * and — only for BROWSER_RELAY — registers a path on the self-hosted relay.
 * This does NOT go live yet (phase becomes PREPARING); the teacher's
 * "Go Live" action (.../go-live) is the actual LIVE transition, once their
 * camera (relay) or encoder (OBS) is confirmed publishing.
 */
export async function POST(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const { streamMethod } = startSchema.parse(await request.json());

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CLASSROOM_ACCESS);

    if (streamMethod === "BROWSER_RELAY" && !mediaRelayConfigured()) {
      return apiError("The in-browser streaming relay isn't configured yet — use the OBS/encoder method instead.", 503);
    }
    if (!youtubeClassroomConfigured()) {
      return apiError("YouTube isn't configured for Classroom yet.", 503);
    }

    const { schedule, teacher } = await resolveTeacherForSchedule(session.user.id, params.scheduleId);
    if (!schedule) return apiError("Scheduled class not found", 404);
    if (!teacher) throw new ForbiddenError("You are not authorized to start this classroom.");
    if (schedule.type !== "LIVE_CLASS") return apiError("Only Live Class sessions can use Classroom.", 400);

    const now = new Date();
    const existing = await prisma.classroomSession.findUnique({ where: { batchScheduleId: params.scheduleId } });
    const evaluation = canTeacherStartClass(toScheduleAccessTarget(schedule, existing), now);
    if (!evaluation.allowed) {
      return apiError(evaluation.reason || "Start is not available yet.", 403, { code: evaluation.code });
    }

    let classroomSession =
      existing ??
      (await prisma.classroomSession.create({
        data: {
          batchScheduleId: schedule.id,
          teacherId: teacher.id,
          title: schedule.title,
          phase: "PREPARING",
          streamMethod,
        },
      }));

    if (existing && existing.streamMethod !== streamMethod && !existing.youtubeBroadcastId) {
      // Method can still be changed as long as no broadcast has been created yet.
      classroomSession = await prisma.classroomSession.update({
        where: { id: classroomSession.id },
        data: { streamMethod },
      });
    }

    classroomSession = await ensureYoutubeBroadcast(classroomSession.id, schedule.title, new Date(schedule.startsAt));

    if (streamMethod === "BROWSER_RELAY" && !classroomSession.relayPath) {
      const relay = await createRelayPathForSession(
        classroomSession.id,
        classroomSession.youtubeIngestUrl!,
        classroomSession.youtubeStreamKey!
      );
      classroomSession = await prisma.classroomSession.update({
        where: { id: classroomSession.id },
        data: { relayPath: relay.relayPath, relayWhipUrl: relay.whipUrl },
      });
    }

    if (classroomSession.phase === "SCHEDULED") {
      classroomSession = await prisma.classroomSession.update({
        where: { id: classroomSession.id },
        data: { phase: "PREPARING" },
      });
    }

    return apiSuccess({
      classroomSession: {
        id: classroomSession.id,
        phase: classroomSession.phase,
        streamMethod: classroomSession.streamMethod,
        relayWhipUrl: classroomSession.relayWhipUrl,
        youtubeIngestUrl: classroomSession.youtubeIngestUrl,
        youtubeStreamKey: classroomSession.youtubeStreamKey,
        youtubeVideoId: classroomSession.youtubeVideoId,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
