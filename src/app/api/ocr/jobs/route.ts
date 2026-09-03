import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { executeOcrPipeline } from "@/lib/ocr/provider";

// In-memory async jobs cache (for demonstration and job polling)
const ocrJobs = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { imageBase64, mimeType, solutionImageBase64 } = body;

    if (!imageBase64) {
      return apiError("imageBase64 is required.", 400);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    ocrJobs.set(jobId, {
      jobId,
      status: "processing",
      progress: 25,
      currentStage: "Analyzing document layout...",
      createdAt: new Date().toISOString(),
    });

    // Execute in background
    executeOcrPipeline({
      imageBase64,
      mimeType: mimeType || "image/png",
      solutionImageBase64,
    })
      .then(({ document, question }) => {
        ocrJobs.set(jobId, {
          jobId,
          status: "completed",
          progress: 100,
          currentStage: "Extraction complete.",
          document,
          question,
          completedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        ocrJobs.set(jobId, {
          jobId,
          status: "failed",
          progress: 0,
          currentStage: "Failed",
          error: err?.message || "OCR extraction failed.",
          completedAt: new Date().toISOString(),
        });
      });

    return apiSuccess({ jobId, status: "queued" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) return apiError("jobId is required", 400);

    const job = ocrJobs.get(jobId);
    if (!job) return apiError("Job not found", 404);

    return apiSuccess({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
