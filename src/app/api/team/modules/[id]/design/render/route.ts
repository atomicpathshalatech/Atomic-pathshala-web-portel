import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { StorageNotConfiguredError } from "@/lib/storage";
import { storeModuleFile, moduleFileRoute } from "@/lib/module-studio/module-files";
import { moduleElementSchema } from "@/lib/validation/module";
import { designSchema, type ModuleDesign } from "@/lib/module-studio/design/model";
import { loadDesign } from "@/lib/module-studio/design/store";
import { renderModuleDesignPdf, type ExportIssue } from "@/lib/module-studio/design/render-pdf";
import type { ChapterInfo } from "@/lib/module-studio/design/render-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ mode: z.enum(["preview", "check", "export"]), design: designSchema.optional(), acknowledgeIssues: z.boolean().optional() });

/** Problems left over from importing the PDF (failed pages, pages still waiting for OCR, blocks to review). */
async function extractionIssues(moduleId: string): Promise<ExportIssue[]> {
  const out: ExportIssue[] = [];
  const job = await prisma.processingJob.findFirst({ where: { moduleId }, orderBy: { startedAt: "desc" }, select: { pageStatuses: true, finishedAt: true, metadata: true } });
  if (job) {
    const st = Object.values((job.pageStatuses as Record<string, { pageNumber: number; status: string }>) ?? {});
    const failed = st.filter((p) => p.status === "FAILED").map((p) => p.pageNumber);
    const ocr = st.filter((p) => p.status === "NEEDS_OCR").map((p) => p.pageNumber);
    if (!job.finishedAt) out.push({ category: "EXTRACTION", severity: "error", message: "The PDF import is still running — the module's content is not complete yet." });
    if (failed.length) out.push({ category: "EXTRACTION", severity: "error", message: `Page(s) ${failed.join(", ")} of the original PDF failed to import, so their content is missing. Retry them in the block editor.` });
    if (ocr.length) out.push({ category: "EXTRACTION", severity: "error", message: `Page(s) ${ocr.join(", ")} still need OCR (scanned, or text the PDF cannot decode), so their text is missing or incomplete.` });
  }
  const review = await prisma.modulePage.findMany({ where: { moduleId, needsReview: true }, select: { pageNumber: true }, orderBy: { pageNumber: "asc" } });
  if (review.length) out.push({ category: "EXTRACTION", severity: "warning", message: `Page(s) ${review.map((r) => r.pageNumber).join(", ")} are marked “needs review” (OCR text, low confidence or removed lines) — check them in the block editor.` });
  return out;
}

async function chapterInfo(d: ModuleDesign): Promise<ChapterInfo | null> {
  const ref = d.setup.chapterRef;
  if (!ref) return null;
  const ac = await prisma.academicChapter.findUnique({ where: { id: ref }, select: { topics: { where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { topicNumber: true, title: true, titleHindi: true } } } });
  if (ac) {
    const hindi = d.setup.language === "HINDI";
    return { learningObjectives: ac.topics.map((t) => `${t.topicNumber} ${hindi && t.titleHindi ? t.titleHindi : t.title}`).join("\n") };
  }
  const ch = await prisma.chapter.findUnique({ where: { id: ref }, select: { description: true, learningObjectives: true, prerequisites: true } });
  return ch ?? null;
}

/**
 * POST { mode: "preview", design? } → the PDF itself (not stored), for the studio's preview.
 * POST { mode: "export",  design? } → stored PDF + export record.
 * Without `design` the module's saved design is used.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
    const input = bodySchema.parse(await request.json());
    const saved = await loadDesign(params.id);
    if (!saved) return apiError("Module not found", 404);
    const design = input.design ?? saved.design;

    const rows = await prisma.modulePage.findMany({ where: { moduleId: params.id }, orderBy: { pageNumber: "asc" }, select: { pageNumber: true, elements: true } });
    let invalid = 0;
    const pages = rows.map((r) => ({
      pageNumber: r.pageNumber,
      elements: ((r.elements as unknown[]) ?? []).flatMap((e) => {
        const p = moduleElementSchema.safeParse(e);
        if (!p.success) invalid++;
        return p.success ? [p.data] : [];
      }),
    }));
    if (!pages.length) return apiError("This module has no content yet — extract the PDF into blocks (or add blocks) first.", 400);

    const result = await renderModuleDesignPdf({ design, pages, chapter: await chapterInfo(design) });
    const issues: ExportIssue[] = [
      ...(await extractionIssues(params.id)),
      ...(invalid ? [{ category: "CONTENT" as const, severity: "error" as const, message: `${invalid} block(s) could not be read and are missing from the PDF.` }] : []),
      ...result.issues,
    ];
    const warnings = issues.map((i) => i.message);
    const errors = issues.filter((i) => i.severity === "error");

    if (input.mode === "check") {
      return apiSuccess({ issues, errors: errors.length, pageCount: result.pageCount, sections: result.sections, contents: result.contents, timings: result.timings });
    }

    if (input.mode === "preview") {
      return new NextResponse(new Uint8Array(result.pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
          "X-Page-Count": String(result.pageCount),
          "X-Render-Ms": String(result.timings.totalMs ?? 0),
          // short report for the studio (full detail comes with export)
          "X-Design-Report": encodeURIComponent(JSON.stringify({ warnings: warnings.slice(0, 20), issues: issues.slice(0, 20), sections: result.sections, contents: result.contents.slice(0, 40) })).slice(0, 7000),
        },
      });
    }

    // Problems that would leave something wrong or missing in the PDF: the user sees them first and decides.
    if (errors.length && !input.acknowledgeIssues) {
      return apiError(`${errors.length} problem(s) need a look before export.`, 409, { code: "EXPORT_HAS_ISSUES", details: { issues } });
    }
    const m = await prisma.module.findUnique({ where: { id: params.id }, select: { code: true } });
    const fileName = `${m?.code ?? params.id}-design-${design.output.mode.toLowerCase()}-${Date.now()}.pdf`;
    const storedUrl = await storeModuleFile({ key: `module-exports/${m?.code ?? params.id}/${fileName}`, body: result.pdf, contentType: "application/pdf" });
    const exportRecord = await prisma.moduleExport.create({
      data: {
        moduleId: params.id,
        fileUrl: storedUrl,
        fileName,
        fileSize: result.pdf.length,
        quality: design.output.mode === "PRINT" ? `PRINT_BLEED_${design.output.bleedMm}MM` : "DIGITAL",
        includedFrontPage: design.sections.some((s) => s.enabled && s.kind === "COVER"),
        includedWatermark: design.watermark.enabled,
        createdById: session.user.id,
      },
    });
    await prisma.auditLog.create({ data: { userId: session.user.id, action: "MODULE_DESIGN_EXPORTED", entityType: "Module", entityId: params.id, metadata: { exportId: exportRecord.id, pages: result.pageCount, mode: design.output.mode } } }).catch(() => undefined);
    const fileUrl = moduleFileRoute(params.id, `export:${exportRecord.id}`);
    return apiSuccess({ export: { ...exportRecord, fileUrl }, fileUrl, pageCount: result.pageCount, warnings, issues, sections: result.sections, contents: result.contents, timings: result.timings }, 201);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
