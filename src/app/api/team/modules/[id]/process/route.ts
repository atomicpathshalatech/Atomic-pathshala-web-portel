import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { moduleProcessSchema } from "@/lib/validation/module";
import {
  startExtractionJob,
  getJobStatus,
  getJobReport,
  cancelJob,
  continueExtractionJob,
  retryFailedPages,
  submitOcrPage,
  ExtractionConflictError,
} from "@/lib/module-studio/extraction-job-service";

export const dynamic = "force-dynamic";
// Each call processes one slice of pages (about 45 s at most) — see extraction-job-service.ts.
export const maxDuration = 120;

const box = z.object({ x: z.number(), y: z.number(), w: z.number().min(0), h: z.number().min(0) });
const ocrPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  confidence: z.number().min(0).max(100),
  width: z.number().positive(),
  height: z.number().positive(),
  lines: z.array(z.object({ text: z.string().max(4000), bbox: box, confidence: z.number().min(0).max(100) })).max(3000),
});

/**
 * GET  /api/team/modules/[id]/process           → live status of the latest import job
 * GET  /api/team/modules/[id]/process?report=1  → the full import report (downloadable JSON)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    if (request.nextUrl.searchParams.get("report")) {
      const report = await getJobReport(params.id);
      if (!report) return apiError("This module has not been imported yet.", 404);
      return new NextResponse(JSON.stringify(report, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-report-${params.id}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const status = await getJobStatus(params.id);
    if (!status) return apiSuccess({ status: null, isProcessing: false });
    return apiSuccess({ job: status, isProcessing: status.status === "processing" || status.status === "queued" });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/modules/[id]/process                     → start an import (first slice runs now)
 * POST ...?action=continue                                → next slice
 * POST ...?action=retry                                   → re-run the failed pages
 * POST ...?action=ocr-page   { pageNumber, lines, … }     → OCR result of one scanned page (from the browser)
 * POST ...?action=cancel                                  → stop
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const action = request.nextUrl.searchParams.get("action");
    if (action === "cancel") {
      return apiSuccess({ cancelled: await cancelJob(params.id) });
    }
    if (action === "continue") {
      const slice = await continueExtractionJob(params.id, session.user.id);
      return apiSuccess({ slice, done: !slice || slice.done });
    }
    if (action === "retry") {
      const slice = await retryFailedPages(params.id, session.user.id);
      if (!slice) return apiError("This module has not been imported yet.", 404);
      return apiSuccess({ slice, done: slice.done });
    }
    if (action === "ocr-page") {
      const input = ocrPageSchema.parse(await request.json());
      return apiSuccess(await submitOcrPage(params.id, session.user.id, input));
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
          ? "Existing extraction of this exact PDF reused."
          : result.slice?.done
          ? "Extraction finished."
          : `Extracted ${result.slice?.completedPages ?? 0} of ${result.slice?.totalPages ?? 0} pages — continuing.`,
      },
      202
    );
  } catch (error) {
    if (error instanceof ExtractionConflictError) {
      return apiError(error.message, 409, { code: "EXTRACTION_ALREADY_RUNNING", details: { jobId: error.jobId } });
    }
    return handleApiError(error);
  }
}
