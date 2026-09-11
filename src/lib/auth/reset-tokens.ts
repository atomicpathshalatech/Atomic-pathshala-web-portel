import "server-only";
import crypto from "crypto";

/**
 * Email password-reset tokens. The raw token goes in the emailed link; only
 * its SHA-256 hash is stored on User.passwordResetToken, so a database
 * leak can't be used to reset anyone's password. Single-use (cleared on
 * successful reset) and short-lived.
 */
export const RESET_TTL_MINUTES = 60;

export function newResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw.trim()).digest("hex");
}

export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TTL_MINUTES * 60 * 1000);
}

export function buildResetUrl(rawToken: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://ap.atomicpathshala.in"
  ).replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

// Very small in-memory throttle so the forgot-password endpoint can't be
// used to spam an inbox or enumerate accounts by timing.
const hits = new Map<string, { n: number; resetAt: number }>();
export function forgotPasswordRateOk(key: string): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.resetAt) {
    hits.set(key, { n: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (e.n >= 4) return false;
  e.n++;
  return true;
}
