/**
 * Enrollment Number: AP-YYYY-XXXXXX (year + random 6-digit sequence)
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
  return `AP-${year}-${randomDigits(6)}`;
}

/** `AP` + 6 random digits — always exactly 8 characters. Not collision-safe
 *  on its own; prefer generateUniqueStudentIdCode() when a PrismaClient is
 *  available. */
export function generateStudentIdCode(): string {
  return `AP${randomDigits(6)}`;
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
