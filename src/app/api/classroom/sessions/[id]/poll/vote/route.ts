import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { recordPollVote } from "@/lib/classroom/poll-store";
import { pushPollVoted } from "@/lib/classroom/poll-pusher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const voteSchema = z.object({
  pollId: z.string().min(1),
  selectedOption: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const body = await request.json();
    const { pollId, selectedOption } = voteSchema.parse(body);

    const result = recordPollVote({
      classroomSessionId: params.id,
      pollId,
      userId: session.user.id,
      selectedOption,
    });

    if (!result) {
      return apiError("Poll not found, expired, or invalid option", 400);
    }

    if (result.isNewVote) {
      // Fire-and-forget push to teacher channel so teacher sees real-time metrics update
      void pushPollVoted(params.id, result.poll);
    }

    return apiSuccess({
      success: true,
      mySelection: selectedOption,
      totalVotes: result.poll.totalVotes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
