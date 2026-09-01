import "server-only";
import { PrismaClient } from "@prisma/client";

const CODE_PREFIX = "TS";
const CODE_DIGITS = 4;

/**
 * Generates the next unique TestSeries code (e.g. TS0001, TS0002, ...).
 * Same check-then-use approach as `@/lib/dpp/code.ts` — not a strict
 * monotonic sequence, but every code returned is verified unique, and the
 * create route retries on a unique-constraint conflict as a backstop.
 */
export async function generateTestSeriesCode(prisma: Pick<PrismaClient, "testSeries">): Promise<string> {
  const MAX_ATTEMPTS = 5;
  const base = await prisma.testSeries.count();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${CODE_PREFIX}${String(base + attempt + 1).padStart(CODE_DIGITS, "0")}`;
    const existing = await prisma.testSeries.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  return `${CODE_PREFIX}${Date.now().toString().slice(-6)}`;
}
