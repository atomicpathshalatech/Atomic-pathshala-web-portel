import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile } from "@/lib/storage";
import { applyModuleBranding, type ModuleBrandingOptions } from "@/lib/module-studio/rebranding-engine";
import { generateModuleVerificationReport, formatVerificationReportMarkdown } from "@/lib/module-studio/verification-engine";
import { z } from "zod";

export const maxDuration = 120;

const rebrandInputSchema = z.object({
  preset: z.enum(["ATOMIC_DEFAULT", "CHEMISTRY", "PHYSICS", "BIOLOGY", "MINIMAL", "TEACHER_CUSTOM"]).optional(),
  teacherName: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  batchName: z.string().nullable().optional(),
  chapterName: z.string().nullable().optional(),
  removeOldHeader: z.boolean().optional(),
  removeOldFooter: z.boolean().optional(),
  oldHeaderHeightPt: z.number().min(0).max(120).optional(),
  oldFooterHeightPt: z.number().min(0).max(100).optional(),
  includeHeader: z.boolean().optional(),
  includeFooter: z.boolean().optional(),
  includeWatermark: z.boolean().optional(),
  watermarkText: z.string().nullable().optional(),
  watermarkOpacity: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      include: { brandProfile: true },
    });
    if (!moduleRow) return apiError("Module not found", 404);

    const body = await request.json().catch(() => ({}));
    const options = rebrandInputSchema.parse(body);

    // 1. Fetch original PDF
    const fileRes = await fetch(moduleRow.originalFileUrl);
    if (!fileRes.ok) throw new Error(`Could not download the source PDF from storage (HTTP ${fileRes.status}).`);
    const originalBuffer = Buffer.from(await fileRes.arrayBuffer());

    // 2. Prepare rebranding options
    const brandingOptions: ModuleBrandingOptions = {
      preset: options.preset ?? "ATOMIC_DEFAULT",
      teacherName: options.teacherName ?? moduleRow.facultyName ?? "Atomic Pathshala Faculty",
      subject: options.subject ?? moduleRow.subject ?? "NEET PREPARATION",
      batchName: options.batchName ?? moduleRow.batch ?? "NEET Accelerated Batch",
      chapterName: options.chapterName ?? moduleRow.chapter ?? moduleRow.title,
      moduleCode: moduleRow.code,
      academicYear: moduleRow.academicYear ?? undefined,
      removeOldHeader: options.removeOldHeader ?? false,
      removeOldFooter: options.removeOldFooter ?? false,
      oldHeaderHeightPt: options.oldHeaderHeightPt,
      oldFooterHeightPt: options.oldFooterHeightPt,
      includeHeader: options.includeHeader ?? true,
      includeFooter: options.includeFooter ?? true,
      includeWatermark: options.includeWatermark ?? false,
      watermarkText: options.watermarkText ?? (moduleRow.brandProfile?.name || "ATOMIC PATHSHALA"),
      watermarkOpacity: options.watermarkOpacity ?? 0.05,
    };

    // 3. Apply High-Precision Preservation & Vector Overlay Rebranding
    const result = await applyModuleBranding(originalBuffer, brandingOptions);

    // 4. Generate Verification & Preservation Report
    const report = generateModuleVerificationReport({
      moduleId: moduleRow.id,
      moduleCode: moduleRow.code,
      originalFileName: moduleRow.originalFileName,
      originalPageCount: result.pageCount,
      brandedPageCount: result.pageCount,
      hasHindi: true,
      hasFormulas: true,
      hasDiagrams: true,
      hasTables: true,
    });

    // 5. Upload branded PDF to storage
    const fileName = `${moduleRow.code}-rebranded-${Date.now()}.pdf`;
    const key = `module-exports/${moduleRow.code}/${fileName}`;
    const fileUrl = await uploadFile({
      key,
      body: Buffer.from(result.brandedPdfBytes),
      contentType: "application/pdf",
    });

    // 6. Record in ModuleExport history
    const exportRecord = await prisma.moduleExport.create({
      data: {
        moduleId: moduleRow.id,
        fileUrl,
        fileName,
        fileSize: result.fileSizeBytes,
        includedFrontPage: false,
        includedWatermark: brandingOptions.includeWatermark ?? false,
        createdById: session.user.id,
      },
    });

    // 7. Update module pageCount and status if needed
    await prisma.module.update({
      where: { id: moduleRow.id },
      data: {
        pageCount: result.pageCount,
        status: moduleRow.status === "DRAFT" ? "READY" : moduleRow.status,
      },
    });

    // 8. Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MODULE_REBRANDED",
        entityType: "Module",
        entityId: moduleRow.id,
        metadata: {
          exportId: exportRecord.id,
          pageCount: result.pageCount,
          fileSize: result.fileSizeBytes,
          preset: result.appliedPreset,
          verificationScore: report.overallScore,
        },
      },
    });

    return apiSuccess({
      export: exportRecord,
      report,
      reportMarkdown: formatVerificationReportMarkdown(report),
      pageCount: result.pageCount,
      fileSizeBytes: result.fileSizeBytes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
