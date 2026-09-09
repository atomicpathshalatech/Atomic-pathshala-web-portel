import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { validateInviteToken } from "@/lib/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public: the invitee opens their link. Validates the token server-side,
 * marks the invitation OPENED (once), and returns just enough to prefill the
 * form. Email + phone come from the invitation record and are read-only on
 * the client — the invitee can't complete an invite for a different contact.
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const result = await validateInviteToken(params.token);
    if (!result.ok) {
      const msg =
        result.reason === "EXPIRED"
          ? "This invitation link has expired. Ask your administrator to resend it."
          : result.reason === "ALREADY_USED"
          ? "This invitation has already been used."
          : "This invitation link is not valid.";
      return apiError(msg, 410);
    }

    const inv = result.invitation;
    if (inv.status === "PENDING") {
      await prisma.staffInvitation.update({
        where: { id: inv.id },
        data: { status: "OPENED", openedAt: new Date() },
      });
      await prisma.auditLog.create({
        data: {
          action: "STAFF_INVITE_OPENED",
          entityType: "STAFF_INVITATION",
          entityId: inv.id,
          metadata: { email: inv.email },
        },
      });
    }

    return apiSuccess({
      email: inv.email,
      phone: inv.phone,
      expiresAt: inv.expiresAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
