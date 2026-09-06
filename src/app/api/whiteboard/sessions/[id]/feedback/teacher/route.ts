import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

const teacherFeedbackSchema = z.object({
  networkOk: z.boolean().default(true),
  audioOk: z.boolean().default(true),
  videoOk: z.boolean().default(true),
  whiteboardOk: z.boolean().default(true),
  engagementOk: z.boolean().default(true),
  issueDescription: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const body = await request.json();
    const data = teacherFeedbackSchema.parse(body);

    const feedback = await prisma.teacherClassFeedback.upsert({
      where: { whiteboardSessionId: params.id },
      create: {
        whiteboardSessionId: params.id,
        teacherId: access.entityId,
        networkOk: data.networkOk,
        audioOk: data.audioOk,
        videoOk: data.videoOk,
        whiteboardOk: data.whiteboardOk,
        engagementOk: data.engagementOk,
        issueDescription: data.issueDescription,
        rating: data.rating,
      },
      update: {
        networkOk: data.networkOk,
        audioOk: data.audioOk,
        videoOk: data.videoOk,
        whiteboardOk: data.whiteboardOk,
        engagementOk: data.engagementOk,
        issueDescription: data.issueDescription,
        rating: data.rating,
      },
    });

    return apiSuccess({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
