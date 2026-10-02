import "server-only";
import { prisma } from "@/lib/db";

/** Next DPP number for a subject + chapter (1, 2, 3 …). */
export async function nextDppNumber(subject: string, chapter: string): Promise<number> {
  const agg = await prisma.dpp.aggregate({
    where: {
      subject: { equals: subject, mode: "insensitive" },
      chapter: { equals: chapter, mode: "insensitive" },
    },
    _max: { dppNumber: true },
    _count: true,
  });
  return Math.max(agg._max.dppNumber ?? 0, agg._count) + 1;
}
