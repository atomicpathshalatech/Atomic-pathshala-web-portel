import "server-only";
import { prisma } from "@/lib/db";
import { pusherServer, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Re-fetches the pending hand-raise queue for a session and pushes it to the
 * teacher-only channel. Called after any raise/lower/resolve so the
 * teacher's queue view always reflects current DB state — Pusher only ever
 * carries a fresh snapshot here (the queue is small), never a diff, so a
 * missed event self-heals on the next change. Shared by every route that
 * mutates hand raises, so the "how do we tell the teacher" logic lives in
 * exactly one place.
 */
export async function pushHandRaiseQueue(whiteboardSessionId: string) {
  const queue = await prisma.handRaiseEvent.findMany({
    where: { whiteboardSessionId, status: { in: ["PENDING", "APPROVED"] } },
    include: { student: { include: { user: true } } },
    orderBy: { raisedAt: "asc" },
  });

  const payload = queue.map((h) => ({
    id: h.id,
    studentId: h.studentId,
    studentName: h.student.user.name,
    requestType: h.requestType,
    status: h.status,
    liveKitGranted: h.liveKitGranted,
    raisedAt: h.raisedAt,
  }));

  try {
    await pusherServer.trigger(teacherChannel(whiteboardSessionId), WB_EVENTS.HAND_RAISE_LIST, {
      queue: payload,
    });
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }

  return payload;
}

