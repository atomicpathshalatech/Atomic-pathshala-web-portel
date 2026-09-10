import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { forgotPasswordSchema, normaliseLoginIdentifier } from "@/lib/validation/auth";
import { newResetToken, resetTokenExpiry, buildResetUrl, forgotPasswordRateOk, RESET_TTL_MINUTES } from "@/lib/auth/reset-tokens";
import { sendMail, passwordResetEmailHtml, passwordResetEmailText } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED_STATUSES = ["SUSPENDED", "EX_EDUCATOR", "EX_TEAM_MEMBER", "INACTIVE", "EXPIRED"];

/**
 * Start an email-link password reset. Accepts the account's mobile number
 * OR email; the reset link is always emailed to the account's registered
 * email. Always responds { sent: true } regardless of whether the account
 * exists (no enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const { identifier } = forgotPasswordSchema.parse(await request.json());
    const id = normaliseLoginIdentifier(identifier);

    if (!forgotPasswordRateOk(id.value)) {
      // Same uniform answer — a client can't tell rate-limit from success.
      return apiSuccess({ sent: true });
    }

    const user = await prisma.user.findFirst({
      where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
      select: { id: true, name: true, email: true, status: true },
    });

    let debugResetUrl: string | undefined;

    if (user && user.email && !BLOCKED_STATUSES.includes(user.status)) {
      const { raw, hash } = newResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: hash, passwordResetExpiresAt: resetTokenExpiry() },
      });

      const url = buildResetUrl(raw);
      const delivery = await sendMail({
        to: user.email,
        subject: "Reset your Atomic Pathshala password",
        html: passwordResetEmailHtml({ resetUrl: url, name: user.name, expiresInMinutes: RESET_TTL_MINUTES }),
        text: passwordResetEmailText(url, RESET_TTL_MINUTES),
      });

      // Non-production only, and only when mail isn't actually configured:
      // hand the link back so the flow can be exercised without an inbox
      // (mirrors OTP_DEBUG_RETURN). Never happens in production.
      if (process.env.NODE_ENV !== "production" && !delivery.delivered) {
        debugResetUrl = url;
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "USER",
          entityId: user.id,
          metadata: { via: id.kind, emailDelivered: delivery.delivered },
        },
      }).catch(() => undefined);
    }

    return apiSuccess({ sent: true, ...(debugResetUrl ? { debugResetUrl } : {}) });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return apiError("Enter a valid mobile number or email.", 422);
    }
    return handleApiError(error);
  }
}
