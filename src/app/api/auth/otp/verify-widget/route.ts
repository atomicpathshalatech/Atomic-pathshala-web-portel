import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { PHONE_RE, normalisePhone, newVerifyToken, VERIFY_TOKEN_TTL_MINUTES } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server side of the MSG91 OTP Widget flow. The client runs the widget
 * (src/lib/msg91-widget.ts), the widget verifies the OTP entirely on
 * MSG91's side and returns a signed access token; we confirm that token
 * here with MSG91, then mint the same short-lived `verifyToken` the rest
 * of registration already expects (consumed by /api/students/register via
 * consumeVerifyToken). No OTP code ever touches our server.
 */
const schema = z.object({
  phone: z.string().trim().min(10),
  accessToken: z.string().trim().min(10),
  purpose: z.enum(["STUDENT_SIGNUP", "PASSWORD_RESET"]).default("STUDENT_SIGNUP"),
});

const VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

export async function POST(request: NextRequest) {
  try {
    const authkey = process.env.MSG91_WIDGET_AUTHKEY?.trim();
    if (!authkey) {
      return apiError("OTP verification is not configured on the server.", 503, { code: "WIDGET_NOT_CONFIGURED" });
    }

    const { phone: rawPhone, accessToken, purpose } = schema.parse(await request.json());
    const phone = normalisePhone(rawPhone);
    if (!PHONE_RE.test(phone)) return apiError("Invalid mobile number.", 422);

    // Duplicate-phone guard for signup — don't even verify, just tell the
    // client to switch to sign-in (mirrors /api/auth/otp/send).
    if (purpose === "STUDENT_SIGNUP") {
      const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (existing) return apiSuccess({ existingAccount: true });
    }

    // Confirm the widget access token with MSG91. MSG91 returns HTTP 200
    // even for failures and signals the real result in `type`.
    let mResp: { type?: string; message?: string } = {};
    try {
      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authkey, "access-token": accessToken }),
        cache: "no-store",
      });
      mResp = (await res.json().catch(() => ({}))) as typeof mResp;
      if (!res.ok) {
        return apiError("Could not verify the OTP right now. Please try again.", 502, { code: "MSG91_HTTP" });
      }
    } catch {
      return apiError("Could not reach the OTP service. Please try again.", 502, { code: "MSG91_UNREACHABLE" });
    }

    if ((mResp.type ?? "").toLowerCase() !== "success") {
      return apiError(mResp.message || "OTP verification failed. Please retry.", 400, { code: "WIDGET_REJECTED" });
    }

    // Verified — issue the register/reset token the same way /otp/verify does.
    const verifyToken = newVerifyToken();
    await prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: "widget-verified", // never compared — the widget did the check
        attempts: 0,
        maxAttempts: 5,
        consumedAt: new Date(),
        verifyToken,
        verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MINUTES * 60 * 1000),
        expiresAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "OTP_VERIFIED",
        entityType: "OTP",
        entityId: phone,
        metadata: { purpose, via: "msg91-widget" },
      },
    }).catch(() => undefined);

    return apiSuccess({ verified: true, verifyToken, expiresInMinutes: VERIFY_TOKEN_TTL_MINUTES });
  } catch (error) {
    return handleApiError(error);
  }
}
