/**
 * Enrollment Number: APYYYYXXXXXX (year + random 6-digit sequence), no
 *                    separators — older rows may still be AP-YYYY-XXXXXX
 *                    until scripts/normalize-enrollment-numbers.ts runs;
 *                    display always goes through formatEnrollmentNumber().
 * Student ID Code:   AP + 6 random digits  →  exactly 8 chars, e.g. AP482731
 *
 * The Student ID shown to students / admins / teachers is `AP` + six random
 * digits. It never encodes the name or the database id, is generated once
 * and stored permanently, and is checked for uniqueness against the DB at
 * creation time (retry on the rare collision). A DB `@unique` on
 * Student.studentIdCode is the final backstop.
 */
import { randomInt } from "crypto";
import type { PrismaClient } from "@prisma/client";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += randomInt(0, 10).toString();
  }
  return out;
}

export function generateEnrollmentNumber(): string {
  const year = new Date().getFullYear();
  return `AP${year}${randomDigits(6)}`;
}

/** An enrollment number as people should see it: separators removed,
 *  upper-case ("AP-2026-123456" → "AP2026123456"). Display only — the stored
 *  value is never rewritten here. */
export function formatEnrollmentNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s\-_/.]+/g, "").toUpperCase();
}

/** The dashed legacy spelling of a dashless number (APYYYYXXXXXX → AP-YYYY-XXXXXX), or null. */
export function legacyEnrollmentSpelling(value: string): string | null {
  const m = /^AP(\d{4})(\d{6})$/.exec(value);
  return m ? `AP-${m[1]}-${m[2]}` : null;
}

/** `AP` + 6 random digits — always exactly 8 characters. Not collision-safe
 *  on its own; prefer generateUniqueStudentIdCode() when a PrismaClient is
 *  available. */
export function generateStudentIdCode(): string {
  return `AP${randomDigits(6)}`;
}

/**
 * A fresh dashless enrollment number that is unused in BOTH spellings — so a
 * new APYYYYXXXXXX can never equal an existing AP-YYYY-XXXXXX once that one
 * is normalised. The DB @unique stays the final backstop.
 */
export async function generateUniqueEnrollmentNumber(client: StudentIdClient, maxTries = 25): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const candidate = generateEnrollmentNumber();
    const legacy = legacyEnrollmentSpelling(candidate);
    const clash = await client.student.findFirst({
      where: { enrollmentNumber: { in: legacy ? [candidate, legacy] : [candidate] } },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a unique enrollment number — try again.");
}

/** Narrowed client — just the one delegate this helper touches, so the real
 *  `prisma` (and a `$transaction` tx client) both satisfy it. */
type StudentIdClient = Pick<PrismaClient, "student">;

/**
 * `AP` + 6 random digits, guaranteed unused. Loops a bounded number of
 * times against Student.studentIdCode; with ~1M keyspace a handful of
 * students makes a collision astronomically unlikely, and any residual
 * race is caught by the unique constraint on the insert.
 */
export async function generateUniqueStudentIdCode(
  client: StudentIdClient,
  maxTries = 25
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const candidate = generateStudentIdCode();
    const clash = await client.student.findUnique({
      where: { studentIdCode: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a unique student ID — try again.");
}
