/**
 * Question System audit — READ-ONLY by default.
 *
 *   npx tsx scripts/question-audit.ts                 # report only, changes nothing
 *   npx tsx scripts/question-audit.ts --backfill-codes  # give an 8-digit Question ID to questions that have none
 *   npx tsx scripts/question-audit.ts --link-ai-drafts  # link AI batch questions to their auto-created draft
 *
 * Nothing is ever deleted or overwritten: the two options only fill EMPTY
 * fields (questionCode = NULL, draftQuestionId = NULL). Take a database
 * backup before running either option. The report is also written to
 * question-audit-report.json.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { withNewQuestionCode } from "../src/lib/questions/create-with-code";

const args = new Set(process.argv.slice(2));
const norm = (t?: string | null) => (t || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function main() {
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), mode: args.size ? Array.from(args) : ["report-only"] };

  // 1. Question IDs
  const total = await prisma.question.count();
  const noCode = await prisma.question.findMany({ where: { questionCode: null }, select: { id: true, subject: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  report.questions = { total, withoutQuestionId: noCode.length };

  // 2. Publish flags out of step (they block DPP attach / show as unapproved)
  const [pubNotStatus, statusNotPub] = await Promise.all([
    prisma.question.count({ where: { isPublished: true, NOT: { status: "PUBLISHED" } } }),
    prisma.question.count({ where: { status: "PUBLISHED", isPublished: false } }),
  ]);
  report.publishFlags = { isPublishedButStatusNotPublished: pubNotStatus, statusPublishedButNotIsPublished: statusNotPub };

  // 3. Exact duplicate questions (same subject + same statement text) — reported, never removed
  const rows = await prisma.question.findMany({
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      status: true,
      tags: true,
      createdAt: true,
      translations: { select: { language: true, statement: true } },
      _count: { select: { sectionLinks: true, dppLinks: true, answers: true } },
    },
  });
  const groups = new Map<string, typeof rows>();
  for (const q of rows) {
    const st = q.translations.find((t) => t.language === "ENGLISH")?.statement ?? q.translations[0]?.statement;
    const k = norm(st);
    if (k.length < 25) continue;
    const key = `${norm(q.subject)}|${k}`;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const dupGroups = Array.from(groups.values()).filter((g) => g.length > 1);
  report.duplicates = {
    groups: dupGroups.length,
    extraCopies: dupGroups.reduce((n, g) => n + g.length - 1, 0),
    aiAutoDraftCopies: dupGroups.reduce((n, g) => n + g.filter((q) => (q.tags || "").includes("AI_AUTO_DRAFT")).length, 0),
    sample: dupGroups.slice(0, 25).map((g) =>
      g.map((q) => ({
        id: q.id,
        questionCode: q.questionCode,
        status: q.status,
        usedInTests: q._count.sectionLinks,
        usedInDpps: q._count.dppLinks,
        studentAnswers: q._count.answers,
        aiAutoDraft: (q.tags || "").includes("AI_AUTO_DRAFT"),
        createdAt: q.createdAt,
      }))
    ),
  };

  // 4. Questions that can't be used as-is
  report.incomplete = {
    noTranslation: rows.filter((q) => q.translations.length === 0).length,
  };

  // 5. AI batch questions not linked to their draft
  const unlinked = await prisma.aiGeneratedQuestion.findMany({
    where: { draftQuestionId: null },
    select: { id: true, batchId: true, statementEn: true, statementHi: true, subject: true },
  });
  report.aiBatches = {
    unlinkedGeneratedQuestions: unlinked.length,
    stuckProcessing: await prisma.aiGenerationBatch.count({ where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } } }),
  };

  // 6. Extraction jobs
  report.extraction = {
    stuckProcessing: await prisma.extractionJob.count({ where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } } }),
    jobsWithoutStoredPdf: await prisma.extractionJob.count({ where: { fileUrl: { startsWith: "/uploads/extraction/" } } }),
    importedRowsWithoutDraft: await prisma.extractedQuestion.count({ where: { status: "IMPORTED", draftQuestionId: null } }),
    stuckImporting: await prisma.extractedQuestion.count({ where: { status: "IMPORTING" } }),
  };

  // --- Optional, additive fixes ---
  if (args.has("--backfill-codes")) {
    let n = 0;
    for (const q of noCode) {
      await withNewQuestionCode(q.subject, (code) =>
        prisma.question.updateMany({ where: { id: q.id, questionCode: null }, data: { questionCode: code } })
      );
      n++;
    }
    report.backfilledQuestionIds = n;
  }

  if (args.has("--link-ai-drafts")) {
    let linked = 0;
    for (const g of unlinked) {
      const key = norm(g.statementEn || g.statementHi);
      if (key.length < 25) continue;
      const candidates = await prisma.question.findMany({
        where: { tags: { contains: `BATCH_${g.batchId}` } },
        select: { id: true, translations: { select: { statement: true } } },
      });
      const match = candidates.find((c) => c.translations.some((t) => norm(t.statement) === key));
      if (match) {
        const r = await prisma.aiGeneratedQuestion.updateMany({ where: { id: g.id, draftQuestionId: null }, data: { draftQuestionId: match.id, isSavedToDraft: true } });
        linked += r.count;
      }
    }
    report.linkedAiDrafts = linked;
  }

  writeFileSync("question-audit-report.json", JSON.stringify(report, null, 2));
  const { sample, ...dupSummary } = report.duplicates as Record<string, unknown>;
  void sample;
  console.log(JSON.stringify({ ...report, duplicates: dupSummary }, null, 2));
  console.log("\nFull report (with duplicate samples): question-audit-report.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
