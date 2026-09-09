import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/db";
import type { OtpPurpose } from "@prisma/client";

export const OTP_TTL_MINUTES = 5;
export const RESEND_COOLDOWN_SECONDS = 45;
export const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
export const MAX_SENDS_PER_IP_PER_HOUR = 15;
export const MAX_VERIFY_ATTEMPTS = 5;
export const VERIFY_TOKEN_TTL_MINUTES = 15;

export const PHONE_RE = /^[6-9]\d{9}$/;

export function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function newVerifyToken(): string {
  return randomBytes(24).toString("hex");
}

/** Returns null if allowed, or a { retryAfter, message } when rate-limited. */
export async function checkSendRateLimit(
  phone: string,
  ipHash: string | null
): Promise<{ retryAfter: number; message: string } | null> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);

  const [lastForPhone, phoneCount, ipCount] = await Promise.all([
    prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.otpChallenge.count({ where: { phone, createdAt: { gte: hourAgo } } }),
    ipHash
      ? prisma.otpChallenge.count({ where: { ipHash, createdAt: { gte: hourAgo } } })
      : Promise.resolve(0),
  ]);

  if (lastForPhone) {
    const since = (now - lastForPhone.createdAt.getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SECONDS) {
      return {
        retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - since),
        message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - since)}s before requesting another code.`,
      };
    }
  }
  if (phoneCount >= MAX_SENDS_PER_PHONE_PER_HOUR) {
    return { retryAfter: 3600, message: "Too many codes requested for this number. Try again later." };
  }
  if (ipCount >= MAX_SENDS_PER_IP_PER_HOUR) {
    return { retryAfter: 3600, message: "Too many requests from this device. Try again later." };
  }
  return null;
}

/**
 * Consume a verify token: it must belong to a verified (consumedAt set),
 * un-expired challenge for this phone + purpose, and not already spent.
 * On success the token is nulled so it can't be replayed.
 */
export async function consumeVerifyToken(
  phone: string,
  purpose: OtpPurpose,
  verifyToken: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!verifyToken || verifyToken.length < 20) return { ok: false, reason: "Invalid verification." };
  const row = await prisma.otpChallenge.findUnique({ where: { verifyToken } });
  if (!row || row.phone !== phone || row.purpose !== purpose || !row.consumedAt) {
    return { ok: false, reason: "Phone verification not found — request a new code." };
  }
  if (!row.verifyTokenExpiresAt || row.verifyTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "Verification expired — request a new code." };
  }
  await prisma.otpChallenge.update({
    where: { id: row.id },
    data: { verifyToken: null, verifyTokenExpiresAt: null },
  });
  return { ok: true };
}
