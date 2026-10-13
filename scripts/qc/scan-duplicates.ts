// Read-only: runs the duplicate finder over the Question Bank and prints what it finds.
// Nothing is written.
//   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/qc/scan-duplicates.ts [examplesPerCategory=3]
import "./_stub";
import { prisma } from "../../src/lib/db";
import { findDuplicateCandidates } from "../../src/lib/qc/duplicates";

const examples = Number(process.argv[2]) || 3;

(async () => {
  const rows = await prisma.question.findMany({
    select: { id: true, questionCode: true, subject: true, type: true, imageUrl: true, translations: { select: { language: true, statement: true, options: true, correctOptionIds: true } } },
  });
  const t0 = Date.now();
  const found = findDuplicateCandidates(rows.map((r) => ({ ...r, type: String(r.type) })));
  console.log(`${rows.length} questions, ${found.length} candidate pairs, ${Date.now() - t0} ms`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const counts: Record<string, number> = {};
  for (const c of found) counts[c.category] = (counts[c.category] ?? 0) + 1;
  console.log(JSON.stringify(counts), "different answers:", found.filter((c) => c.sameAnswer === false).length);
  const text = (id: string, lang: string) => {
    const r = byId.get(id)!;
    const t = r.translations.find((x) => x.language.toUpperCase() === lang) ?? r.translations[0]!;
    return `${r.questionCode ?? id} | ${t.statement.replace(/\s+/g, " ").slice(0, 170)} | ${JSON.stringify(t.options).slice(0, 140)} | key ${JSON.stringify(t.correctOptionIds)}`;
  };
  for (const category of Object.keys(counts)) {
    console.log(`\n=== ${category}`);
    for (const c of found.filter((x) => x.category === category).slice(0, examples)) {
      console.log(`- score ${c.score} · ${c.method} · same answer: ${c.sameAnswer} · ${c.note}`);
      console.log("  A:", text(c.questionAId, c.language));
      console.log("  B:", text(c.questionBId, c.language));
    }
  }
  process.exit(0);
})();
