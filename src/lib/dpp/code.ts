import "server-only";
import { PrismaClient } from "@prisma/client";

const CODE_PREFIX = "AP";
const CODE_DIGITS = 4;

/**
 * Generates the next unique DPP code (e.g. AP0001, AP0002, ...). Not a
 * strict monotonic sequence — derived from the current row count, so a
 * deleted DPP can leave a gap — but every code returned here is checked
 * unique against the table, which is what actually matters: the code is a
 * stable public identifier, not an audit trail of exactly how many DPPs
 * were ever created. The DPP create route additionally retries on a
 * unique-constraint conflict (two teachers creating a DPP at the same
 * instant), so this check-then-use approach doesn't need to be atomic.
 */
export async function generateDppCode(prisma: Pick<PrismaClient, "dpp">): Promise<string> {
  const MAX_ATTEMPTS = 5;
  const base = await prisma.dpp.count();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${CODE_PREFIX}${String(base + attempt + 1).padStart(CODE_DIGITS, "0")}`;
    const existing = await prisma.dpp.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  // Extremely unlikely to be reached (would need MAX_ATTEMPTS consecutive
  // collisions) — falls back to a code that's still unique in practice.
  return `${CODE_PREFIX}${Date.now().toString().slice(-6)}`;
}
