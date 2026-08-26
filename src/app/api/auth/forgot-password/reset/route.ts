import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { passwordResetSchema } from "@/lib/validation/student";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/**
 * Step 3 of the reset flow — spends the one-time token issued by
 * POST /api/auth/forgot-password/verify. Single-use: the token is cleared
 * on success (and is time-boxed to 15 minutes from issuance either way).
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = passwordResetSchema.parse(json);

    const user = await prisma.user.findUnique({ where: { passwordResetToken: input.token } });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return apiError("This reset session has expired. Please start again.", 401);
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET",
          entityType: "User",
          entityId: user.id,
        },
      }),
    ]);

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
