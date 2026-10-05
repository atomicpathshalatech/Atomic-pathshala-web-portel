import { PrismaClient } from "@prisma/client";
import { generateQuestionId, isValidCanonicalQuestionId } from "./id-generator";

export interface MigrationSummary {
  totalQuestions: number;
  alreadyCanonical: number;
  migratedCount: number;
  failedCount: number;
  migratedIds: Array<{ oldCode: string | null; newCode: string; questionId: string }>;
  errors: string[];
}

/**
 * Concurrency-safe, backward-compatible Canonical Question ID migration engine.
 * Maps legacy 8-digit or unassigned question codes to the 10-character canonical format
 * (P26XXXXXXX, C25XXXXXXX, B24XXXXXXX, M23XXXXXXX, S22XXXXXXX) while preserving
 * legacy identifiers in the question tags/metadata.
 */
export async function migrateLegacyQuestionIds(
  prisma: PrismaClient,
  options: { dryRun?: boolean; limit?: number; subject?: string } = {}
): Promise<MigrationSummary> {
  const { dryRun = false, limit = 500, subject } = options;

  const whereClause: any = {};
  if (subject && subject !== "ALL") {
    whereClause.subject = { equals: subject, mode: "insensitive" };
  }

  const allQuestions = await prisma.question.findMany({
    where: whereClause,
    take: limit,
    select: {
      id: true,
      questionCode: true,
      subject: true,
      tags: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const summary: MigrationSummary = {
    totalQuestions: allQuestions.length,
    alreadyCanonical: 0,
    migratedCount: 0,
    failedCount: 0,
    migratedIds: [],
    errors: [],
  };

  for (const q of allQuestions) {
    if (isValidCanonicalQuestionId(q.questionCode)) {
      summary.alreadyCanonical++;
      continue;
    }

    try {
      // Generate new 10-char canonical Question ID
      const newCanonicalCode = await generateQuestionId(prisma, q.subject);

      if (!dryRun) {
        // Tag with legacy identifier if present for backward lookup
        const legacyTag = q.questionCode ? `LEGACY_ID:${q.questionCode}` : `LEGACY_CUID:${q.id}`;
        const existingTags = q.tags ? q.tags.split(",").map((t) => t.trim()) : [];
        if (!existingTags.includes(legacyTag)) {
          existingTags.push(legacyTag);
        }

        await prisma.question.update({
          where: { id: q.id },
          data: {
            questionCode: newCanonicalCode,
            tags: existingTags.join(", "),
          },
        });
      }

      summary.migratedCount++;
      summary.migratedIds.push({
        oldCode: q.questionCode,
        newCode: newCanonicalCode,
        questionId: q.id,
      });
    } catch (err) {
      summary.failedCount++;
      summary.errors.push(`Failed migrating question ${q.id} (old: ${q.questionCode}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
