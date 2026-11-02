import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api/response";
import { cardHtml, loadCard } from "@/lib/id-card/data";
import { cardPdfResponse, renderCardPdf } from "@/lib/id-card/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/id-card/pdf?kind=student|team[&inline=1]
 * The signed-in person's OWN card as a print-ready PDF. There is no id in the
 * URL — it is always the session's user, so nobody can fetch someone else's.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const kind = request.nextUrl.searchParams.get("kind") === "team" ? "TEAM" : "STUDENT";

    const loaded = await loadCard(kind, session.user.id);
    if (!loaded) return apiError("No profile found for this ID card.", 404);
    if (loaded.ineligible) return apiError(loaded.ineligible, 403);
    if (!loaded.card) return apiError("ID cards are not set up yet — please try again later.", 503);
    if (loaded.card.status === "REVOKED") return apiError("This ID card has been revoked. Please contact the Atomic Pathshala office.", 403);
    if (!loaded.model) return apiError(`Your ID card needs: ${loaded.missing.map((m) => m.label).join(", ")}.`, 409);

    const pdf = await renderCardPdf(cardHtml(loaded.model, "pdf"));
    await prisma.idCard.update({ where: { id: loaded.card.id }, data: { lastDownloadedAt: new Date() } }).catch(() => undefined);
    return cardPdfResponse(pdf, loaded.name, request.nextUrl.searchParams.get("inline") === "1");
  } catch (error) {
    return handleApiError(error);
  }
}
