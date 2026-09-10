import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PHONE_RE, normalisePhone, consumeVerifyToken } from "@/lib/otp";
import { emailResetPasswordSchema } from "@/lib/validation/auth";
import { hashResetToken } from "@/lib/auth/reset-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED_STATUSES = ["SUSPENDED", "EX_EDUCATOR", "EX_TEAM_MEMBER", "INACTIVE", "EXPIRED"];

/**
 * Complete a password reset. Two accepted shapes:
 *
 *  A. Email-link (primary):  { token, newPassword }
 *     `token` is the raw value from the emailed /reset-password?token=… link.
 *
 *  B. Phone-OTP (legacy, still supported): { phone, verifyToken, newPassword }
 *     from /api/auth/otp/send + /verify with purpose=PASSWORD_RESET.
 *
 * The security-question flow (/api/auth/forgot-password/*) is separate and
 * unchanged.
 */
const phoneSchema = z.object({
  phone: z.string().trim(),
  verifyToken: z.string().trim().min(20),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();

    // ---- A. Email-link path -------------------------------------------
    if (json && typeof json === "object" && "token" in json && !("verifyToken" in json)) {
      const { token, newPassword } = emailResetPasswordSchema.parse(json);
      const hash = hashResetToken(token);

      const user = await prisma.user.findFirst({
        where: { passwordResetToken: hash },
        select: { id: true, status: true, passwordResetExpiresAt: true },
      });
      if (!user) return apiError("This reset link is invalid or has already been used.", 400, { code: "RESET_TOKEN_INVALID" });
      if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
        return apiError("This reset link has expired. Request a new one.", 400, { code: "RESET_TOKEN_EXPIRED" });
      }
      if (BLOCKED_STATUSES.includes(user.status)) {
        return apiError("This account can't be reset. Contact support.", 403);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET",
          entityType: "USER",
          entityId: user.id,
          metadata: { method: "email-link" },
        },
      }).catch(() => undefined);

      return apiSuccess({ reset: true });
    }

    // ---- B. Phone-OTP path (legacy) ----------------------------------
    const { phone: rawPhone, verifyToken, newPassword } = phoneSchema.parse(json);
    const phone = normalisePhone(rawPhone);
    if (!PHONE_RE.test(phone)) return apiError("Invalid mobile number.", 422);

    const check = await consumeVerifyToken(phone, "PASSWORD_RESET", verifyToken);
    if (!check.ok) return apiError(check.reason, 400, { code: "OTP_NOT_VERIFIED" });

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, status: true } });
    if (!user) return apiError("No account found for that number.", 404);
    if (BLOCKED_STATUSES.includes(user.status)) {
      return apiError("This account can't be reset. Contact support.", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET",
        entityType: "USER",
        entityId: user.id,
        metadata: { method: "phone-otp" },
      },
    }).catch(() => undefined);

    return apiSuccess({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
