import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Requests from the Sheet's Apps Script carry
 *   x-atomic-timestamp: unix seconds
 *   x-atomic-signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}` with LECTURE_SHEET_WEBHOOK_SECRET
 * A request older than five minutes (or from the future) is refused, so a
 * captured request cannot be replayed later. Applying the same link twice
 * changes nothing (see applyVideoMapping), so a replay within the window is harmless.
 */
export const MAX_SKEW_SECONDS = 300;

export function signBody(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifySignedRequest(args: { secret: string | undefined; timestamp: string | null; signature: string | null; rawBody: string; nowSeconds?: number }):
  | { ok: true }
  | { ok: false; reason: string } {
  if (!args.secret) return { ok: false, reason: "webhook secret is not configured on the server" };
  if (!args.timestamp || !/^\d{9,11}$/.test(args.timestamp)) return { ok: false, reason: "missing timestamp" };
  if (!args.signature || !/^[a-f0-9]{64}$/i.test(args.signature)) return { ok: false, reason: "missing signature" };
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(args.timestamp)) > MAX_SKEW_SECONDS) return { ok: false, reason: "request too old" };
  const expected = Buffer.from(signBody(args.secret, args.timestamp, args.rawBody), "hex");
  const given = Buffer.from(args.signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "bad signature" };
  return { ok: true };
}
