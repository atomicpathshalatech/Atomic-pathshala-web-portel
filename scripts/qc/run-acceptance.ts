// Acceptance run of the QC pipeline against the hand-written cases (cases.ts),
// with the real models. Needs the Gemini key(s) in the environment:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/qc/run-acceptance.ts [outFile.json] [filter]
import "./_stub";
import { writeFileSync } from "node:fs";
import { QC_CASES } from "./cases";
import { derivedLabel } from "../../src/lib/qc/decide";
import { callQcModel } from "../../src/lib/qc/model";
import { QcReviewError, reviewQuestion } from "../../src/lib/qc/review";

const outFile = process.argv[2];
const filter = process.argv[3];

(async () => {
  const cases = filter ? QC_CASES.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase())) : QC_CASES;
  const rows: Record<string, unknown>[] = [];
  let correct = 0;
  let errors = 0;
  let inTok = 0;
  let outTok = 0;
  const started = Date.now();

  const CONCURRENCY = 3;
  let next = 0;
  async function worker() {
    while (next < cases.length) {
      const c = cases[next++]!;
      const t0 = Date.now();
      try {
        const r = await reviewQuestion(c.q, "REFERENCE PASSAGES: none supplied in this test.", callQcModel);
        const got = r.decision.status;
        const ok = c.expect === "CLEAN" ? got === "VERIFIED" : got !== "VERIFIED";
        const answerOk = !c.rightAnswer || (r.expert.output.derivedAnswer.optionKeys.join(",") === c.rightAnswer && r.director.solve.derivedAnswer.optionKeys.join(",") === c.rightAnswer);
        if (ok) correct++;
        for (const u of r.usage) {
          inTok += u.inputTokens ?? 0;
          outTok += u.outputTokens ?? 0;
        }
        rows.push({
          name: c.name,
          expect: c.expect,
          got,
          ok,
          answerOk,
          expertAnswer: derivedLabel(r.expert.output.derivedAnswer),
          directorAnswer: derivedLabel(r.director.solve.derivedAnswer),
          expertModel: r.expert.model,
          directorModel: r.director.model,
          expertStatus: r.expertStatus.status,
          expertFindings: r.expert.output.findings.map((f) => `${f.category}/${f.severity}`),
          verdicts: r.director.audit.verdicts.map((v) => `${v.finding}:${v.decision}`),
          directorFindings: [...r.director.solve.findings, ...r.director.audit.additionalFindings].map((f) => `${f.category}/${f.severity}`),
          structural: r.structural.map((f) => f.category),
          calc: [...r.expert.calc, ...r.director.solveCalc].map((x) => `${x.expression}=${x.computedValue ?? "?"}${x.agrees === false ? " ≠ claimed " + x.claimedValue : ""}`),
          corrections: r.corrections.map((x) => `${x.field}→${x.proposedValue.slice(0, 60)}`),
          reasons: r.decision.reasons,
          ms: Date.now() - t0,
          tokens: r.usage.reduce((n, u) => n + (u.inputTokens ?? 0) + (u.outputTokens ?? 0), 0),
        });
        console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  → ${got}  (expert ${derivedLabel(r.expert.output.derivedAnswer)}, director ${derivedLabel(r.director.solve.derivedAnswer)}; ${Math.round((Date.now() - t0) / 1000)} s)`);
      } catch (err) {
        errors++;
        const stage = err instanceof QcReviewError ? err.stage : "?";
        rows.push({ name: c.name, expect: c.expect, got: "ERROR", ok: false, stage, error: String(err instanceof Error ? err.message : err).slice(0, 300) });
        console.log(`ERROR ${c.name} [${stage}] ${String(err instanceof Error ? err.message : err).slice(0, 200)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  rows.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const summary = { cases: cases.length, correct, wrong: cases.length - correct - errors, errors, inputTokens: inTok, outputTokens: outTok, seconds: Math.round((Date.now() - started) / 1000) };
  console.log(JSON.stringify(summary));
  if (outFile) writeFileSync(outFile, JSON.stringify({ summary, rows }, null, 2));
  process.exit(0);
})();
