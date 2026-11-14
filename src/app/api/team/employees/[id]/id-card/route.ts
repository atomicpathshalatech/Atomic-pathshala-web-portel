import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { cardHtml, loadOfficialEmployeeCardModel } from "@/lib/id-card/data";
import { cardPdfResponse, renderCardPdf } from "@/lib/id-card/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const cardData = await loadOfficialEmployeeCardModel(params.id);
    if (!cardData) {
      return new NextResponse("Employee ID card record not found", { status: 404 });
    }

    const format = request.nextUrl.searchParams.get("format");

    // JSON format for the modal preview iframe
    if (format === "json") {
      const html = cardHtml(cardData.model, "screen");
      return NextResponse.json({
        success: true,
        html,
        verifyUrl: cardData.verifyUrl,
        pdfUrl: `/api/team/employees/${params.id}/id-card`,
      });
    }

    // Raw HTML format
    if (format === "html") {
      const html = cardHtml(cardData.model, "screen");
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Default: Official CR80 plastic-card vector PDF
    const html = cardHtml(cardData.model, "pdf");
    const pdfBuffer = await renderCardPdf(html);
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    return cardPdfResponse(pdfBuffer, cardData.model.name, inline);
  } catch (error: any) {
    console.error("[api/team/employees/id-card] Error:", error);
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
