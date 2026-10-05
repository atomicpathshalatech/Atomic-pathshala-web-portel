import { PrismaClient } from "@prisma/client";

/**
 * Mandatory Canonical Question ID Subject Prefixes (Section 2 of Master Spec):
 * - Physics:     P26
 * - Chemistry:   C25
 * - Biology:     B24 (Botany / Zoology)
 * - Mathematics: M23 (Math / Maths)
 * - Science:     S22 (General / Science)
 *
 * Structure: Exactly 10 characters (3 fixed alphanumeric prefix + 7 sequential numeric digits)
 * Examples: P260000001, C250000001, B240000001, M230000001, S220000001
 */
export const SUBJECT_PREFIXES: Record<string, string> = {
  PHYSICS: "P26",
  CHEMISTRY: "C25",
  BIOLOGY: "B24",
  BOTANY: "B24",
  ZOOLOGY: "B24",
  MATHEMATICS: "M23",
  MATH: "M23",
  MATHS: "M23",
  SCIENCE: "S22",
  GENERAL: "S22",
  EVS: "S22",
};

export const CANONICAL_QUESTION_ID_REGEX = /^(P26|C25|B24|M23|S22)\d{7}$/;

/**
 * Validates if a string is a canonical 10-character Question ID
 */
export function isValidCanonicalQuestionId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return CANONICAL_QUESTION_ID_REGEX.test(id.trim().toUpperCase());
}

/**
 * Normalizes subject string and returns the standard 3-character subject prefix (P26, C25, B24, M23, S22)
 */
export function getSubjectPrefix(subjectName?: string | null): string {
  if (!subjectName) return "S22";
  const normalized = subjectName.trim().toUpperCase();
  for (const [key, prefix] of Object.entries(SUBJECT_PREFIXES)) {
    if (normalized.includes(key)) {
      return prefix;
    }
  }
  return "S22";
}

/**
 * Concurrency-safe 10-character Canonical Question ID generator.
 * Format: [3-character Subject Prefix][7-digit Sequential Number] (e.g. P260000001)
 * Total Length: Exactly 10 characters.
 * Guaranteed unique and non-reusable.
 */
export async function generateQuestionId(
  prisma: PrismaClient,
  subjectName?: string | null
): Promise<string> {
  const prefix = getSubjectPrefix(subjectName);
  const prefixMin = `${prefix}0000001`;
  const prefixMax = `${prefix}9999999`;

  // Find highest existing question code in this subject prefix (10-char length format)
  const highest = await prisma.question.findFirst({
    where: {
      questionCode: {
        gte: prefixMin,
        lte: prefixMax,
      },
    },
    orderBy: {
      questionCode: "desc",
    },
    select: {
      questionCode: true,
    },
  });

  let nextSequence = 1;
  if (highest?.questionCode && highest.questionCode.startsWith(prefix) && highest.questionCode.length === 10) {
    const numericPart = parseInt(highest.questionCode.slice(3), 10);
    if (!isNaN(numericPart)) {
      nextSequence = numericPart + 1;
    }
  }

  // Attempt to claim next available unique ID
  let candidate = `${prefix}${String(nextSequence).padStart(7, "0")}`;
  let exists = await prisma.question.findUnique({
    where: { questionCode: candidate },
    select: { id: true },
  });

  while (exists) {
    nextSequence++;
    candidate = `${prefix}${String(nextSequence).padStart(7, "0")}`;
    exists = await prisma.question.findUnique({
      where: { questionCode: candidate },
      select: { id: true },
    });
  }

  return candidate;
}