import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

const studentFeedbackSchema = z.object({
  understandingLevel: z.enum(["POOR", "AVERAGE", "GOOD", "EXCELLENT"]),
  contentHelpfulness: z.enum(["NOT_HELPFUL", "SOMEWHAT", "HELPFUL", "VERY_HELPFUL"]),
  doubtStatus: z.enum(["NONE", "ALL_RESOLVED", "SOME_UNRESOLVED"]),
  liked: z.boolean().default(true),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const body = await request.json();
    const data = studentFeedbackSchema.parse(body);

    const feedback = await prisma.studentClassFeedback.upsert({
      where: {
        whiteboardSessionId_studentId: {
          whiteboardSessionId: params.id,
          studentId: access.entityId,
        },
      },
      create: {
        whiteboardSessionId: params.id,
        studentId: access.entityId,
        understandingLevel: data.understandingLevel,
        contentHelpfulness: data.contentHelpfulness,
        doubtStatus: data.doubtStatus,
        liked: data.liked,
        rating: data.rating,
        comment: data.comment,
      },
      update: {
        understandingLevel: data.understandingLevel,
        contentHelpfulness: data.contentHelpfulness,
        doubtStatus: data.doubtStatus,
        liked: data.liked,
        rating: data.rating,
        comment: data.comment,
      },
    });

    return apiSuccess({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
