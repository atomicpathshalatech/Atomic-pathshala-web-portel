import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const STAFF_INVITE_TTL_DAYS = 7;

/** A fresh 256-bit token. The raw value goes in the invite URL / email; only
 * its SHA-256 hash is stored, so a DB leak can't be turned into an accepted
 * invitation. */
export function newInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashInviteToken(raw) };
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + STAFF_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildInviteUrl(rawToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://ap.atomicpathshala.in";
  return `${base.replace(/\/$/, "")}/invite/${rawToken}`;
}

export type InviteLookup =
  | { ok: true; invitation: NonNullable<Awaited<ReturnType<typeof findInviteByRawToken>>> }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" };

async function findInviteByRawToken(raw: string) {
  return prisma.staffInvitation.findUnique({
    where: { tokenHash: hashInviteToken(raw) },
  });
}

/**
 * Server-side validation shared by the "open the link" and "submit the form"
 * routes. An invitation is usable only while PENDING or OPENED and not past
 * `expiresAt`.
 */
export async function validateInviteToken(raw: string): Promise<InviteLookup> {
  if (!raw || raw.length < 32) return { ok: false, reason: "NOT_FOUND" };
  const invitation = await findInviteByRawToken(raw);
  if (!invitation) return { ok: false, reason: "NOT_FOUND" };
  if (invitation.status === "SUBMITTED" || invitation.status === "APPROVED") {
    return { ok: false, reason: "ALREADY_USED" };
  }
  if (invitation.status === "REJECTED" || invitation.status === "EXPIRED") {
    return { ok: false, reason: "EXPIRED" };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "EXPIRED" };
  }
  return { ok: true, invitation };
}
