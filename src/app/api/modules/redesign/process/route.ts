import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { adoptUploadedModuleFile, storeModuleFile } from "@/lib/module-studio/module-files";
import { getObjectBuffer, mainBucketName, StorageNotConfiguredError } from "@/lib/storage";
import { looksLikePdf } from "@/lib/module-studio/pdf-inspect";
import { computePdfHash } from "@/lib/module-studio/pdf-hash";
import { executeParallelPdfExtraction } from "@/lib/module-studio/parallel-extraction-engine";
import { extractReferenceInsights, enrichMainASTWithReferences, ReferenceSource } from "@/lib/module-studio/reference-merger";
import { ModuleSubject } from "@/lib/module-studio/subject-design-system";

export const runtime = "nodejs";
export const maxDuration = 300;

// A response over ~4.5MB is refused by Vercel; the client then reads the content from the saved pages.
const MAX_INLINE_AST_BYTES = 3_500_000;

type Source = { name: string; size: number; buffer: Buffer; storageKey?: string };

/** A PDF this user uploaded straight to storage (/api/files/upload-url), read back with the server's credentials. */
async function uploadedPdf(fileAssetId: unknown, userId: string): Promise<Source> {
  if (typeof fileAssetId !== "string" || !fileAssetId) throw new InputError("No PDF was uploaded.");
  const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
  if (!asset || asset.ownerId !== userId || asset.status !== "ACTIVE") throw new InputError("Uploaded PDF not found. Please upload it again.");
  const bucket = mainBucketName();
  if (!bucket) throw new StorageNotConfiguredError();
  const buffer = await getObjectBuffer(bucket, asset.storageKey);
  if (!buffer) throw new InputError("Uploaded PDF not found in storage. Please upload it again.");
  if (!looksLikePdf(buffer)) throw new InputError(`"${asset.originalFilename}" is not a PDF.`);
  return { name: asset.originalFilename, size: buffer.length, buffer, storageKey: asset.storageKey };
}

class InputError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    // Large PDFs are uploaded by the browser straight to storage and named here by id
    // (a request through a Vercel function is capped at ~4.5MB); small ones may still come as a form.
    let main: Source;
    const references: Source[] = [];
    let fields: Record<string, string> = {};
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      main = await uploadedPdf(body.mainFileAssetId, session.user.id);
      const refIds = Array.isArray(body.referenceFileAssetIds) ? body.referenceFileAssetIds.slice(0, 10) : [];
      for (const id of refIds) references.push(await uploadedPdf(id, session.user.id));
      for (const k of ["subject", "moduleNumber", "chapterName", "targetExam", "facultyName"]) if (typeof body[k] === "string") fields[k] = body[k] as string;
    } else {
      const formData = await request.formData();
      const mainPdfFile = formData.get("mainPdf") as File | null;
      if (!mainPdfFile) return apiError("MAIN PDF file is required as primary source", 400);
      main = { name: mainPdfFile.name, size: mainPdfFile.size, buffer: Buffer.from(await mainPdfFile.arrayBuffer()) };
      if (!looksLikePdf(main.buffer)) return apiError(`"${main.name}" is not a PDF.`, 400);
      for (const f of formData.getAll("referencePdfs") as File[]) {
        if (f && f.size > 0) references.push({ name: f.name, size: f.size, buffer: Buffer.from(await f.arrayBuffer()) });
      }
      for (const k of ["subject", "moduleNumber", "chapterName", "targetExam", "facultyName"]) {
        const v = formData.get(k);
        if (typeof v === "string") fields[k] = v;
      }
    }

    const subject = (fields.subject as ModuleSubject) || "CHEMISTRY";
    const moduleNumber = fields.moduleNumber || "Module 01";
    const chapterName = fields.chapterName || "Academic Chapter";
    const targetExam = fields.targetExam || "NEET (UG)";
    const facultyName = fields.facultyName || "Atomic Pathshala Faculty";

    // 1. Process MAIN PDF with High-Speed Deterministic Spatial Engine
    const mainPdfBuffer = main.buffer;
    const contentHash = computePdfHash(mainPdfBuffer);

    const mainSummary = await executeParallelPdfExtraction(mainPdfBuffer, {
      mode: "FAST_EDITABLE",
      concurrency: 10,
    });

    // 2. Upload source PDF to R2
    const storageKey = `modules/sources/${Date.now()}-${main.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const originalFileUrl = main.storageKey
      ? await adoptUploadedModuleFile(main.storageKey, storageKey)
      : await storeModuleFile({ key: storageKey, body: mainPdfBuffer, contentType: "application/pdf" });

    // 3. Upsert Module record in DB
    const moduleCode = `${subject.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const moduleRow = await prisma.module.create({
      data: {
        code: moduleCode,
        title: `${moduleNumber}: ${chapterName}`,
        subject,
        chapter: chapterName,
        facultyName,
        status: "READY",
        pdfType: mainSummary.pdfType,
        originalFileUrl,
        originalFileName: main.name,
        originalFileSize: main.size,
        pageCount: mainSummary.totalPages,
        contentHash,
        createdById: session.user.id,
      },
    });

    // 4. Persist extracted pages to DB in a transaction
    await prisma.$transaction(
      mainSummary.pages.map((p) =>
        prisma.modulePage.create({
          data: {
            moduleId: moduleRow.id,
            pageNumber: p.pageNumber,
            width: p.width,
            height: p.height,
            pdfType: p.pdfType,
            elements: p.elements as any,
            ocrConfidence: p.ocrConfidence,
            needsReview: p.needsReview,
            warnings: p.warnings as any,
          },
        })
      )
    );

    // 5. Flatten pages into full AST
    let mainAst = mainSummary.pages.flatMap((p) => p.elements);

    // 6. Process REFERENCE PDFs if any
    const referenceSources: ReferenceSource[] = references.map((file, i) => ({
      id: `ref-${i + 1}`,
      name: file.name,
      type: file.name.toLowerCase().includes("ncert") ? "NCERT" : "REFERENCE_MODULE",
      buffer: file.buffer,
    }));

    let extractedReferenceInsightsCount = 0;
    if (referenceSources.length > 0) {
      const referenceInsights = await extractReferenceInsights(referenceSources);
      extractedReferenceInsightsCount = referenceInsights.length;
      mainAst = enrichMainASTWithReferences(mainAst, referenceInsights);
    }

    return apiSuccess({
      success: true,
      moduleId: moduleRow.id,
      moduleCode: moduleRow.code,
      subject,
      moduleNumber,
      chapterName,
      targetExam,
      facultyName,
      totalPages: mainSummary.totalPages,
      totalElements: mainAst.length,
      referenceSourcesCount: referenceSources.length,
      referenceInsightsInserted: extractedReferenceInsightsCount,
      ...(JSON.stringify(mainAst).length > MAX_INLINE_AST_BYTES ? { ast: null, astTooLarge: true } : { ast: mainAst }),
    });
  } catch (err: any) {
    if (err instanceof InputError) return apiError(err.message, 400);
    if (err instanceof StorageNotConfiguredError) return apiError(err.message, 503);
    console.error("[module_redesign_process_error]", err);
    return apiError(err.message || "Failed to process module redesign", 500);
  }
}
