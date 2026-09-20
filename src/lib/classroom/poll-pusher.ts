import "server-only";
import {
  pusherServer,
  classroomChannel,
  classroomTeacherChannel,
  CLASSROOM_EVENTS,
} from "@/lib/realtime/pusher-server";
import type { ClassroomPollState } from "./poll-store";

export async function pushPollLaunched(classroomSessionId: string, poll: ClassroomPollState) {
  try {
    // Send to students without leaking votes or correctOption if unrevealed
    await pusherServer.trigger(
      classroomChannel(classroomSessionId),
      CLASSROOM_EVENTS.POLL_LAUNCHED,
      {
        id: poll.id,
        classroomSessionId: poll.classroomSessionId,
        questionText: poll.questionText,
        options: poll.options,
        timeLimitSec: poll.timeLimitSec,
        startedAt: poll.startedAt,
        status: poll.status,
      }
    );
  } catch (err) {
    console.error("[pushPollLaunched error]", err);
  }
}

export async function pushPollVoted(classroomSessionId: string, poll: ClassroomPollState) {
  try {
    // Live counts are pushed to the teacher channel so teacher can see incoming metrics
    await pusherServer.trigger(
      classroomTeacherChannel(classroomSessionId),
      CLASSROOM_EVENTS.POLL_VOTED,
      {
        pollId: poll.id,
        counts: poll.counts,
        totalVotes: poll.totalVotes,
      }
    );
  } catch (err) {
    console.error("[pushPollVoted error]", err);
  }
}

export async function pushPollRevealed(classroomSessionId: string, poll: ClassroomPollState) {
  try {
    await pusherServer.trigger(
      classroomChannel(classroomSessionId),
      CLASSROOM_EVENTS.POLL_REVEALED,
      {
        id: poll.id,
        classroomSessionId: poll.classroomSessionId,
        correctOption: poll.correctOption,
        counts: poll.counts,
        totalVotes: poll.totalVotes,
        status: "REVEALED",
      }
    );
  } catch (err) {
    console.error("[pushPollRevealed error]", err);
  }
}

export async function pushPollEnded(classroomSessionId: string, pollId: string) {
  try {
    await pusherServer.trigger(
      classroomChannel(classroomSessionId),
      CLASSROOM_EVENTS.POLL_ENDED,
      {
        id: pollId,
        classroomSessionId,
      }
    );
  } catch (err) {
    console.error("[pushPollEnded error]", err);
  }
}
