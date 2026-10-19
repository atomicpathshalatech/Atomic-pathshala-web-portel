import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { getModule, toRenderModule } from "@/lib/pyq/module-service";
import { preflightModule, renderModuleHtml } from "@/lib/pyq/module-html";
import { renderHtmlPdf } from "@/lib/pdf/html-to-pdf";
import { inlineBookletImages } from "@/lib/pdf/inline-images";
import { brandLogoDataUrl } from "@/lib/pdf/brand-logo";
import { createPresignedDownloadUrl, getR2ObjectMetadata, uploadBufferToR2 } from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({ ignoreWarnings: z.boolean().optional() });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * POST — renders the module to a PDF (headless Chromium, vector text),
 * stores it once per content version and returns a download link.
 * Errors from the pre-export check (deleted questions, empty module) stop
 * the export; warnings are returned for the editor to show.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireTeam(PERMISSIONS.MODULE_READ);
    const { ignoreWarnings } = schema.parse(await request.json().catch(() => ({})));
    const qm = await getModule(params.id);
    if (!qm) return apiError("Module not found", 404);

    const render = toRenderModule(qm, brandLogoDataUrl());
    const warnings = preflightModule(render);
    const errors = warnings.filter((w) => w.level === "error");
    if (errors.length) return apiError(errors.map((e) => e.message).join(" "), 422, { code: "PREFLIGHT_FAILED", details: { warnings } });
    if (warnings.length && !ignoreWarnings) return apiError("Check the warnings before exporting.", 409, { code: "PREFLIGHT_WARNINGS", details: { warnings } });

    const html = renderModuleHtml(render);
    const hash = createHash("sha1").update("qm1").update(html).digest("hex").slice(0, 16);
    const key = `question-modules/${qm.id}/${hash}.pdf`;
    const exists = await getR2ObjectMetadata(key).catch(() => ({ exists: false }));
    let pageCount: number | null = null;
    if (!exists.exists) {
      const footer = `<div style="width:100%;font-size:8px;color:#666;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial"><span>ATOMIC PATHSHALA · ${esc(qm.title)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
      const pdf = await renderHtmlPdf(await inlineBookletImages(html, { origin: request.nextUrl.origin, cookie: request.headers.get("cookie") }), {
        headerTemplate: "<span></span>",
        footerTemplate: footer,
      });
      pageCount = (await PDFDocument.load(pdf)).getPageCount();
      await uploadBufferToR2({ key, buffer: pdf, contentType: "application/pdf" });
      await prisma.questionModuleExport.create({
        data: { moduleId: qm.id, storageKey: key, contentHash: hash, pageCount, warnings: warnings as unknown as object, createdById: userId },
      });
    } else {
      pageCount = (await prisma.questionModuleExport.findFirst({ where: { moduleId: qm.id, contentHash: hash }, select: { pageCount: true } }))?.pageCount ?? null;
    }
    const filename = `${qm.title.replace(/[/\\?%*:|"<>]/g, "_").trim()} - ATOMIC PATHSHALA.pdf`;
    const url = await createPresignedDownloadUrl({
      key,
      expiresInSeconds: 900,
      contentType: "application/pdf",
      contentDisposition: `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return apiSuccess({ url, pageCount, warnings, cached: Boolean(exists.exists) });
  } catch (error) {
    return handleApiError(error);
  }
}
