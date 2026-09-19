import "server-only";
import { pusherServer, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";

export type ClassroomMessagePayload = {
  id: string;
  authorRole: "TEACHER" | "STUDENT";
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

/** Classroom equivalent of src/lib/whiteboard/messages.ts's pushMessage — sends the actual message, not a re-fetch signal. */
export async function pushClassroomMessage(classroomSessionId: string, message: ClassroomMessagePayload) {
  try {
    await pusherServer.trigger(classroomChannel(classroomSessionId), CLASSROOM_EVENTS.MESSAGE_SENT, message);
  } catch (err) {
    console.error("[classroom_pusher_trigger_error]", err);
  }
}

export async function pushClassroomMessagePinned(classroomSessionId: string, messageId: string, pinnedAt: string | null) {
  try {
    await pusherServer.trigger(classroomChannel(classroomSessionId), CLASSROOM_EVENTS.MESSAGE_PINNED, {
      id: messageId,
      pinnedAt,
    });
  } catch (err) {
    console.error("[classroom_pusher_trigger_error]", err);
  }
}
