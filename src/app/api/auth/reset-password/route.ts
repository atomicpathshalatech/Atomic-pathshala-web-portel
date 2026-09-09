import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PHONE_RE, normalisePhone, consumeVerifyToken } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OTP-based password reset. Verify the phone via /api/auth/otp/send +
 * /api/auth/otp/verify with purpose=PASSWORD_RESET, then POST the resulting
 * verifyToken here with a new password. The existing security-question reset
 * flow (/api/auth/forgot-password/*) is unchanged and still available.
 */
const schema = z.object({
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
    const { phone: rawPhone, verifyToken, newPassword } = schema.parse(await request.json());
    const phone = normalisePhone(rawPhone);
    if (!PHONE_RE.test(phone)) return apiError("Invalid mobile number.", 422);

    const check = await consumeVerifyToken(phone, "PASSWORD_RESET", verifyToken);
    if (!check.ok) return apiError(check.reason, 400, { code: "OTP_NOT_VERIFIED" });

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, status: true } });
    if (!user) return apiError("No account found for that number.", 404);
    if (["SUSPENDED", "EX_EDUCATOR", "EX_TEAM_MEMBER", "INACTIVE"].includes(user.status)) {
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
    });

    return apiSuccess({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
