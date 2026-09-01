import "server-only";
import { PrismaClient } from "@prisma/client";

const RANGE_START = 600000;
const RANGE_SIZE = 100000; // 600000-699999

/**
 * Generates the next unique 6-digit Chapter ID, always starting with "6",
 * independent of every other entity's id/code sequence (per the spec).
 * Same check-then-use approach as the Dpp/TestSeries code generators —
 * not a strict monotonic sequence, but every value returned is verified
 * unique, and the create route retries on a unique-constraint conflict as
 * a backstop. Falls back to a timestamp-derived value within the same
 * 600000-699999 range if the sequential slot is already taken repeatedly
 * (e.g. concurrent creates).
 */
export async function generateChapterId(prisma: Pick<PrismaClient, "chapter">): Promise<string> {
  const MAX_ATTEMPTS = 5;
  const base = await prisma.chapter.count();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = String(RANGE_START + ((base + attempt) % RANGE_SIZE));
    const existing = await prisma.chapter.findUnique({ where: { chapterId: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  const fallback = RANGE_START + (Date.now() % RANGE_SIZE);
  return String(fallback);
}
