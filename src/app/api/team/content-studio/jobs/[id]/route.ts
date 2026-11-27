import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { cancelStudioJob, retryStudioJob } from "@/lib/ai-studio/jobs";

const actionSchema = z.object({
  action: z.enum(["cancel", "retry"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS);

    const job = await prisma.aiGenerationJob.findUnique({
      where: { id: params.id },
    });
    if (!job) return apiError("Job not found", 404);

    const canViewCost = await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_COST_VIEW);
    return apiSuccess({
      job: canViewCost ? job : { ...job, actualCostUsd: null },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = actionSchema.parse(await req.json());
    const job =
      body.action === "cancel"
        ? await cancelStudioJob(params.id)
        : await retryStudioJob(params.id);

    if (!job) return apiError("Job not found", 404);
    const canViewCost = await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_COST_VIEW);
    return apiSuccess({
      job: canViewCost ? job : { ...job, actualCostUsd: null },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
