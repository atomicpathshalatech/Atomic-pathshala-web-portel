import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { createPyqImportJob, runPyqImport } from "@/lib/pyq/import-service";

export const maxDuration = 300;
const MAX_PDF_BYTES = 80 * 1024 * 1024;

/** GET — PYQ imports, newest first. */
export async function GET() {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const jobs = await prisma.extractionJob.findMany({
      where: { isPyqImport: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, sourceName: true, fileName: true, status: true, progress: true, currentStep: true, extractedCount: true, reviewCount: true,
        yearMode: true, pyqYear: true, createdAt: true, pyqExamRef: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
    });
    const approved = await prisma.extractedQuestion.groupBy({ by: ["jobId", "reviewDecision"], where: { jobId: { in: jobs.map((j) => j.id) } }, _count: { _all: true } });
    return apiSuccess({
      imports: jobs.map((j) => ({
        ...j,
        decisions: Object.fromEntries(approved.filter((a) => a.jobId === j.id).map((a) => [a.reviewDecision, a._count._all])),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z
  .object({
    fileAssetId: z.string().min(1),
    examId: z.string().min(1),
    yearMode: z.enum(["SINGLE", "MULTI"]),
    year: z.number().int().min(1980).max(2100).nullable().optional(),
    session: z.string().trim().max(40).nullable().optional(),
    shift: z.string().trim().max(40).nullable().optional(),
    paper: z.string().trim().max(40).nullable().optional(),
    subject: z.string().trim().max(40).nullable().optional(),
    chapter: z.string().trim().max(160).nullable().optional(),
    language: z.enum(["ENGLISH", "HINDI", "BILINGUAL"]).nullable().optional(),
    hasAnswerKey: z.boolean().nullable().optional(),
    hasSolutions: z.boolean().nullable().optional(),
    sourceTitle: z.string().trim().min(2).max(160),
    sourceReference: z.string().trim().max(300).nullable().optional(),
  })
  .refine((d) => d.yearMode === "MULTI" || Boolean(d.year), { message: "Year is required for a single-sitting paper", path: ["year"] });

/**
 * POST — start a PYQ import from a PDF the browser already uploaded to
 * storage (fileAssetId). The original PDF stays stored; extraction runs in
 * page groups in the background and the import page continues it.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const body = createSchema.parse(await request.json());

    const asset = await prisma.fileAsset.findUnique({ where: { id: body.fileAssetId } });
    if (!asset || asset.ownerId !== userId || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") return apiError("Uploaded PDF not found. Please upload it again.", 404);
    if (asset.mimeType !== "application/pdf") return apiError("Please upload a PDF file.", 400);
    const base = process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL;
    if (!base) return apiError("File storage isn't configured for public files.", 503);
    const fileUrl = `${base.replace(/\/$/, "")}/${asset.storageKey}`;
    const res = await fetch(fileUrl);
    if (!res.ok) return apiError(`Could not read the uploaded PDF (HTTP ${res.status}).`, 502);
    const pdf = Buffer.from(await res.arrayBuffer());
    if (pdf.length > MAX_PDF_BYTES) return apiError("PDF is too large — please keep it under 80 MB or split it.", 400);
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return apiError("That file is not a valid PDF.", 400);

    const job = await createPyqImportJob({
      userId,
      examId: body.examId,
      yearMode: body.yearMode,
      year: body.year ?? null,
      session: body.session,
      shift: body.shift,
      paper: body.paper,
      subject: body.subject,
      chapter: body.chapter,
      language: body.language,
      hasAnswerKey: body.hasAnswerKey,
      hasSolutions: body.hasSolutions,
      sourceTitle: body.sourceTitle,
      sourceReference: body.sourceReference,
      fileName: asset.originalFilename,
      fileUrl,
      fileSize: pdf.length,
      pdf,
    });

    await prisma.auditLog.create({
      data: { userId, action: "PYQ_IMPORT_CREATE", entityType: "ExtractionJob", entityId: job.id, metadata: { examId: body.examId, yearMode: body.yearMode, year: body.year ?? null, fileName: asset.originalFilename } },
    });

    waitUntil(runPyqImport(job.id, { pdf, budgetMs: 220_000 }).catch((e) => console.error("[pyq-import] background run failed", e)));
    return apiSuccess({ job }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
