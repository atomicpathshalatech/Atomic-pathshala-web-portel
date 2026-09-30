/**
 * Test portal rendering: question/option/solution content (student exam,
 * review, PDF all use renderFormulaContent) and the PDF booklet HTML.
 * Uses real questions from "Minor Test : 01" (scripts/fixtures).
 *
 *   npx tsx scripts/test-test-portal-render.ts
 *
 * The real print-to-PDF check (pages, clipping, PDF page count) runs in
 * Electron: node desktop/teacher/scripts/test-test-pdf.mjs
 */
import Module from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The export engine is "server-only"; outside Next that import must be a no-op.
const M = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
const resolve = M._resolveFilename;
M._resolveFilename = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return require.resolve("./fixtures/empty-module.cjs");
  return resolve.call(this, req, ...rest);
};

let passed = 0;
let failed = 0;
function assert(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`✅ PASS: ${label}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${label}`);
  }
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripAnnotations = (html: string) => html.replace(/<annotation[\s\S]*?<\/annotation>/g, "");

async function run() {
  const { renderFormulaContent, repairLatexControlChars, latexTableToHtml } = await import("../src/lib/test-portal/formula");
  type Sample = { no: number; subject: string; en: { statement: string; options: Record<string, string>; solution: string }; hi: { statement: string; options: Record<string, string>; solution: string } };
  const samples: Sample[] = JSON.parse(read("scripts/fixtures/minor-test-01-samples.json"));

  // ---- 1. Mangled LaTeX (control characters from unescaped JSON) ----
  assert(repairLatexControlChars("density $\rho$ of gas") === "density $\\rho$ of gas", "CR + 'ho' → \\rho (real Q45 of Minor Test 01)");
  assert(repairLatexControlChars("$\frac{1}{2}$ and $\times$ and $\theta$") === "$\\frac{1}{2}$ and $\\times$ and $\\theta$", "form feed + 'rac', tab + 'imes'/'heta' → \\frac, \\times, \\theta");
  assert(repairLatexControlChars("$\vec{A}$ $\beta$") === "$\\vec{A}$ $\\beta$", "vertical tab + 'ec', backspace + 'eta' → \\vec, \\beta");
  assert(repairLatexControlChars("line one\r\nline two\tindented text") === "line one\r\nline two\tindented text", "Real line breaks and tabs are left alone");
  assert(repairLatexControlChars("\rhombus") === "\rhombus", "Only whole command names are repaired ('\\rhombus' isn't \\rho)");

  // ---- 2. Match-the-column tables become real, compact HTML tables ----
  for (const s of samples.filter((x) => /begin\{array\}/.test(x.en.statement))) {
    for (const lang of ["en", "hi"] as const) {
      const html = stripAnnotations(renderFormulaContent(s[lang].statement));
      assert(html.includes('<table class="fx-table"') && !/\\begin|\\hline|\\text\{/.test(html), `Q${s.no} ${lang}: table rendered as an HTML table, no raw LaTeX`);
    }
  }
  const t15 = renderFormulaContent(samples.find((s) => s.no === 15)!.en.statement);
  assert(/<th[^>]*><strong>Column-I<\/strong><\/th>/.test(t15), "Header row (\\textbf cells) becomes <th>");
  assert(/<td[^>]*>Modulus is greater than one<\/td>/.test(t15), "Word cells stay text (so they wrap), not rigid math");
  assert(/width:auto/.test(t15) && !/width:100%/.test(t15.replace(/max-width:100%/g, "")), "Table sizes to its content (never a full-width box)");
  assert(/border:1px solid/.test(t15), "|l|l| + \\hline table keeps its borders");
  const t106 = renderFormulaContent(samples.find((s) => s.no === 106)!.en.statement);
  assert(/<em>Penicillium<\/em>/.test(t106), "\\textit{} cell → italic");
  const matrix = renderFormulaContent("$$\\begin{array}{cc} 1 & 2 \\\\ 3 & 4 \\end{array}$$");
  assert(!matrix.includes("fx-table") && matrix.includes("katex"), "A plain matrix (no rules, no words) stays KaTeX math");
  assert(latexTableToHtml("|l|l|", "a \\& b & c \\\\ \\hline")?.includes("a \\&amp; b") || latexTableToHtml("|l|l|", "a \\& b & c")?.includes("&amp;"), "An escaped \\& stays inside its cell");

  // ---- 3. Whole questions: no raw LaTeX, no KaTeX errors, maths fixed ----
  for (const s of samples) {
    for (const lang of ["en", "hi"] as const) {
      const parts = [s[lang].statement, ...Object.values(s[lang].options), s[lang].solution];
      const html = stripAnnotations(parts.map((p) => renderFormulaContent(p)).join(" "));
      const visible = html.replace(/<[^>]+>/g, " ");
      assert(!/\$|\\(frac|vec|text|rightarrow|begin|hline|sqrt)\b/.test(visible) && !html.includes("katex-error") && !/[\r\f\b\v]/.test(html), `Q${s.no} ${lang}: renders with no raw LaTeX / errors`);
    }
  }
  const q45 = renderFormulaContent(samples.find((s) => s.no === 45)!.en.statement);
  assert(q45.includes("ρ") || q45.includes("\\rho"), "Q45: 'density ρ' shows ρ (was 'ho')");
  const sol106 = renderFormulaContent(samples.find((s) => s.no === 106)!.en.solution);
  assert(sol106.includes("<em>Penicillium</em>") && sol106.includes("• (i)") && !/\*Penicillium\*/.test(sol106), "Solution: *italic* and '- ' bullets render properly");
  assert(!renderFormulaContent("2 * 3 = 6").includes("<em>"), "A lone multiplication '*' isn't italics");

  // ---- 4. PDF booklet HTML ----
  const { buildExportFixture } = await import("./fixtures/build-export-fixture");
  const { generateTestPaperHtml, generateTestCoverPageOnlyHtml } = await import("../src/lib/pdf/test-export-engine");
  const fixture = buildExportFixture({ repeat: 2 });
  const opts = { withSolution: true, brandName: "ATOMIC PATHSHALA", watermarkText: "ATOMIC PATHSHALA", testPattern: "NEET" };
  const html = generateTestPaperHtml(fixture, { ...opts, autoPrint: true });
  assert(!/html2canvas|jspdf|autoCompileAndDownloadPdf/.test(html), "No screenshot-to-JPEG PDF (html2canvas/jsPDF) any more");
  assert(html.includes("window.print()") && html.includes("var AUTO_PRINT = true"), "Real 'Save as PDF' via the browser; auto-opens for the download buttons");
  assert(generateTestPaperHtml(fixture, opts).includes("var AUTO_PRINT = false"), "Without ?direct=true it just shows the booklet");
  const qHtml = generateTestPaperHtml(fixture, { ...opts, withSolution: false });
  assert((qHtml.match(/class="q-flow"/g) || []).length === fixture.sections.length && qHtml.includes('id="tpl-content-page"'), "Question booklet: one flow per subject, cut into pages by measured height");
  const flows = qHtml.split('class="q-flow"').slice(1).map((f) => (f.match(/class="q-part q-row-item q-stmt" id="q-(\d+)"/g) || []).length);
  assert(flows.reduce((a, b) => a + b, 0) === fixture.totalQuestions, `Every question appears exactly once (${flows.join("+")} = ${fixture.totalQuestions})`);
  assert(/<div class="q-part q-opt"><div class="qp-cell qp-hi"><span class="opt-key">a\)<\/span>/.test(qHtml) && qHtml.includes('<span class="opt-key">d)</span>'), "Options printed a) b) c) d), one line each, Hindi | English side by side");
  assert(!/खण्ड A में 35|Section A will consist/.test(qHtml) && qHtml.includes("Physics, Chemistry, Biology"), "Cover instruction built from the real sections (old Section A/B rule gone)");
  assert((qHtml.match(/href="https:\/\/ap\.atomicpathshala\.in"/g) || []).length >= 3 && !qHtml.includes("atomicpathshala.com"), "Clickable ap.atomicpathshala.in in the page footers (back cover no longer says .com)");
  assert(html.includes("@page { size: A4; margin: 0; }") && /height: 297mm !important/.test(html), "Exact A4 sheets for print");
  const akAt = html.indexOf('class="ak-block"');
  assert(akAt > 0 && akAt < html.indexOf('id="q-1"') && !html.includes('rounded-xs cover-page">') && !html.includes('<div class="page rough-page">'), "Solutions booklet: answer key first, no cover/rough pages");
  const order = [...html.matchAll(/id="(sol-)?q-(\d+)"/g)].map((m) => m[0]);
  assert(
    order.length === 2 * fixture.totalQuestions && order.every((id, i) => id === (i % 2 === 0 ? `id="q-${i / 2 + 1}"` : `id="sol-q-${(i - 1) / 2 + 1}"`)),
    "…then each question followed by its own solution"
  );
  assert((qHtml.match(/class="js-total-pages"/g) || []).length === 3, "Cover page counts are filled in after pagination");
  assert(html.includes(`katex@${require("katex/package.json").version}/dist/katex.min.css`), "KaTeX stylesheet matches the KaTeX that rendered the HTML (vector arrows, sizes)");
  assert(/\.qp-cell \*:not\(\.katex \*\):not\(\.katex\)/.test(html), "Column fonts/sizes don't override KaTeX's own fonts (fractions, powers, bold maths)");
  assert(/\.qp-en \{[^}]*font-size: 14pt/.test(html) && /\.qp-hi \{[^}]*font-size: 13\.6pt/.test(html), "Question text 4pt bigger (EN 10→14pt, HI 9.6→13.6pt)");
  assert(/\.opt-text img \{ min-width: 55%/.test(html), "Structure images in options are never printed tiny");
  assert(/<title>[^<]*\(Solutions\)<\/title>/.test(html), "Saved PDF is named '… (Solutions)' for the solutions booklet");
  assert(!/q-statement-body table \{\s*width: 100% !important/.test(html) || /table\.fx-table \{[^}]*width: auto !important/.test(html), "Tables in questions aren't forced full-width");
  const cover = generateTestCoverPageOnlyHtml(fixture, opts);
  assert((cover.match(/cover-page/g) || []).length >= 1 && !cover.includes('class="q-flow"'), "Cover-only preview is just the cover (was the whole booklet + cover)");

  // ---- 5. Student exam screen (same renderer as DPPs, which open in ExamRunner) ----
  const runner = read("src/components/student/ExamRunner.tsx");
  assert(runner.includes('lg:col-span-8 space-y-4 min-w-0') && runner.includes("lg:col-span-4 space-y-4 min-w-0"), "Exam columns can't be stretched past the screen by wide content");
  assert(read("src/components/test-portal/FormulaText.tsx").includes("formula-content") && /\.formula-content \.katex-display \{[^}]*overflow-x: auto/.test(read("src/app/globals.css")), "Wide equations scroll inside their own box on phones");
  assert(read("src/components/student/ExamLanguageModal.tsx").includes('min-h-full flex items-center justify-center'), "Language popup can't cut off its top on short screens");
  assert(read("src/components/student/DppSubjectChapterView.tsx").includes("/tests/${dpp.testId}/attempt"), "DPPs open in the same exam runner (same rendering/scrolling)");
  assert(read("src/components/student/result/QuestionReviewSection.tsx").includes("FormulaText"), "Review/solutions use the same renderer");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
