// Reviews a small sample of real Question Bank rows and prints what it cost.
// It stores QC reviews and the QC status (that is what the feature does); it
// never edits a question's content.
//   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/qc/run-sample.ts [perSubject=3] [outFile.json]
import "./_stub";
import { writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/db";
import { runQcForQuestion } from "../../src/lib/qc/pipeline";

const perSubject = Number(process.argv[2]) || 3;
const outFile = process.argv[3];

(async () => {
  const subjects = await prisma.question.groupBy({ by: ["subject"], _count: { _all: true } });
  const ids: { id: string; subject: string; code: string | null }[] = [];
  for (const s of subjects) {
    const rows = await prisma.question.findMany({
      where: { subject: s.subject, status: "PUBLISHED", OR: [{ qcStatus: "UNREVIEWED" }, { qcStatus: null }] },
      orderBy: { createdAt: "asc" },
      take: perSubject,
      select: { id: true, subject: true, questionCode: true },
    });
    ids.push(...rows.map((r) => ({ id: r.id, subject: r.subject, code: r.questionCode })));
  }
  console.log(`Reviewing ${ids.length} published questions…`);

  const started = Date.now();
  const rows: Record<string, unknown>[] = [];
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const q = ids[next++]!;
      const t0 = Date.now();
      const r = await runQcForQuestion(q.id, null);
      const seconds = Math.round((Date.now() - t0) / 1000);
      rows.push({ ...q, ...r, seconds });
      console.log(`${r.status.padEnd(18)} ${q.subject.padEnd(10)} ${q.code ?? q.id}  ${seconds} s  findings ${r.findings ?? "-"}  corrections ${r.corrections ?? "-"}${r.message ? "  " + r.message.slice(0, 160) : ""}`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));

  const usage = await prisma.aiUsageLog.aggregate({ where: { questionId: { in: ids.map((i) => i.id) } }, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[String(r.status)] = (counts[String(r.status)] ?? 0) + 1;
  const summary = { questions: ids.length, counts, wallSeconds: Math.round((Date.now() - started) / 1000), modelCalls: usage._count._all, inputTokens: usage._sum.inputTokens, outputTokens: usage._sum.outputTokens };
  console.log(JSON.stringify(summary));
  if (outFile) writeFileSync(outFile, JSON.stringify({ summary, rows }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
