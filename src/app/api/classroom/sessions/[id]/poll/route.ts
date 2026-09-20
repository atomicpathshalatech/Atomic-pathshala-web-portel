import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import {
  getPollForSession,
  createPollForSession,
  revealPollForSession,
  endPollForSession,
} from "@/lib/classroom/poll-store";
import {
  pushPollLaunched,
  pushPollRevealed,
  pushPollEnded,
} from "@/lib/classroom/poll-pusher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const pollActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("launch"),
    questionText: z.string().trim().default(""),
    options: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
      })
    ).min(2),
    correctOption: z.string().optional(),
    timeLimitSec: z.number().int().min(10).max(180).default(30),
  }),
  z.object({
    action: z.literal("reveal"),
    pollId: z.string().min(1),
    correctOption: z.string().optional(),
  }),
  z.object({
    action: z.literal("end"),
    pollId: z.string().min(1),
  }),
]);

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const poll = getPollForSession(params.id);
    if (!poll || poll.status === "ENDED") {
      return apiSuccess({ poll: null });
    }

    const mySelection = poll.votes[session.user.id] || null;

    // If teacher, return full counts; if student, only return counts if revealed
    const counts = access.role === "TEACHER" || poll.status === "REVEALED" ? poll.counts : undefined;
    const correctOption = access.role === "TEACHER" || poll.status === "REVEALED" ? poll.correctOption : undefined;

    return apiSuccess({
      poll: {
        id: poll.id,
        classroomSessionId: poll.classroomSessionId,
        questionText: poll.questionText,
        options: poll.options,
        correctOption,
        timeLimitSec: poll.timeLimitSec,
        status: poll.status,
        startedAt: poll.startedAt,
        totalVotes: poll.totalVotes,
        counts,
        mySelection,
      },
      role: access.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError("Only teachers can manage polls");

    const classroomSession = await prisma.classroomSession.findUnique({
      where: { id: params.id },
      select: { phase: true },
    });
    if (!classroomSession) return apiError("Classroom session not found", 404);
    if (classroomSession.phase !== "LIVE" && classroomSession.phase !== "PREPARING") {
      return apiError("Cannot launch polls outside of an active class.", 400);
    }

    const body = await request.json();
    const data = pollActionSchema.parse(body);

    if (data.action === "launch") {
      const newPoll = createPollForSession({
        classroomSessionId: params.id,
        questionText: data.questionText,
        options: data.options,
        correctOption: data.correctOption,
        timeLimitSec: data.timeLimitSec,
      });

      await pushPollLaunched(params.id, newPoll);

      return apiSuccess({ poll: newPoll });
    }

    if (data.action === "reveal") {
      const revealed = revealPollForSession({
        classroomSessionId: params.id,
        pollId: data.pollId,
        correctOption: data.correctOption,
      });
      if (!revealed) return apiError("Poll not found", 404);

      await pushPollRevealed(params.id, revealed);

      return apiSuccess({ poll: revealed });
    }

    if (data.action === "end") {
      const ended = endPollForSession({
        classroomSessionId: params.id,
        pollId: data.pollId,
      });
      if (!ended) return apiError("Poll not found", 404);

      await pushPollEnded(params.id, data.pollId);

      return apiSuccess({ success: true });
    }

    return apiError("Invalid action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
