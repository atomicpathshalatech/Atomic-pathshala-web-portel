import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { canManageCards } from "@/lib/id-card/admin";
import { idCardWhatsAppTemplates, pendingIdCards, sendIdCards } from "@/lib/id-card/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const kindOf = (v: string | null) => (v === "team" || v === "TEAM" ? "TEAM" : "STUDENT");
const channelOf = (v: string | null) => (v === "whatsapp" ? "whatsapp" : "email");

/** GET ?kind=team|student — how many cards / photo reminders are still to be emailed. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const kind = kindOf(request.nextUrl.searchParams.get("kind"));
    if (!(await canManageCards(session.user.id, kind))) return apiError("You do not have permission to send these ID cards.", 403);
    const channel = channelOf(request.nextUrl.searchParams.get("channel"));
    const due = await pendingIdCards(kind, channel);
    const t = idCardWhatsAppTemplates();
    return apiSuccess({
      cards: due.filter((d) => d.mode === "card").length,
      reminders: due.filter((d) => d.mode === "nophoto").length,
      // WhatsApp without an approved template only reaches people who messaged in the last 24 hours.
      templatesReady: channel === "email" || Boolean(t.card && t.nophoto),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  kind: z.enum(["STUDENT", "TEAM"]),
  channel: z.enum(["email", "whatsapp"]).default("email"),
  skip: z.array(z.string().max(40)).max(5000).optional(),
});

/**
 * POST — sends the next batch (the page calls this again until nothing is
 * left). Everyone gets their card once (PDF attached), or the "photo
 * missing" note with a link straight to the photo upload.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const input = schema.parse(await request.json());
    if (!(await canManageCards(session.user.id, input.kind))) return apiError("You do not have permission to send these ID cards.", 403);

    const result = await sendIdCards(input.kind, input.channel, { limit: 12, deadlineMs: 40_000, skip: input.skip });
    if (result.cards + result.reminders > 0) {
      await prisma.auditLog
        .create({
          data: {
            userId: session.user.id,
            action: input.channel === "whatsapp" ? "ID_CARD_WHATSAPP_SENT" : "ID_CARD_EMAILS_SENT",
            entityType: "IdCard",
            metadata: { kind: input.kind, channel: input.channel, cards: result.cards, reminders: result.reminders, failed: result.failed },
          },
        })
        .catch(() => undefined);
    }
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
