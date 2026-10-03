import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { ensureDppTest } from "@/lib/dpp/dpp-test";
import { buildDppCoverHtml } from "@/lib/dpp/cover";
import { DPP_COVER_CSS } from "@/lib/dpp/cover-html";
import { brandLogoDataUrl } from "@/lib/pdf/brand-logo";

/**
 * Preview of the DPP booklet before downloading — the same pages the PDF is
 * made from (front page + questions, or solutions), opened in the browser.
 *
 * GET /api/team/dpp/:id/preview?type=questions|solutions
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_READ);
    const solutions = request.nextUrl.searchParams.get("type") === "solutions";

    const backing = await ensureDppTest(params.id);
    if (backing) {
      // The same single booklet the PDF is made from (questions + solutions).
      return NextResponse.redirect(new URL(`/api/tests/${backing.testId}/export?type=with-solution`, request.url), 302);
    }

    // No questions yet: show just the front page.
    const cover = await buildDppCoverHtml(params.id, { logoUrl: brandLogoDataUrl(), solutions });
    if (!cover) return apiError("DPP not found", 404);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DPP preview</title>
<link href="https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&family=Noto+Serif+Devanagari:wght@400;700&family=Montserrat:wght@600;700;800;900&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>body{margin:0;background:#e9eaee;font-family:Montserrat,Arial,sans-serif}.bar{padding:12px 16px;text-align:center;font-weight:700;color:#7a4b00;background:#fff3e0}
.dpp-cover-page{margin:24px auto;box-shadow:0 6px 24px rgba(0,0,0,.15)}@page{size:A4;margin:0}@media print{.bar{display:none}body{background:#fff}.dpp-cover-page{margin:0;box-shadow:none}}
${DPP_COVER_CSS}</style></head><body><div class="bar">Front page preview — add questions to this DPP to see the full booklet.</div>${cover}</body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
