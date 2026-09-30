// Test booklet PDF, end to end: renders the booklet HTML for real questions
// of "Minor Test : 01" (scripts/fixtures), lays it out in Electron's Chromium,
// checks every A4 sheet (nothing clipped, nothing sticking out, every
// question once, page numbers filled) and prints a real PDF — the same
// engine as Chrome's "Save as PDF" — checking it has exactly one PDF page
// per sheet.
//
//   node desktop/teacher/scripts/test-test-pdf.mjs            (from the repo root)
//   PDF_REPEAT=25 node …   → ~200 questions (a full NEET paper)
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const electron = join(here, "..", "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
const work = mkdtempSync(join(tmpdir(), "atomic-pdf-"));
const repeat = process.env.PDF_REPEAT || "4";

let passed = 0;
let failed = 0;
const assert = (c, label) => {
  if (c) passed++;
  else failed++;
  console.log(`${c ? "✅ PASS" : "❌ FAIL"}: ${label}`);
};

function render(type) {
  const out = join(work, `${type}.html`);
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "scripts/fixtures/render-export-fixture.ts", out, repeat, type], { cwd: repo, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`render failed: ${r.stderr || r.stdout}`);
  return `${type}.html`;
}

function runElectron(url, outDir, pages) {
  return new Promise((resolve) => {
    const child = spawn(electron, ["."], {
      cwd: join(here, "pdf-check"),
      stdio: "ignore",
      env: { ...process.env, PDFCHECK_URL: url, PDFCHECK_OUT: outDir, PDFCHECK_PAGES: pages },
    });
    const kill = setTimeout(() => child.kill(), 180000);
    child.on("exit", () => {
      clearTimeout(kill);
      const file = join(outDir, "result.json");
      resolve(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { error: "no result" });
    });
  });
}

const files = { withSol: render("with-solution"), withoutSol: render("without-solution") };
const server = createServer((req, res) => {
  const p = join(work, decodeURIComponent((req.url || "/").split("?")[0]));
  if (!p.startsWith(work) || !existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

for (const [name, file] of Object.entries(files)) {
  const outDir = join(work, name);
  const res = await runElectron(`${base}/${file}`, outDir, "1,2");
  if (res.error) {
    assert(false, `${name}: ${res.error}`);
    continue;
  }
  const c = res.checks;
  assert(res.pages > 0 && res.layoutMs < 30000, `${name}: booklet laid out (${res.pages} sheets in ${res.layoutMs} ms)`);
  assert(c.leftoverFlows === 0 && c.duplicateRows.length === 0, `${name}: every question placed exactly once (${c.questionRows} rows)`);
  assert(c.problems.length === 0, `${name}: no sheet clipped / nothing sticking out of its column ${c.problems.length ? JSON.stringify(c.problems) : ""}`);
  assert(c.overflowPages === 0, `${name}: no question taller than a page`);
  assert(!c.rawLatex, `${name}: no raw LaTeX on any page`);
  assert(c.pageNumbers.every((n, i, all) => i === 0 || Number(n) > Number(all[i - 1])), `${name}: page numbers run in order (${c.pageNumbers.slice(0, 3).join(",")}…)`);
  assert(c.coverTotals.every((t) => Number(t) > 1), `${name}: cover shows the real page count (${c.coverTotals[0]})`);
  assert(res.pdfPages === res.pages, `${name}: real PDF has one page per sheet (${res.pdfPages} PDF pages, ${Math.round(res.pdfBytes / 1024)} KB)`);
  if (name === "withSol") assert(c.solutionRows === c.questionRows, `${name}: every solution included (${c.solutionRows})`);
  else assert(c.solutionRows === 0, `${name}: no solutions in the question-only booklet`);
}
server.close();
console.log(`\n${passed} passed, ${failed} failed  (artifacts: ${work})`);
process.exit(failed ? 1 : 0);
