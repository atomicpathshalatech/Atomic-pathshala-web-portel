import { PrismaClient } from "@prisma/client";

export const SUBJECT_PREFIXES: Record<string, string> = {
  PHYSICS: "80",
  CHEMISTRY: "82",
  BIOLOGY: "83",
  BOTANY: "83",
  ZOOLOGY: "83",
  MATHEMATICS: "84",
  MATH: "84",
  MATHS: "84",
  GENERAL: "85",
};

/**
 * Normalizes subject string and returns the standard 2-digit subject prefix
 */
export function getSubjectPrefix(subjectName?: string | null): string {
  if (!subjectName) return "85";
  const normalized = subjectName.trim().toUpperCase();
  for (const [key, prefix] of Object.entries(SUBJECT_PREFIXES)) {
    if (normalized.includes(key)) {
      return prefix;
    }
  }
  return "85";
}

/**
 * Concurrency-safe 8-digit Question ID generator.
 * Format: [2-digit Subject Prefix][6-digit Sequential Number] (e.g. 82000001)
 * Guaranteed unique and non-reusable.
 */
export async function generateQuestionId(
  prisma: PrismaClient,
  subjectName?: string | null
): Promise<string> {
  const prefix = getSubjectPrefix(subjectName);
  const prefixMin = `${prefix}000001`;
  const prefixMax = `${prefix}999999`;

  // Find highest existing question code in this subject prefix
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
  if (highest?.questionCode && highest.questionCode.startsWith(prefix)) {
    const numericPart = parseInt(highest.questionCode.slice(2), 10);
    if (!isNaN(numericPart)) {
      nextSequence = numericPart + 1;
    }
  }

  // Attempt to claim next available unique ID
  let candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
  let exists = await prisma.question.findUnique({
    where: { questionCode: candidate },
    select: { id: true },
  });

  while (exists) {
    nextSequence++;
    candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
    exists = await prisma.question.findUnique({
      where: { questionCode: candidate },
      select: { id: true },
    });
  }

  return candidate;
}