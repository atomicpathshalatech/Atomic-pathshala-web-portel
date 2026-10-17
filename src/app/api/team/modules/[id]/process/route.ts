import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { moduleProcessSchema } from "@/lib/validation/module";
import { startExtractionJob, getJobStatus, cancelJob, continueExtractionJob } from "@/lib/module-studio/extraction-job-service";

export const dynamic = "force-dynamic";
// Each call processes one slice of pages (about 45 s at most) — see extraction-job-service.ts.
export const maxDuration = 120;

/**
 * GET /api/team/modules/[id]/process
 * Returns real-time extraction job status, progress %, and page matrix.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const status = await getJobStatus(params.id);
    if (!status) {
      return apiSuccess({ status: null, isProcessing: false });
    }

    return apiSuccess({
      job: status,
      isProcessing: status.stage !== "READY_FOR_REVIEW" && status.stage !== "FAILED" && !status.finishedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/modules/[id]/process
 * Starts or resumes non-blocking asynchronous extraction job.
 * Returns immediately with jobId and initial status.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const action = request.nextUrl.searchParams.get("action");
    if (action === "cancel") {
      const cancelled = await cancelJob(params.id);
      return apiSuccess({ cancelled });
    }
    if (action === "continue") {
      const slice = await continueExtractionJob(params.id, session.user.id);
      return apiSuccess({ slice, done: !slice || slice.done });
    }

    const options = moduleProcessSchema.parse(await request.json().catch(() => ({})));

    const result = await startExtractionJob(params.id, session.user.id, options);

    return apiSuccess(
      {
        jobId: result.jobId,
        status: result.status,
        totalPages: result.totalPages,
        isCached: result.isCached,
        slice: result.slice ?? null,
        done: result.isCached || Boolean(result.slice?.done),
        message: result.isCached
          ? "Existing high-fidelity extraction found and instantly applied from cache."
          : result.slice?.done
          ? "Extraction finished."
          : `Extracted ${result.slice?.completedPages ?? 0} of ${result.slice?.totalPages ?? 0} pages — continuing.`,
      },
      202
    );
  } catch (error) {
    return handleApiError(error);
  }
}
