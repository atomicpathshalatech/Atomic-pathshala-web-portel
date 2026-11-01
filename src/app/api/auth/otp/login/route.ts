import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { normaliseLoginIdentifier } from "@/lib/validation/auth";
import { checkSendRateLimit, hashIp } from "@/lib/otp";
import { loginOtpKey, maskEmail, sendLoginEmailCode } from "@/lib/auth/login-otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ identifier: z.string().trim().min(3).max(200) });

/**
 * Log in by OTP, step 1: emails a login code to the account's email (the
 * browser asks MSG91 to text the SMS code itself, for a mobile number).
 * "Resend" calls this again — it always goes to email. Whether an account
 * exists is never revealed: an unknown number / email gets the same answer.
 */
export async function POST(request: NextRequest) {
  try {
    const { identifier } = schema.parse(await request.json());
    const id = normaliseLoginIdentifier(identifier);
    const user = await prisma.user.findFirst({
      where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
      select: { id: true, email: true, name: true, status: true },
    });
    const canSignIn = user && ["ACTIVE", "PENDING_VERIFICATION", "APPROVAL_PENDING", "INVITED", "NO_ROLE"].includes(user.status);
    if (!user || !canSignIn || !user.email) {
      return apiSuccess({ emailSentTo: null });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const ipHash = hashIp(ip);
    const rl = await checkSendRateLimit(loginOtpKey(user.id), ipHash);
    if (rl) return apiError(rl.message, 429, { code: "RATE_LIMITED", details: { retryAfter: rl.retryAfter } });

    const delivered = await sendLoginEmailCode({ id: user.id, email: user.email, name: user.name }, ipHash);
    if (!delivered) return apiError("We could not email the code right now. Please try again in a moment.", 502, { code: "EMAIL_FAILED" });
    return apiSuccess({ emailSentTo: maskEmail(user.email) });
  } catch (error) {
    return handleApiError(error);
  }
}
