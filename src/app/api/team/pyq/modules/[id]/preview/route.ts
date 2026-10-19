import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { getModule, toRenderModule } from "@/lib/pyq/module-service";
import { renderModuleHtml } from "@/lib/pyq/module-html";
import { brandLogoDataUrl } from "@/lib/pdf/brand-logo";

/** GET — the printable HTML (what the PDF will contain), for the editor's preview pane. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_READ);
    const qm = await getModule(params.id);
    if (!qm) return apiError("Module not found", 404);
    const html = renderModuleHtml(toRenderModule(qm, brandLogoDataUrl()));
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
