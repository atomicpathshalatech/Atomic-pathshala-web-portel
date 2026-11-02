import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api/response";
import { canManageCards } from "@/lib/id-card/admin";
import { cardHtml, loadCard } from "@/lib/id-card/data";
import { cardPdfResponse, renderCardPdf } from "@/lib/id-card/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/team/id-cards/:userId/pdf?kind=student|team — an admin prints someone's card (e.g. for the plastic-card printer). */
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const kind = request.nextUrl.searchParams.get("kind") === "team" ? "TEAM" : "STUDENT";
    if (!(await canManageCards(session.user.id, kind))) return apiError("You do not have permission to print these ID cards.", 403);

    const loaded = await loadCard(kind, params.userId);
    if (!loaded) return apiError("Person not found.", 404);
    if (loaded.ineligible) return apiError(loaded.ineligible, 409);
    if (!loaded.card) return apiError("ID cards are not set up yet.", 503);
    if (loaded.card.status === "REVOKED") return apiError("This ID card is revoked — reinstate or reissue it first.", 409);
    if (!loaded.model) return apiError(`Card incomplete: ${loaded.missing.map((m) => m.label).join(", ")}.`, 409);

    const pdf = await renderCardPdf(cardHtml(loaded.model, "pdf"));
    return cardPdfResponse(pdf, loaded.name, request.nextUrl.searchParams.get("inline") === "1");
  } catch (error) {
    return handleApiError(error);
  }
}
