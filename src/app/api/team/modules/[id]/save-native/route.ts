import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile } from "@/lib/storage";
import {
  processNativePdfEdits,
  type TextEditItem,
  type WhiteoutItem,
  type ImageEditItem,
  type ShapeEditItem,
  type GlobalRemovalItem,
  type GlobalReplacementItem,
  type BackgroundConfig,
  type HeaderFooterConfig,
  type WatermarkConfig,
  type CoverPageConfig,
} from "@/lib/module-editor/native-pdf-engine";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes

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

    const body = await request.json();
    const {
      textEdits = [],
      whiteouts = [],
      images = [],
      shapes = [],
      globalRemovals = [],
      globalReplacements = [],
      background,
      pageRotations = {},
      deletedPages = [],
      pageOrder,
      headerFooter,
      watermark,
      coverPage,
      changeSummary = "Edited in Native PDF Editor",
      isAutosave = false,
    } = body as {
      textEdits?: TextEditItem[];
      whiteouts?: WhiteoutItem[];
      images?: ImageEditItem[];
      shapes?: ShapeEditItem[];
      globalRemovals?: GlobalRemovalItem[];
      globalReplacements?: GlobalReplacementItem[];
      background?: BackgroundConfig;
      pageRotations?: Record<number, number>;
      deletedPages?: number[];
      pageOrder?: number[];
      headerFooter?: HeaderFooterConfig;
      watermark?: WatermarkConfig;
      coverPage?: CoverPageConfig;
      changeSummary?: string;
      isAutosave?: boolean;
    };

    // 1. Fetch original / source PDF
    const fileRes = await fetch(moduleRow.originalFileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download source PDF from storage (HTTP ${fileRes.status})`);
    }
    const originalPdfBuffer = Buffer.from(await fileRes.arrayBuffer());

    // 2. Process in-place native PDF edits
    const result = await processNativePdfEdits({
      originalPdfBuffer,
      textEdits,
      whiteouts,
      images,
      shapes,
      globalRemovals,
      globalReplacements,
      background,
      pageRotations,
      deletedPages,
      pageOrder,
      headerFooter,
      watermark,
      coverPage,
    });

    const versionId = `v-${Date.now().toString(36)}`;
    const fileName = `${moduleRow.code}-${versionId}.pdf`;
    const storageKey = isAutosave
      ? `modules/${moduleRow.id}/autosave/latest.pdf`
      : `modules/${moduleRow.id}/versions/${versionId}/${fileName}`;

    // 3. Upload new PDF revision to R2
    const fileUrl = await uploadFile({
      key: storageKey,
      body: Buffer.from(result.pdfBytes),
      contentType: "application/pdf",
    });

    // 4. Save ModuleVersion record with full state arrays for lossless reload
    const versionRecord = await prisma.moduleVersion.create({
      data: {
        moduleId: moduleRow.id,
        label: isAutosave ? `Autosave (${new Date().toLocaleTimeString("en-IN")})` : changeSummary,
        snapshot: {
          textEdits,
          whiteouts,
          images,
          shapes,
          globalRemovals,
          globalReplacements,
          background,
          headerFooter,
          watermark,
          coverPage,
          pageRotations,
          deletedPages,
          pageOrder,
          textEditsCount: textEdits.length,
          whiteoutsCount: whiteouts.length,
          imagesCount: images.length,
          shapesCount: shapes.length,
          globalRemovalsCount: globalRemovals.length,
          globalReplacementsCount: globalReplacements.length,
          pageCount: result.pageCount,
          fileSizeBytes: result.fileSizeBytes,
          fileUrl,
        } as any,
        createdById: session.user.id,
      },
    });

    // 5. If explicit save, record in ModuleExport and update Module pageCount
    if (!isAutosave) {
      await prisma.moduleExport.create({
        data: {
          moduleId: moduleRow.id,
          versionId: versionRecord.id,
          fileUrl,
          fileName,
          fileSize: result.fileSizeBytes,
          quality: "PRINT_READY_300DPI",
          includedFrontPage: coverPage?.enabled ?? false,
          includedWatermark: watermark?.enabled ?? false,
          createdById: session.user.id,
        },
      });

      await prisma.module.update({
        where: { id: moduleRow.id },
        data: {
          pageCount: result.pageCount,
          status: "READY",
        },
      });
    }

    return apiSuccess({
      success: true,
      versionId: versionRecord.id,
      fileUrl,
      fileName,
      pageCount: result.pageCount,
      fileSizeBytes: result.fileSizeBytes,
      savedAt: result.processedAt,
      isAutosave,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
