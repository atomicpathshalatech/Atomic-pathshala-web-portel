import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  PHONE_RE,
  normalisePhone,
  newVerifyToken,
  VERIFY_TOKEN_TTL_MINUTES,
} from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(10),
  purpose: z.enum(["STUDENT_SIGNUP", "PASSWORD_RESET"]).default("STUDENT_SIGNUP"),
  code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code you received."),
});

export async function POST(request: NextRequest) {
  try {
    const { phone: rawPhone, purpose, code } = schema.parse(await request.json());
    const phone = normalisePhone(rawPhone);
    if (!PHONE_RE.test(phone)) return apiError("Invalid mobile number.", 422);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) return apiError("No active code. Request a new one.", 400, { code: "NO_CHALLENGE" });
    if (challenge.expiresAt.getTime() < Date.now()) {
      return apiError("This code has expired. Request a new one.", 400, { code: "EXPIRED" });
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      // Lock it so it can't be probed any further.
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      return apiError("Too many incorrect attempts. Request a new code.", 429, { code: "LOCKED" });
    }

    const match = await bcrypt.compare(code, challenge.codeHash);
    if (!match) {
      const attempts = challenge.attempts + 1;
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          ...(attempts >= challenge.maxAttempts ? { consumedAt: new Date() } : {}),
        },
      });
      return apiError(
        attempts >= challenge.maxAttempts
          ? "Incorrect code. Too many attempts — request a new code."
          : `Incorrect code. ${challenge.maxAttempts - attempts} attempt(s) left.`,
        400,
        { code: "WRONG_CODE" }
      );
    }

    // Success: single-use — mark consumed, issue a short-lived verify token.
    const verifyToken = newVerifyToken();
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
        verifyToken,
        verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "OTP_VERIFIED",
        entityType: "OTP",
        entityId: phone,
        metadata: { purpose },
      },
    });

    return apiSuccess({ verified: true, verifyToken, expiresInMinutes: VERIFY_TOKEN_TTL_MINUTES });
  } catch (error) {
    return handleApiError(error);
  }
}
