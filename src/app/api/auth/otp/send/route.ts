import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { sendSms, otpDebugReturnEnabled } from "@/lib/sms";
import {
  PHONE_RE,
  OTP_TTL_MINUTES,
  normalisePhone,
  hashIp,
  generateOtp,
  hashOtp,
  checkSendRateLimit,
} from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(10),
  purpose: z.enum(["STUDENT_SIGNUP", "PASSWORD_RESET"]).default("STUDENT_SIGNUP"),
});

export async function POST(request: NextRequest) {
  try {
    const { phone: rawPhone, purpose } = schema.parse(await request.json());
    const phone = normalisePhone(rawPhone);
    if (!PHONE_RE.test(phone)) return apiError("Enter a valid 10-digit Indian mobile number.", 422);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const ipHash = hashIp(ip);

    const existingUser = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, status: true },
    });

    // Duplicate-account handling — never create a second user for a phone.
    if (purpose === "STUDENT_SIGNUP" && existingUser) {
      return apiSuccess({
        existingAccount: true,
        message: "An account already exists for this number. Please sign in instead.",
      });
    }
    if (purpose === "PASSWORD_RESET" && !existingUser) {
      // Don't reveal whether the number is registered.
      return apiSuccess({ sent: true, message: "If that number has an account, a code has been sent." });
    }

    const rl = await checkSendRateLimit(phone, ipHash);
    if (rl) return apiError(rl.message, 429, { code: "RATE_LIMITED", details: { retryAfter: rl.retryAfter } });

    const code = generateOtp();
    const codeHash = await hashOtp(code);
    await prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash,
        ipHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    const sms = await sendSms({
      to: phone,
      text: `${code} is your Atomic Pathshala verification code. Valid for ${OTP_TTL_MINUTES} minutes. Do not share it.`,
    });

    await prisma.auditLog.create({
      data: {
        action: "OTP_SENT",
        entityType: "OTP",
        entityId: phone,
        metadata: { purpose, delivered: sms.delivered, reason: sms.reason ?? null },
      },
    });

    return apiSuccess({
      sent: true,
      delivered: sms.delivered,
      // Only in non-production with OTP_DEBUG_RETURN=1 — never in prod.
      ...(otpDebugReturnEnabled() ? { debugCode: code } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
