/**
 * Enrollment Number: AP-YYYY-XXXXXX (year + random 6-digit sequence)
 * Student ID Code:   APS-XXXXXXXXXX (used on the physical/digital ID card + QR)
 *
 * NOTE: Uses crypto-strength randomness with a DB-level unique constraint as
 * the source of truth. On the rare collision, the caller's unique constraint
 * violation should trigger a retry — acceptable at this scale; move to a
 * sequence-backed generator if collision rates rise in production.
 */
import { randomInt } from "crypto";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += randomInt(0, 10).toString();
  }
  return out;
}

export function generateEnrollmentNumber(): string {
  const year = new Date().getFullYear();
  return `AP-${year}-${randomDigits(6)}`;
}

export function generateStudentIdCode(): string {
  return `APS-${randomDigits(10)}`;
}
