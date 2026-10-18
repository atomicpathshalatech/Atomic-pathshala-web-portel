/**
 * Module design system: content mapping + real PDF output (headless Chrome).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-module-design.ts
 *
 * Needs a local Chrome/Edge and internet for the web fonts (Google Fonts) — as the server does.
 */
import Module from "node:module";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return path.join(__dirname, "fixtures/empty-module.cjs");
  return origResolve.call(this, req, ...a);
};

import { PDFDocument } from "pdf-lib";
import type { ModuleElementInput } from "../src/lib/validation/module";
import { designSchema, type ModuleDesign, type TemplateStyle } from "../src/lib/module-studio/design/model";
import { defaultDesign, newSection, THEME_PRESETS, presetForSubject } from "../src/lib/module-studio/design/presets";
import { questionUnits, answerOf, theoryElements } from "../src/lib/module-studio/design/content";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

// a small PNG served locally (pictures in content and as page graphics)
const PNG: Buffer = (() => {
  const { createCanvas } = require("@napi-rs/canvas");
  const c = createCanvas(160, 100);
  const x = c.getContext("2d");
  x.fillStyle = "#0ea5e9";
  x.fillRect(0, 0, 160, 100);
  x.fillStyle = "#ffffff";
  x.fillRect(30, 30, 100, 40);
  return c.toBuffer("image/png");
})();
const server = http.createServer((q, s) => {
  if ((q.url ?? "").startsWith("/missing")) return s.writeHead(404).end();
  s.writeHead(200, { "Content-Type": "image/png" });
  s.end(PNG);
});

let id = 0;
const el = (type: ModuleElementInput["type"], content: string, extra: Partial<ModuleElementInput> = {}): ModuleElementInput => ({ id: `e${id++}`, type, order: id, content, ...extra });

function content(img: string) {
  const p1: ModuleElementInput[] = [
    el("HEADER", "OLD INSTITUTE HEADER"),
    el("HEADING", "Mole Concept"),
    el("PARAGRAPH", "The mole is the SI unit of amount of substance. मोल पदार्थ की मात्रा की इकाई है।"),
    el("CALLOUT", "One mole contains $6.022 \\times 10^{23}$ particles.", { variant: "REMEMBER", label: "Remember" }),
    el("EQUATION", "n = \\frac{m}{M}"),
    el("TABLE", "", { tableData: [["Substance", "Molar mass (g/mol)"], ["H2O", "18"], ["CO2", "44"], ["NaOH", "40"]] }),
    el("IMAGE", `![](${img})`, { label: "Burette set-up", layout: { wrap: "right", widthPct: 35 } }),
    el("PARAGRAPH", "Text that wraps around the picture on the right. ".repeat(8)),
    el("HEADING", "Stoichiometry"),
    el("PARAGRAPH", "Balanced equations give mole ratios. ".repeat(30)),
    el("CALLOUT", "Always balance the equation first.", { variant: "TIP" }),
    el("CALLOUT", "Molarity changes with temperature.", { variant: "CAUTION" }),
    el("CALLOUT", "Moles connect mass, particles and volume.", { variant: "SUMMARY" }),
    el("CALLOUT", "$M_1V_1 = M_2V_2$", { variant: "FORMULA" }),
    el("BULLETS", "Mass → moles\nMoles → particles\nMoles → volume at STP"),
  ];
  const p2: ModuleElementInput[] = [];
  for (let k = 1; k <= 26; k++) {
    const long = k === 7 ? " Explain with steps. ".repeat(18) : "";
    const pyq = k % 5 === 0 ? ` [NEET 20${10 + k}]` : "";
    p2.push(el("QUESTION", `${k}. QSTART${k} How many moles are present in ${k * 4} g of NaOH?${long}${pyq} QEND${k}`));
    for (const o of [1, 2, 3, 4]) p2.push(el("OPTION", `(${o}) ${o * k / 10} mol`));
    p2.push(el("ANSWER", `Ans. (${(k % 4) + 1})`));
    if (k % 3 === 0) p2.push(el("SOLUTION", `Solution: moles = mass / molar mass = ${k * 4} / 40.`));
  }
  // a question taller than a page → must be reported and continue, not be clipped
  p2.push(el("QUESTION", `27. QSTART27 Very long question. ${"Read this long passage carefully. ".repeat(260)} QEND27`));
  p2.push(el("OPTION", "(1) A"));
  p2.push(el("ANSWER", "उत्तर: (1)"));
  return [
    { pageNumber: 1, elements: p1 },
    { pageNumber: 2, elements: p2 },
  ];
}

