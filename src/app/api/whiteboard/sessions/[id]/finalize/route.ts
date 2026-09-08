import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { finalizeWhiteboardSession } from "@/lib/whiteboard/lifecycle";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

const finalizeSchema = z.object({
  networkOk: z.boolean().optional().default(true),
  audioOk: z.boolean().optional().default(true),
  videoOk: z.boolean().optional().default(true),
  whiteboardOk: z.boolean().optional().default(true),
  engagementOk: z.boolean().optional().default(true),
  issueDescription: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional().default(5),
  tags: z.array(z.string()).optional(),
});

/**
 * Finalizes live class from ENDING -> COMPLETED (Ended).
 * Persists educator technical review, finalizes student attendance,
 * and sets BatchSchedule to COMPLETED.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") {
      throw new ForbiddenError("Only authorized faculty can finalize class sessions.");
    }

    const body = await request.json().catch(() => ({}));
    const data = finalizeSchema.parse(body);

    const finalized = await finalizeWhiteboardSession(params.id, {
      userId: session.user.id,
      teacherId: access.entityId,
      feedback: {
        networkOk: data.networkOk,
        audioOk: data.audioOk,
        videoOk: data.videoOk,
        whiteboardOk: data.whiteboardOk,
        engagementOk: data.engagementOk,
        issueDescription: data.issueDescription,
        rating: data.rating,
        tags: data.tags,
      },
    });

    if (!finalized) return apiError("Whiteboard session not found", 404);

    return apiSuccess({
      message: "Class finalized successfully.",
      whiteboardSession: finalized,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
