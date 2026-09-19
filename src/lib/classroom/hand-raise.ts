import "server-only";
import { prisma } from "@/lib/db";
import { pusherServer, classroomTeacherChannel, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Classroom equivalent of src/lib/whiteboard/hand-raise.ts's
 * pushHandRaiseQueue — re-fetches the pending queue and pushes a fresh
 * snapshot to both the teacher-only channel and the session channel.
 * Deliberately a separate function/table (ClassroomHandRaise, not
 * HandRaiseEvent) so Whiteboard's hand-raise flow is never touched.
 */
export async function pushClassroomHandRaiseQueue(classroomSessionId: string) {
  const queue = await prisma.classroomHandRaise.findMany({
    where: { classroomSessionId, status: { in: ["PENDING", "APPROVED"] } },
    include: { student: { include: { user: true } } },
    orderBy: { raisedAt: "asc" },
  });

  const payload = queue.map((h) => ({
    id: h.id,
    studentId: h.studentId,
    studentName: h.student.user.name,
    requestType: h.requestType,
    status: h.status,
    raisedAt: h.raisedAt,
    imageUrl: h.imageUrl,
  }));

  try {
    await Promise.all([
      pusherServer.trigger(classroomTeacherChannel(classroomSessionId), CLASSROOM_EVENTS.HAND_RAISE_LIST, {
        queue: payload,
      }),
      pusherServer.trigger(classroomChannel(classroomSessionId), CLASSROOM_EVENTS.HAND_RAISE_UPDATED, {
        queue: payload,
      }),
    ]);
  } catch (err) {
    console.error("[classroom_pusher_trigger_error]", err);
  }

  return payload;
}
