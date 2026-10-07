import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { processChunkForJob, type JobChunkPlan } from "@/lib/extraction/chunk-pipeline";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const job = await prisma.extractionJob.findUnique({ where: { id: params.id } });
    if (!job) return apiError("Extraction job not found", 404);

    const report = (job.reportJson as any) || {};
    const chunkPlan = (report.chunkPlan as JobChunkPlan) || null;

    if (!chunkPlan) {
      return apiError("No chunk plan found for this job. Please resume extraction.", 400);
    }

    // Find all failed chunks and mark them pending for retry
    const failedChunks = chunkPlan.chunks.filter((c) => c.status === "FAILED");
    if (!failedChunks.length) {
      return apiSuccess({ message: "No failed chunks to retry", retriedCount: 0 });
    }

    for (const c of failedChunks) {
      c.status = "PENDING";
      c.error = undefined;
    }
    chunkPlan.failedChunks = 0;
    report.chunkPlan = chunkPlan;

    await prisma.extractionJob.update({
      where: { id: params.id },
      data: {
        status: "PROCESSING",
        currentStep: `Retrying ${failedChunks.length} failed chunk(s)...`,
        reportJson: report,
      },
    });

    // Execute first failed chunk immediately
    const firstFailed = failedChunks[0]!;
    const res = await processChunkForJob(params.id, firstFailed.index);

    return apiSuccess({
      message: `Retrying failed chunks (${failedChunks.length} queued)`,
      firstResult: res,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
