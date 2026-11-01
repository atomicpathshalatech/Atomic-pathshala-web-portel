import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { generateOtp, hashOtp, OTP_TTL_MINUTES } from "@/lib/otp";

/**
 * Log in with a one-time code.
 *
 *   - Email: our own code, kept in otp_challenges under the key
 *     "login:<userId>" (never a phone number, so the password-reset flow —
 *     which looks challenges up by phone — can't consume it). Stored with
 *     purpose PASSWORD_RESET only because the purpose is a database enum;
 *     the key is what keeps the two apart.
 *   - SMS: MSG91's OTP widget sends and checks the code (as at
 *     registration); the access token it returns is confirmed with MSG91
 *     here and must belong to the account's own mobile number.
 */

const LOGIN_PURPOSE = "PASSWORD_RESET" as const;
export const loginOtpKey = (userId: string) => `login:${userId}`;

/** a***@gmail.com — enough for the student to know where to look. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(1, Math.min(5, name.length - 1)))}@${domain}`;
}

export async function sendLoginEmailCode(user: { id: string; email: string; name: string | null }, ipHash: string | null): Promise<boolean> {
  const code = generateOtp();
  await prisma.otpChallenge.create({
    data: {
      phone: loginOtpKey(user.id),
      ipHash,
      purpose: LOGIN_PURPOSE,
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  const mail = await sendMail({
    to: user.email,
    subject: `${code} is your Atomic Pathshala login code`,
    text: `Your Atomic Pathshala login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't try to log in, ignore this email.`,
    html: `<p>Hi ${user.name ? escapeHtml(user.name) : "there"},</p><p>Your Atomic Pathshala login code is</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you didn't try to log in, ignore this email.</p>`,
  });
  return mail.delivered;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Checks the latest email code of this user; returns its id when right (a
 * wrong code counts as an attempt). It is used up separately, once the
 * sign-in has really happened — a "replace your other device?" retry needs
 * the same code again.
 */
export async function checkLoginEmailCode(userId: string, code: string): Promise<string | null> {
  if (!/^\d{4,8}$/.test(code)) return null;
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone: loginOtpKey(userId), purpose: LOGIN_PURPOSE, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt.getTime() < Date.now() || challenge.attempts >= challenge.maxAttempts) return null;
  if (await bcrypt.compare(code, challenge.codeHash)) return challenge.id;
  const attempts = challenge.attempts + 1;
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts, ...(attempts >= challenge.maxAttempts ? { consumedAt: new Date() } : {}) },
  });
  return null;
}

/** The code did its job: it can't be used again. */
export async function consumeLoginEmailCode(challengeId: string) {
  await prisma.otpChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } }).catch(() => undefined);
}

/**
 * Confirms an MSG91 widget access token and that it was issued for this
 * mobile number (MSG91 returns the verified identifier, e.g. 919812345670,
 * in `message`). Anything else — wrong number, no number, MSG91 down — fails.
 */
export async function msg91TokenIsForPhone(accessToken: string, phone10: string): Promise<boolean> {
  const authkey = process.env.MSG91_WIDGET_AUTHKEY?.trim();
  if (!authkey || !accessToken) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey, "access-token": accessToken }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || (body.type ?? "").toLowerCase() !== "success") return false;
    const digits = String(body.message ?? "").replace(/\D/g, "");
    return digits.length >= 10 && digits.endsWith(phone10);
  } catch {
    return false;
  }
}
