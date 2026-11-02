/**
 * Pure helpers for the ID cards — no DB, no Node APIs, safe on the client and
 * covered by scripts/test-id-cards.ts.
 */

export type IdCardKindName = "STUDENT" | "TEAM";

/** Public verification tokens are 22-char base64url (128 random bits). */
export const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function isValidPublicToken(token: string | null | undefined): token is string {
  return typeof token === "string" && PUBLIC_TOKEN_RE.test(token);
}

/** "15 Apr 1998" in IST, the way every date on the card reads. */
export function formatCardDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

/**
 * Academic year shown on a student card. A batch with dates uses them
 * (2026–2027); otherwise the Indian academic session (April–March) that the
 * given date falls in.
 */
export function academicYearLabel(opts: { batchStart?: Date | null; batchEnd?: Date | null; fallbackDate?: Date | null }): string {
  const { batchStart, batchEnd } = opts;
  if (batchStart && batchEnd) {
    const a = batchStart.getUTCFullYear();
    const b = batchEnd.getUTCFullYear();
    return a === b ? `${a}–${a + 1}` : `${a}–${b}`;
  }
  const d = batchStart ?? opts.fallbackDate ?? new Date();
  // IST month — a batch starting 1 Apr 00:00 IST is 31 Mar in UTC.
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}–${start + 1}`;
}

/** Enrollment number for the public verify page: first 6 and last 2 visible ("AP2026••••56"). */
export function maskIdentifier(value: string): string {
  const v = value.replace(/[\s\-_/.]+/g, "").toUpperCase();
  if (v.length <= 6) return v.slice(0, 2) + "•".repeat(Math.max(0, v.length - 2));
  const keepEnd = v.length >= 10 ? 2 : 1;
  return v.slice(0, 6) + "•".repeat(v.length - 6 - keepEnd) + v.slice(v.length - keepEnd);
}

/** Card name size by length, so long names stay on (at most) two lines instead of overflowing. */
export function nameFontPx(name: string): number {
  const n = name.trim().length;
  if (n <= 12) return 21;
  if (n <= 16) return 18.5;
  if (n <= 22) return 16;
  if (n <= 30) return 14;
  return 12.5;
}

/** Row value size: long emails / batch names shrink a step and may wrap to a second line. */
export function rowValueFontPx(value: string, base: number): number {
  const n = value.length;
  if (n <= 20) return base;
  if (n <= 26) return base - 0.6;
  if (n <= 34) return base - 1.2;
  return base - 1.8;
}

export type VerificationState = "ACTIVE" | "REVOKED" | "INACTIVE" | "ALUMNI";

/**
 * What the public verify page says. A revoked card is never valid; a card of
 * someone who is no longer active never shows as active.
 */
export function verificationState(input: {
  kind: IdCardKindName;
  cardStatus: "ACTIVE" | "REVOKED";
  userStatus: string;
  hasRole: boolean;
  studentStatus?: string | null;
}): VerificationState {
  if (input.cardStatus === "REVOKED") return "REVOKED";
  if (input.userStatus !== "ACTIVE") return "INACTIVE";
  if (input.kind === "TEAM") return input.hasRole ? "ACTIVE" : "INACTIVE";
  if (input.studentStatus === "GRADUATED") return "ALUMNI";
  if (input.studentStatus && input.studentStatus !== "ACTIVE") return "INACTIVE";
  return "ACTIVE";
}

export const VERIFICATION_COPY: Record<VerificationState, { title: string; tone: "ok" | "warn" | "bad" }> = {
  ACTIVE: { title: "Verified — active", tone: "ok" },
  ALUMNI: { title: "Verified — former student (alumni)", tone: "warn" },
  INACTIVE: { title: "Not active — no longer affiliated", tone: "bad" },
  REVOKED: { title: "This ID card has been revoked", tone: "bad" },
};

/** Only http(s) image URLs ever reach the card markup. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
