import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile } from "@/lib/storage";
import { processExtractionJob } from "@/lib/extraction/process-job";

// The extraction runs in the background of this request (waitUntil) and
// keeps inside this limit; the job page shows its progress.
export const maxDuration = 300;

const MAX_PDF_BYTES = 60 * 1024 * 1024;

type Fields = {
  sourceName?: string;
  startNumber?: string | number;
  endNumber?: string | number;
  examName?: string;
  year?: string;
  pyqExam?: string;
  pyqYear?: string | number;
  pyqMonth?: string;
  subject?: string;
  chapter?: string;
  rawText?: string;
};

/**
 * Starts a PDF question-extraction job.
 *
 * Two ways in:
 *  - JSON { fileAssetId, ...fields } — the browser already uploaded the PDF
 *    straight to storage. This is what the upload page uses: a PDF posted
 *    through this route is capped at ~4.5 MB by Vercel, so bigger papers
 *    failed before reaching the code ("network error").
 *  - multipart form (file and/or rawText) — kept for small files and pasted text.
 *
 * Returns the job at once; extraction continues in the background.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    let fields: Fields;
    let pdfBuffer: Buffer | null = null;
    let fileName: string | null = null;
    let fileUrl: string | null = null;

    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as Fields & { fileAssetId?: string };
      fields = body;
      if (body.fileAssetId) {
        const asset = await prisma.fileAsset.findUnique({ where: { id: body.fileAssetId } });
        if (!asset || asset.ownerId !== session.user.id || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") {
          return apiError("Uploaded PDF not found. Please upload it again.", 404);
        }
        if (asset.mimeType !== "application/pdf") return apiError("Please upload a PDF file.", 400);
        const base = process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL;
        if (!base) return apiError("File storage isn't configured for public files.", 503);
        fileUrl = `${base.replace(/\/$/, "")}/${asset.storageKey}`;
        fileName = asset.originalFilename;
        const res = await fetch(fileUrl);
        if (!res.ok) return apiError(`Could not read the uploaded PDF (HTTP ${res.status}).`, 502);
        pdfBuffer = Buffer.from(await res.arrayBuffer());
        if (pdfBuffer.length > MAX_PDF_BYTES) return apiError("PDF is too large — please keep it under 60 MB.", 400);
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      fields = Object.fromEntries(Array.from(formData.entries()).filter(([, v]) => typeof v === "string")) as Fields;
      if (file && file.size > 0) {
        pdfBuffer = Buffer.from(await file.arrayBuffer());
        fileName = file.name;
      }
    }

    const sourceName = String(fields.sourceName ?? "").trim();
    const startNumber = Math.max(1, parseInt(String(fields.startNumber ?? "1"), 10) || 1);
    const endNumber = Math.max(startNumber, parseInt(String(fields.endNumber ?? "180"), 10) || 180);
    const examName = String(fields.examName ?? "").trim() || null;
    const year = String(fields.year ?? "").trim() || null;
    const pyqExam = String(fields.pyqExam ?? "").trim() || null;
    const pyqYear = parseInt(String(fields.pyqYear ?? year ?? ""), 10) || null;
    const pyqMonth = String(fields.pyqMonth ?? "").trim() || null;
    const subject = String(fields.subject ?? "").trim() || "Auto Detect";
    const chapter = String(fields.chapter ?? "").trim() || null;
    const rawText = String(fields.rawText ?? "").trim() || null;

    if (!sourceName) return apiError("Source Name (e.g. ALLEN, RACE, NCERT) is required.", 400);
    if (!pdfBuffer && !rawText) return apiError("Please upload a PDF file or provide extracted document text.", 400);

    fileName ||= `${sourceName}_Document.pdf`;
    // Keep the original PDF (it used to be a made-up "/uploads/extraction/…" path that pointed nowhere).
    if (pdfBuffer && !fileUrl) {
      try {
        fileUrl = await uploadFile({ key: `questions/extraction-sources/${Date.now()}-${fileName.replace(/[^\w.\-]+/g, "_")}`, body: pdfBuffer, contentType: "application/pdf" });
      } catch (err) {
        console.warn("[extract upload] could not store the source PDF:", err);
      }
    }

    const job = await prisma.extractionJob.create({
      data: {
        sourceName,
        fileName,
        fileUrl: fileUrl || "",
        fileSize: pdfBuffer?.length ?? rawText?.length ?? 0,
        startNumber,
        endNumber,
        expectedCount: endNumber - startNumber + 1,
        status: "PROCESSING",
        progress: 5,
        currentStep: "Queued — starting extraction...",
        examName,
        year: year || (pyqYear ? String(pyqYear) : null),
        pyqExam,
        pyqYear,
        pyqMonth,
        subject: subject !== "Auto Detect" ? subject : null,
        chapter,
        createdById: session.user.id,
      },
    });

    waitUntil(
      processExtractionJob({
        jobId: job.id,
        pdfBuffer,
        rawText,
        startNumber,
        endNumber,
        subject,
        chapter,
        sourceName,
        fileName,
        fileUrl: fileUrl || "",
      })
    );

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXTRACTION_JOB_CREATE",
        entityType: "ExtractionJob",
        entityId: job.id,
        metadata: { sourceName, fileName, expectedCount: job.expectedCount, fileSize: job.fileSize },
      },
    });

    return apiSuccess({ job, report: null, processing: true }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
