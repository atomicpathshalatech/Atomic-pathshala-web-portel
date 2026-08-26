import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed "magic link" that lets the outreach CRM send a qualified lead
 * straight to the real /register page with their details and chosen
 * course/batch pre-filled — instead of the integration API fabricating a
 * Student record from partial data (no father's name, DOB, school, etc.
 * exist in the CRM). The token carries everything registration needs to
 * auto-enroll the student into the right batch once they finish the real
 * form; it is never trusted on its own to create an account.
 *
 * Format: `<base64url(payload json)>.<base64url(hmac-sha256 signature)>`.
 * Stateless by design — no DB row, no cleanup job; expiry is just a field
 * inside the signed payload.
 */
export type LeadInvitePayload = {
  name: string;
  email: string;
  mobile: string;
  courseSlug: string;
  courseTitle: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  counselorNotes?: string;
  exp: number; // unix seconds
};

const INVITE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days — long enough for a lead to act on a call follow-up

function getSecret() {
  const secret = process.env.LEAD_INVITE_SECRET;
  if (!secret) {
    throw new Error("LEAD_INVITE_SECRET is not configured on the server.");
  }
  return secret;
}

function sign(payloadB64: string) {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function createLeadInviteToken(payload: Omit<LeadInvitePayload, "exp">) {
  const full: LeadInvitePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = sign(payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt: new Date(full.exp * 1000) };
}

export function verifyLeadInviteToken(token: string): LeadInvitePayload | null {
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

  let payload: LeadInvitePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
