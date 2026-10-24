/**
 * AI question generator, offline: type formats are enforced, visual types need a
 * figure, figures are drawn safely, and question types map to the Question Bank.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-ai-question-formats.ts
 */
import Module from "node:module";
import path from "node:path";
const orig = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return path.join(__dirname, "fixtures/empty-module.cjs");
  return orig.call(this, req, ...a);
};

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  — ${detail}` : ""}`);
};

const base = {
  questionIndex: 1,
  statementHi: "",
  correctAnswer: ["A"],
  solutionEn: "Concept : x",
  subject: "Chemistry",
  chapter: "Chemical Bonding",
  topic: "VSEPR",
  difficulty: "MEDIUM" as const,
  pyqStyle: "STANDARD" as const,
  language: "ENGLISH" as const,
};
const q = (statementEn: string, optionsEn: Record<string, string>, extra: Record<string, unknown> = {}) => ({ ...base, questionType: "X", statementEn, optionsEn: optionsEn as any, ...extra });
const mcq = { A: "one", B: "two", C: "three", D: "four" };

(async () => {
  const { checkAgainstType } = await import("../src/lib/ai-question-engine/gemini-provider");
  const { bankTypeOf, tableOf, TYPE_FORMATS } = await import("../src/lib/ai-question-engine/type-formats");
  const { OFFICIAL_NEET_QUESTION_TYPES } = await import("../src/lib/ai-question-engine/types");
  const { parseFigure, renderFigure, sanitizeDiagramSvg, describeFigure } = await import("../src/lib/ai-question-engine/figures");
  const { PDFDocument } = await import("pdf-lib");
  void PDFDocument;
  const none = new Set<string>();

  // ── the type list
  const ids = OFFICIAL_NEET_QUESTION_TYPES.map((t) => t.id);
  check("18 types offered; multiple-correct and integer-answer removed", ids.length === 18 && !ids.includes("MULTIPLE_CORRECT") && !ids.includes("INTEGER_ANSWER"), ids.join(","));
  check("every offered type has a format and a check", ids.every((id) => TYPE_FORMATS[id]?.format && typeof TYPE_FORMATS[id]!.check === "function"));
  check("Image Based is offered only BY PDF", JSON.stringify(OFFICIAL_NEET_QUESTION_TYPES.find((t) => t.id === "IMAGE_BASED")?.methods) === '["PDF"]');

  // ── 3-column vs 2-column match
  const three = "Match Column-I, Column-II and Column-III.\n\nColumn-I | Column-II | Column-III\n---|---|---\n(A) SF4 | (I) 2 lp | (P) T-shaped\n(B) ClF3 | (II) 0 lp | (Q) Square planar\n(C) XeF4 | (III) 1 lp | (R) See-saw\n(D) CH4 | (IV) 2 lp | (S) Tetrahedral";
  const threeOpts = { A: "A-III-R, B-I-P, C-IV-Q, D-II-S", B: "A-I-P, B-III-R, C-II-S, D-IV-Q", C: "A-III-P, B-I-R, C-IV-S, D-II-Q", D: "A-II-S, B-IV-Q, C-I-P, D-III-R" };
  const two = "Match List-I with List-II.\n\nList-I | List-II\n---|---\n(A) SF4 | (I) See-saw\n(B) ClF3 | (II) T-shaped\n(C) XeF4 | (III) Square planar\n(D) CH4 | (IV) Tetrahedral";
  const twoOpts = { A: "A-I, B-II, C-III, D-IV", B: "A-II, B-I, C-IV, D-III", C: "A-III, B-IV, C-I, D-II", D: "A-IV, B-III, C-II, D-I" };
  check("3-column match accepted", !checkAgainstType(q(three, threeOpts), "COLUMN_MATCHING", none).formatIssue);
  const asThree = checkAgainstType(q(two, twoOpts), "COLUMN_MATCHING", none);
  check("a 2-column table sent as 3-column is caught", /three columns/.test(asThree.formatIssue ?? ""), asThree.formatIssue);
  check("3-column with 2-part option codes is caught", /3-part codes/.test(checkAgainstType(q(three, twoOpts), "COLUMN_MATCHING", none).formatIssue ?? ""));
  check("2-column match accepted", !checkAgainstType(q(two, twoOpts), "MATCH_THE_FOLLOWING", none).formatIssue);
  check("match without a table is caught", !!checkAgainstType(q("Match the hormones with glands: A insulin B glucagon", twoOpts), "MATCH_THE_FOLLOWING", none).formatIssue);
  check("table parser reads rows and cells", tableOf(three)?.length === 5 && tableOf(three)![1]!.length === 3);

  // ── statement types
  check("Assertion-Reason needs both parts", !!checkAgainstType(q("Assertion (A): X is true.", mcq), "ASSERTION_REASON", none).formatIssue && !checkAgainstType(q("Assertion (A): X.\nReason (R): Y.", mcq), "ASSERTION_REASON", none).formatIssue);
  check("Statement I / II needs both statements", !checkAgainstType(q("Given below are two statements:\nStatement I: a\nStatement II: b", mcq), "TWO_STATEMENT", none).formatIssue && !!checkAgainstType(q("Statement I: a only", mcq), "TWO_STATEMENT", none).formatIssue);
  check("multi-statement needs 3+ labelled lines", !checkAgainstType(q("Consider:\n(a) p\n(b) q\n(c) r\n(d) s\nChoose:", mcq), "MULTI_STATEMENT_COMBINATION", none).formatIssue && !!checkAgainstType(q("Consider (a) p, (b) q", mcq), "MULTI_STATEMENT_COMBINATION", none).formatIssue);
  check("sequence needs items and order options", !checkAgainstType(q("Arrange:\n(A) a\n(B) b\n(C) c\n(D) d", { A: "A → B → C → D", B: "B → A → D → C", C: "C → D → A → B", D: "D → C → B → A" }), "SEQUENCE_ARRANGEMENT", none).formatIssue);
  check("numerical needs numeric options", !checkAgainstType(q("Find v.", { A: "483 m/s", B: "512 m/s", C: "390 m/s", D: "600 m/s" }), "NUMERICAL_VALUE", none).formatIssue && !!checkAgainstType(q("Find v.", mcq), "NUMERICAL_VALUE", none).formatIssue);
  check("passage needs a passage", !!checkAgainstType(q("Read the passage. Short.", mcq), "PASSAGE_COMPREHENSION", none).formatIssue);

  // ── visual types
  const graphQ = checkAgainstType(q("In the graph, which point…", mcq, { figure: { kind: "graph", xLabel: "t (s)", yLabel: "[R]", series: [{ points: [[0, 1], [10, 0.5], [20, 0.25]] }] } }), "GRAPH_BASED", none);
  check("graph question with data is accepted, figure kept", !graphQ.formatIssue && (graphQ.figure as any)?.kind === "graph" && graphQ.requiresImage === true);
  check("graph question without a figure is caught", /figure/i.test(checkAgainstType(q("In the graph…", mcq), "GRAPH_BASED", none).formatIssue ?? ""));
  check("graph question with a structure figure is caught", /graph figure/.test(checkAgainstType(q("x", mcq, { figure: { kind: "structures", items: [{ smiles: "CCO" }] } }), "GRAPH_BASED", none).formatIssue ?? ""));
  check("diagram question with SMILES is accepted", !checkAgainstType(q("Name the compound shown.", mcq, { figure: { kind: "structures", items: [{ label: "X", smiles: "CC(C)CO" }] } }), "DIAGRAM_BASED", none).formatIssue);
  check("diagram question may use an offered NCERT image instead", !checkAgainstType(q("In the figure…", mcq, { sourceImageId: "img1" }), "DIAGRAM_BASED", new Set(["img1"])).formatIssue);
  const madeUp = checkAgainstType(q("In the figure…", mcq, { sourceImageId: "made-up" }), "IMAGE_BASED", new Set(["img1"]));
  check("an image id that was not offered is dropped and caught", !madeUp.sourceImageId && !!madeUp.formatIssue);
  check("a figure on a non-visual type is dropped", !checkAgainstType(q("x", mcq, { figure: { kind: "graph" } }), "SINGLE_CORRECT", none).figure);
  check("the type asked for is the type recorded", checkAgainstType(q(three, threeOpts, { questionType: "MATCH_THE_FOLLOWING" }), "COLUMN_MATCHING", none).questionType === "COLUMN_MATCHING");

  // ── drawing
  const g = parseFigure({ kind: "graph", xLabel: "Temperature (K)", yLabel: "Rate", series: [{ points: [[300, 1], [310, 2], [320, 4], [330, 8]] }], markers: [{ x: 320, y: 4, label: "P" }] }).figure!;
  const gr = await renderFigure(g);
  check("graph drawn as PNG", !!gr.png && gr.png.subarray(1, 4).toString() === "PNG", gr.problem);
  const s = await renderFigure(parseFigure({ kind: "structures", items: [{ label: "(A)", smiles: "CC(=O)O" }, { label: "(B)", smiles: "not-a-smiles((" }] }).figure!);
  check("structures drawn; a bad SMILES is reported, not hidden", !!s.png && /\(B\)/.test(s.problem ?? ""), s.problem);
  check("all-bad SMILES gives no picture", !(await renderFigure(parseFigure({ kind: "structures", items: [{ smiles: "((((" }] }).figure!)).png);
  const dirty = `<svg viewBox="0 0 200 100"><script>alert(1)</script><a href="javascript:x"><text x="5" y="20">A</text></a><rect x="10" y="30" width="50" height="40" onclick="steal()" fill="url(http://x)"/><image href="http://evil/p.png"/><foreignObject><div>x</div></foreignObject><line x1="0" y1="0" x2="10" y2="10" stroke="#000"/><circle cx="100" cy="50" r="20"/><text x="90" y="55">B</text></svg>`;
  const clean = sanitizeDiagramSvg(dirty).svg;
  check("diagram SVG keeps only shapes and text", !/script|onclick|javascript|image|foreignObject|url\(|href/i.test(clean) && /<circle/.test(clean) && />B</.test(clean), clean.slice(0, 200));
  check("diagram drawn as PNG", !!(await renderFigure({ kind: "diagram", svg: dirty })).png);
  check("Hindi inside a figure is refused", !!parseFigure({ kind: "diagram", svg: "<svg><text>ग्लूकोज</text></svg>" }).problem);
  check("answer checker gets the graph data in words", /\(320, 4\)/.test(describeFigure(g)) && /P at \(320, 4\)/.test(describeFigure(g)));
  check("answer checker gets the diagram geometry", /<circle/.test(describeFigure({ kind: "diagram", svg: dirty })));

  // ── Question Bank type
  check("Numerical value is saved as an MCQ, not a type-in answer", bankTypeOf("NUMERICAL_VALUE") === "SINGLE_CORRECT");
  check("matches → MATCH_COLUMN, statements → STATEMENT_BASED, A-R → ASSERTION_REASON", bankTypeOf("COLUMN_MATCHING") === "MATCH_COLUMN" && bankTypeOf("MATCH_THE_FOLLOWING") === "MATCH_COLUMN" && bankTypeOf("TWO_STATEMENT") === "STATEMENT_BASED" && bankTypeOf("ASSERTION_REASON") === "ASSERTION_REASON");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
