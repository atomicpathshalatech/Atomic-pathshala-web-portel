/**
 * Live check of the AI question generator: asks Gemini for every question type
 * (one question each) and reports, per type, whether it came back in its format
 * and — for visual types — whether its figure could be drawn. Costs a few
 * Gemini calls. Needs GEMINI_API_KEY(S); uses no database.
 *
 *   AIQ_OUT=dir npx tsx --tsconfig tsconfig.json scripts/test-ai-question-types-live.ts [TYPE ...]
 */
import Module from "node:module";
import path from "node:path";
const orig = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return path.join(__dirname, "fixtures/empty-module.cjs");
  return orig.call(this, req, ...a);
};

const CASES: { type: string; subject: string; chapter: string; topics: string[] }[] = [
  { type: "SINGLE_CORRECT", subject: "Biology", chapter: "Cell: The Unit of Life", topics: ["Cell Organelles"] },
  { type: "ASSERTION_REASON", subject: "Physics", chapter: "Current Electricity", topics: ["Ohm's Law"] },
  { type: "TWO_STATEMENT", subject: "Chemistry", chapter: "Chemical Bonding and Molecular Structure", topics: ["Hybridisation"] },
  { type: "MULTI_STATEMENT_COMBINATION", subject: "Biology", chapter: "Photosynthesis in Higher Plants", topics: ["Light Reaction"] },
  { type: "CORRECT_INCORRECT_STATEMENT", subject: "Biology", chapter: "Human Health and Disease", topics: ["Immunity"] },
  { type: "MATCH_THE_FOLLOWING", subject: "Biology", chapter: "Chemical Coordination and Integration", topics: ["Hormones"] },
  { type: "COLUMN_MATCHING", subject: "Chemistry", chapter: "Chemical Bonding and Molecular Structure", topics: ["VSEPR Theory"] },
  { type: "SEQUENCE_ARRANGEMENT", subject: "Biology", chapter: "Cell Cycle and Cell Division", topics: ["Meiosis"] },
  { type: "DIAGRAM_BASED", subject: "Chemistry", chapter: "Organic Chemistry: Some Basic Principles and Techniques", topics: ["IUPAC Nomenclature"] },
  { type: "DIAGRAM_BASED", subject: "Physics", chapter: "Ray Optics and Optical Instruments", topics: ["Refraction through a Prism"] },
  { type: "GRAPH_BASED", subject: "Chemistry", chapter: "Chemical Kinetics", topics: ["Rate of Reaction"] },
  { type: "TABLE_BASED", subject: "Biology", chapter: "Principles of Inheritance and Variation", topics: ["Blood Groups"] },
  { type: "PASSAGE_COMPREHENSION", subject: "Biology", chapter: "Molecular Basis of Inheritance", topics: ["Lac Operon"] },
  { type: "CASE_BASED", subject: "Biology", chapter: "Human Health and Disease", topics: ["Common Diseases in Humans"] },
  { type: "NUMERICAL_VALUE", subject: "Physics", chapter: "Kinetic Theory", topics: ["RMS Speed"] },
  { type: "CONCEPT_APPLICATION", subject: "Physics", chapter: "Laws of Motion", topics: ["Newton's Laws"] },
  { type: "EXPERIMENTAL_PRACTICAL", subject: "Chemistry", chapter: "Equilibrium", topics: ["pH"] },
  { type: "NCERT_LINE_BASED", subject: "Biology", chapter: "Biological Classification", topics: ["Kingdom Monera"] },
];

(async () => {
  const { defaultAiProvider } = await import("../src/lib/ai-question-engine/gemini-provider");
  const { parseFigure, renderFigure } = await import("../src/lib/ai-question-engine/figures");
  const fs = await import("node:fs");
  const out = process.env.AIQ_OUT;
  const only = process.argv.slice(2);
  const cases = only.length ? CASES.filter((c) => only.includes(c.type)) : CASES;
  let ok = 0;
  const rows: string[] = [];
  let nextCase = 0;
  const runOne = async (c: (typeof cases)[number]) => {
      const t0 = Date.now();
      try {
        const [q] = await defaultAiProvider.generateQuestions({
          method: "AI",
          subject: c.subject,
          chapter: c.chapter,
          selectedTopics: c.topics,
          difficultyMix: { EASY: 0, MEDIUM: 1, HARD: 0, ULTRA: 0 },
          questionTypeCounts: { [c.type]: 1 },
          language: "BOTH",
          deadlineMs: Date.now() + 170_000,
        });
        if (!q) throw new Error("no question returned");
        let fig = "";
        if (q.figure) {
          const { figure } = parseFigure(q.figure);
          const r = figure ? await renderFigure(figure) : { problem: "unparsable" };
          fig = r.png ? ` figure=${(figure as any).kind} drawn${r.problem ? ` (${r.problem})` : ""}` : ` figure FAILED: ${r.problem}`;
          if (r.png && out) fs.writeFileSync(path.join(out, `${c.type}.png`), r.png);
        }
        const pass = !q.formatIssue && !/FAILED/.test(fig);
        if (pass) ok++;
        rows.push(`${pass ? "PASS" : "FAIL"}  ${c.type.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(0)}s${q.formatIssue ? `  format: ${q.formatIssue}` : ""}${fig}`);
        if (out) fs.writeFileSync(path.join(out, `${c.type}.json`), JSON.stringify(q, null, 2));
      } catch (e) {
        rows.push(`FAIL  ${c.type.padEnd(28)} error: ${e instanceof Error ? e.message.slice(0, 160) : e}`);
      }
  };
  // Three at a time: the model is often busy (503) when many calls arrive at once.
  await Promise.all(Array.from({ length: 3 }, async () => { while (nextCase < cases.length) await runOne(cases[nextCase++]!); }));
  rows.sort((a, b) => a.slice(6).localeCompare(b.slice(6))).forEach((r) => console.log(r));
  console.log(`\n${ok} of ${cases.length} types came back in their format`);
  process.exit(ok === cases.length ? 0 : 1);
})();