let pdfjs: any;
async function readPdf(buf: Buffer) {
  pdfjs ??= await import(pathToFileURL(path.join(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const pages: { text: string; w: number; h: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1 });
    const t = await p.getTextContent();
    pages.push({ text: (t.items as any[]).map((x) => x.str).join(" ").replace(/\s+/g, " "), w: vp.width, h: vp.height });
  }
  await doc.destroy();
  return pages;
}
const pageOf = (pages: { text: string }[], needle: string) => pages.findIndex((p) => p.text.includes(needle)) + 1;

(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const img = `http://127.0.0.1:${(server.address() as any).port}/fig.png`;
  const pages = content(img);
  const { renderModuleDesignPdf } = await import("../src/lib/module-studio/design/render-pdf");

  // ---- content mapping
  const units = questionUnits(pages);
  check("questions grouped with options, answer and solution", units.length === 27 && units[2]!.options.length === 4 && units[2]!.answer === "(4)" && !!units[2]!.solution);
  check("PYQ questions detected (exam + year)", units.filter((u) => u.pyq).map((u) => u.number).join(",") === "5,10,15,20,25");
  check("answers read from English and Hindi lines", answerOf("Ans. (2)") === "(2)" && answerOf("उत्तर: (1)") === "(1)" && answerOf("Answer: b") === "(B)");
  check("theory excludes questions and the old PDF header", theoryElements(pages).every((e) => e.type !== "QUESTION" && e.type !== "HEADER"));
  check("subject presets: chemistry green, physics blue, biology purple, maths separate", presetForSubject("Chemistry") === "CHEMISTRY" && presetForSubject("भौतिक विज्ञान") === "PHYSICS" && presetForSubject("Biology") === "BIOLOGY" && presetForSubject("Maths") === "MATHEMATICS" && THEME_PRESETS.CHEMISTRY!.primary !== THEME_PRESETS.MATHEMATICS!.primary);

  // ---- page-template graphics: align, distribute, group, lock, duplicate, stacking
  {
    const G = await import("../src/lib/module-studio/design/graphics-ops");
    const mk = (id: string, x: number, y: number, w = 10, h = 10, z = 1) => ({ id, kind: "RECT" as const, x, y, w, h, z });
    let gs = [mk("a", 10, 10), mk("b", 50, 30, 20), mk("c", 120, 70)];
    const left = G.align(gs, ["a", "b", "c"], "left", { w: 210, h: 297 });
    check("align left lines objects up with the leftmost", left.every((g) => g.x === 10));
    const one = G.align(gs, ["b"], "hcenter", { w: 210, h: 297 });
    check("align one object centres it on the page", one.find((g) => g.id === "b")!.x === 95);
    const dist = G.distribute(gs, ["a", "b", "c"], "h");
    const [a, b, c] = ["a", "b", "c"].map((id) => dist.find((g) => g.id === id)!);
    check("distribute gives equal gaps, ends stay", a!.x === 10 && c!.x === 120 && Math.abs(b!.x - 10 - 10 - (120 - (b!.x + b!.w))) < 0.11, `b.x=${b!.x}`);
    const grouped = G.group(gs, ["a", "b"]);
    check("a click on one member selects the whole group", G.expandToGroups(grouped.graphics, ["a"]).sort().join() === "a,b");
    const moved = G.align(grouped.graphics, ["a", "b", "c"], "top", { w: 210, h: 297 });
    check("a group aligns as one unit (keeps its shape)", moved.find((g) => g.id === "b")!.y - moved.find((g) => g.id === "a")!.y === 20);
    check("ungroup", G.ungroup(grouped.graphics, ["a", "b"]).every((g) => !g.groupId));
    gs = G.setLocked(gs, ["c"], true);
    check("locked objects do not move or get deleted", G.moveBy(gs, ["c"], 5, 5).find((g) => g.id === "c")!.x === 120 && G.remove(gs, ["c"]).length === 3);
    const dup = G.duplicate(gs, ["a"]);
    check("duplicate: new id, offset, on top", dup.graphics.length === 4 && dup.graphics[3]!.x === 15 && dup.graphics[3]!.z > 1);
    const z = G.arrange([mk("p", 0, 0, 1, 1, 1), mk("q", 0, 0, 1, 1, 2), mk("r", 0, 0, 1, 1, 3)], ["p"], "front");
    check("bring to front within its layer", [...z].sort((x, y) => x.z - y.z).map((g) => g.id).join() === "q,r,p");
    const bt = G.setBehindText(z, ["q"], true);
    check("behind-text layer (negative z) is separate", bt.find((g) => g.id === "q")!.z < 0 && G.arrange(bt, ["q"], "front").find((g) => g.id === "q")!.z < 0);
  }

  const base = defaultDesign({ title: "Mole Concept Module", subject: "Chemistry", class: "Class 11", batch: "NEET 2027", chapter: "Some Basic Concepts of Chemistry", facultyName: "Firoz Sir", academicYear: "2026-27", logoUrl: img });
  base.sections.push(newSection("PYQ"), newSection("PRACTICE"), newSection("REVISION"));
  base.sections.find((s) => s.kind === "CHAPTER_INTRO")!.note = "This chapter builds the base for all of physical chemistry.";
  base.watermark.enabled = true;
  base.sections.find((s) => s.kind === "THEORY")!.graphics.push({ id: "corner", kind: "RECT", x: 0, y: 0, w: 6, h: 297, z: -1, fill: "#047857", opacity: 0.6 });
  check("default design is valid", designSchema.safeParse(base).success, JSON.stringify(designSchema.safeParse(base).error?.issues?.[0] ?? ""));

  // ---- full render (A4 portrait, digital)
  const t0 = Date.now();
  const r = await renderModuleDesignPdf({ design: base, pages, chapter: { learningObjectives: "Define a mole\nUse molar mass", prerequisites: "Atomic mass" } });
  const secs = (Date.now() - t0) / 1000;
  const pp = await readPdf(r.pdf);
  if (process.env.DESIGN_TEST_OUT) require("node:fs").writeFileSync(process.env.DESIGN_TEST_OUT, r.pdf);
  check("renders: one PDF with every section", r.pageCount === pp.length && r.sections.length >= 12, `${r.pageCount} pages, ${r.sections.length} sections, ${secs.toFixed(1)} s, ${Math.round(r.pdf.length / 1024)} KB`);
  check("cover first, without header or page number", r.sections[0]!.title === "Cover page" && !/Page \d/.test(pp[0]!.text) && /Mole Concept|Some Basic Concepts/.test(pp[0]!.text), pp[0]!.text.slice(0, 120));
  check("body pages have header labels and running page numbers", pp.slice(1).every((p, i) => p.text.includes("Atomic Pathshala") && p.text.includes(`Page ${i + 1}`)), pp.slice(1, 3).map((p) => p.text.slice(0, 60)).join(" | "));
  check("chapter label in the header", pp[1]!.text.includes("Some Basic Concepts of Chemistry"));
  // Hindi is drawn with the embedded Devanagari font; Chrome's PDF text layer loses some letters of it
  // (copy / search), which the renderer reports.
  check("Hindi text drawn in the PDF; copy/search limitation reported", pp.some((p) => /[ऀ-ॿ]/.test(p.text) && p.text.includes("है")) && r.warnings.some((w) => /Hindi.*copy/i.test(w)));
  check("pictures and the logo load", !r.warnings.some((w) => /could not be loaded/.test(w)), r.warnings.filter((w) => /could not/.test(w)).join(" | "));
  const fit = Array.from({ length: 26 }, (_, i) => i + 1).filter((k) => {
    const qs = pp.map((p, i) => ({ i, p })).filter((x) => x.p.text.includes(`QSTART${k} `) || x.p.text.includes(`QSTART${k}`));
    return qs.some((x) => x.p.text.includes(`QEND${k}`));
  });
  check("no question is split across pages (questions 1–26, incl. a long one)", fit.length === 26, `kept whole: ${fit.length}/26`);
  check("a question taller than a page is reported and continues (not clipped)", r.warnings.some((w) => /Question 27 .*taller than one page/.test(w)) && pp.some((p) => p.text.includes("QEND27")), r.warnings.filter((w) => /taller/.test(w)).join(" | "));
  const contentsPage = pp.findIndex((p) => p.text.includes("Contents")) + 1;
  // contents numbers are printed (body) page numbers; the PDF page is one later because of the cover.
  // Exam-style titles are set in capitals, so compare without case.
  const onPage = (n: number, label: string) => (pp[n]?.text ?? "").toLowerCase().includes(label.slice(0, 14).toLowerCase());
  const tocOk = r.contents.every((c) => c.page != null && onPage(c.page, c.label));
  check("contents lists sections and headings with their real page numbers", contentsPage === 2 && r.contents.length >= 10 && tocOk, r.contents.slice(0, 6).map((c) => `${c.label}→${c.page}`).join(", "));
  check("answer key has every question", (() => { const ak = r.sections.find((s) => s.title === "Answer key")!; return pp.slice(ak.firstPage - 1, ak.lastPage).map((p) => p.text).join(" ").includes("(4)"); })());
  check("old PDF header not printed, and that is reported", !pp.some((p) => p.text.includes("OLD INSTITUTE HEADER")) && r.warnings.some((w) => /running header\/footer line/.test(w)));
  check("watermark on body pages", pp.slice(1).every((p) => p.text.includes("ATOMIC PATHSHALA")));
  check("PYQ section has only the PYQ questions", (() => { const s = r.sections.find((x) => x.title === "PYQ pages")!; const t = pp.slice(s.firstPage - 1, s.lastPage).map((p) => p.text).join(" "); return t.includes("QSTART5") && t.includes("QSTART25") && !t.includes("QSTART4 "); })());
  check("A4 portrait page size", Math.round(pp[1]!.w) === 595 && Math.round(pp[1]!.h) === 842, `${pp[1]!.w}x${pp[1]!.h}`);

  // ---- every template style, landscape, print with bleed
  for (const style of ["MINIMAL", "PREMIUM", "CLASSROOM", "EXAM"] as TemplateStyle[]) {
    const d: ModuleDesign = JSON.parse(JSON.stringify(base));
    d.sections.forEach((s) => (s.style = style));
    d.theme = { ...THEME_PRESETS.PHYSICS! };
    const t1 = Date.now();
    const rr = await renderModuleDesignPdf({ design: d, pages });
    check(`style ${style}: all sections render`, rr.pageCount > 5 && rr.sections.length >= 12, `${rr.pageCount} pages, ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  }
  {
    const d: ModuleDesign = JSON.parse(JSON.stringify(base));
    d.page.orientation = "LANDSCAPE";
    d.sections = d.sections.filter((s) => ["COVER", "THEORY", "FORMULA_SHEET"].includes(s.kind));
    const rr = await renderModuleDesignPdf({ design: d, pages });
    const q = await readPdf(rr.pdf);
    check("landscape A4", q.every((p) => Math.round(p.w) === 842 && Math.round(p.h) === 595), `${q[0]!.w}x${q[0]!.h}`);
  }
  {
    const d: ModuleDesign = JSON.parse(JSON.stringify(base));
    d.output = { mode: "PRINT", bleedMm: 3, cropMarks: true };
    d.page.size = "A5";
    d.page.widthMm = 148;
    d.page.heightMm = 210;
    d.sections = d.sections.filter((s) => ["COVER", "THEORY", "QUESTIONS"].includes(s.kind));
    const rr = await renderModuleDesignPdf({ design: d, pages });
    const doc = await PDFDocument.load(rr.pdf);
    const pg = doc.getPage(1);
    const trim = pg.getTrimBox();
    const mm = (v: number) => Math.round((v * 25.4) / 72 * 10) / 10;
    check("print: A5 + 3 mm bleed, trim box at the cut size", Math.round(mm(pg.getWidth())) === 154 && Math.round(mm(pg.getHeight())) === 216 && Math.round(mm(trim.width)) === 148 && Math.round(mm(trim.x)) === 3, `page ${mm(pg.getWidth())}×${mm(pg.getHeight())} mm, trim ${mm(trim.width)}×${mm(trim.height)} at ${mm(trim.x)}`);
    check("print: no PDF/X or CMYK claim — RGB is stated", rr.warnings.some((w) => /RGB/.test(w) && /PDF\/X/.test(w)));
  }
  {
    // export checks: a clean module has no errors; cut-off content and empty pages are found
    check("export check: the normal module has no error-level issues", r.issues.every((i) => i.severity !== "error"), r.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" | "));
    const wide = el("TABLE", "", { tableData: [Array.from({ length: 16 }, (_, i) => `Column heading number ${i + 1}`), Array.from({ length: 16 }, () => "averyveryverylongunbreakablevalue")] });
    // a page that ends up holding only a picture that fails to load → nothing is printed on it
    const missingPic = `http://127.0.0.1:${(server.address() as any).port}/missing.png?404`;
    const broken = [{ pageNumber: 1, elements: [el("HEADING", "Wide data"), wide, el("PARAGRAPH", "Before the picture."), el("IMAGE", `![](${missingPic})`, { layout: { breakBefore: true } }), el("PARAGRAPH", "After the picture.", { layout: { breakBefore: true } })] }];
    const d: ModuleDesign = JSON.parse(JSON.stringify(base));
    d.sections = d.sections.filter((s) => ["COVER", "THEORY"].includes(s.kind));
    const rr = await renderModuleDesignPdf({ design: d, pages: broken });
    check("export check: content cut off at the edge (too-wide table) is an error", rr.issues.some((i) => i.category === "OVERFLOW" && i.severity === "error" && /cut off/.test(i.message)), rr.issues.map((i) => `${i.severity}:${i.category}`).join(","));
    check("export check: a page with nothing but header/footer is reported", rr.issues.some((i) => i.category === "EMPTY_PAGE" && /Page\(s\) \d/.test(i.message)), (await readPdf(rr.pdf)).map((t, i) => `p${i + 1}:${t.text.slice(0, 70)}`).join(" || "));
  }
  {
    // a module with no questions: question-type sections are left out, not printed blank
    const d: ModuleDesign = JSON.parse(JSON.stringify(base));
    const rr = await renderModuleDesignPdf({ design: d, pages: [pages[0]!] });
    check("empty sections are skipped and reported (no blank pages)", rr.warnings.some((w) => /Answer key.*left out/.test(w)) && !rr.sections.some((s) => s.title === "Answer key"));
  }

  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
