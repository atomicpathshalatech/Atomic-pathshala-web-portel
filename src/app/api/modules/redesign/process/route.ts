import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { uploadFile } from "@/lib/storage";
import { computePdfHash } from "@/lib/module-studio/pdf-hash";
import { executeParallelPdfExtraction } from "@/lib/module-studio/parallel-extraction-engine";
import { extractReferenceInsights, enrichMainASTWithReferences, ReferenceSource } from "@/lib/module-studio/reference-merger";
import { ModuleSubject } from "@/lib/module-studio/subject-design-system";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes max

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const formData = await request.formData();
    const mainPdfFile = formData.get("mainPdf") as File | null;

    if (!mainPdfFile) {
      return apiError("MAIN PDF file is required as primary source", 400);
    }

    const subject = (formData.get("subject") as ModuleSubject) || "CHEMISTRY";
    const moduleNumber = (formData.get("moduleNumber") as string) || "Module 01";
    const chapterName = (formData.get("chapterName") as string) || "Academic Chapter";
    const targetExam = (formData.get("targetExam") as string) || "NEET (UG)";
    const facultyName = (formData.get("facultyName") as string) || "Atomic Pathshala Faculty";

    // 1. Process MAIN PDF with High-Speed Deterministic Spatial Engine
    const mainPdfBuffer = Buffer.from(await mainPdfFile.arrayBuffer());
    const contentHash = computePdfHash(mainPdfBuffer);

    const mainSummary = await executeParallelPdfExtraction(mainPdfBuffer, {
      mode: "FAST_EDITABLE",
      concurrency: 10,
    });

    // 2. Upload source PDF to R2
    const storageKey = `modules/sources/${Date.now()}-${mainPdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const originalFileUrl = await uploadFile({
      key: storageKey,
      body: mainPdfBuffer,
      contentType: "application/pdf",
    });

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
        originalFileName: mainPdfFile.name,
        originalFileSize: mainPdfFile.size,
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
    const referenceFiles = formData.getAll("referencePdfs") as File[];
    const referenceSources: ReferenceSource[] = [];

    for (let i = 0; i < referenceFiles.length; i++) {
      const file = referenceFiles[i]!;
      if (file && file.size > 0) {
        referenceSources.push({
          id: `ref-${i + 1}`,
          name: file.name,
          type: file.name.toLowerCase().includes("ncert") ? "NCERT" : "REFERENCE_MODULE",
          buffer: Buffer.from(await file.arrayBuffer()),
        });
      }
    }

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
      ast: mainAst,
    });
  } catch (err: any) {
    console.error("[module_redesign_process_error]", err);
    return apiError(err.message || "Failed to process module redesign", 500);
  }
}
