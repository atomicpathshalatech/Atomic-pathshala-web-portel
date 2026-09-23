import { createHmac, timingSafeEqual } from "crypto";
import { AUTH_SECRET } from "@/lib/auth-secret";

/**
 * Signed, stateless token that lets OBS's Browser Source (a separate CEF
 * instance with its own cookie jar — it never carries the teacher's normal
 * session cookie) load the read-only /obs-stage/[scheduleId] broadcast page
 * without logging in. Same design as src/lib/integrations/lead-invite.ts:
 * `<base64url(payload)>.<base64url(hmac-sha256 signature)>`, expiry embedded
 * in the payload, no DB row.
 *
 * Scoped to a schedule (not a whiteboard session id) because that's what the
 * teacher already has in hand when starting class, and what the OBS-facing
 * route's own URL segment is — see start/route.ts where this is minted.
 */
export type BroadcastTokenPayload = {
  scheduleId: string;
  teacherUserId: string;
  exp: number; // unix seconds
};

const BROADCAST_TOKEN_TTL_SECONDS = 8 * 60 * 60; // comfortably covers one class + buffer

function sign(payloadB64: string) {
  return createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
}

export function createBroadcastToken(scheduleId: string, teacherUserId: string): string {
  const payload: BroadcastTokenPayload = {
    scheduleId,
    teacherUserId,
    exp: Math.floor(Date.now() / 1000) + BROADCAST_TOKEN_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyBroadcastToken(token: string | null | undefined): BroadcastTokenPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  let expected: string;
  try {
    expected = sign(payloadB64);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: BroadcastTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.scheduleId || !payload.teacherUserId) return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
