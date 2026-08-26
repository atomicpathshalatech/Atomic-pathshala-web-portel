import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { passwordResetVerificationSchema } from "@/lib/validation/student";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

// 15 minutes, matching the same short-lived-token convention as everywhere
// else in this project that issues a one-time token.
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Step 2 of the locked "Email + DOB + Security Question" reset flow.
 * There's no email/SMS delivery infrastructure in this build (password-only
 * auth per policy, no SMS OTP either) — so once identity is verified here,
 * the reset token is handed straight back in the response instead of being
 * emailed, and the client moves directly to the "set new password" step.
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = passwordResetVerificationSchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { student: { select: { dob: true } } },
    });

    // One generic failure for every mismatch — wrong email, wrong DOB,
    // wrong answer, or no security question ever set — so this endpoint
    // can't be used to enumerate accounts or narrow down DOB/answer one
    // field at a time.
    const genericFail = () => apiError("Those details don't match our records.", 401);

    if (!user || !user.securityAnswerHash || !user.student) return genericFail();

    const dobMatches = user.student.dob.toDateString() === input.dob.toDateString();
    if (!dobMatches) return genericFail();

    const answerMatches = await bcrypt.compare(input.securityAnswer, user.securityAnswerHash);
    if (!answerMatches) return genericFail();

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    return apiSuccess({ token });
  } catch (error) {
    return handleApiError(error);
  }
}
