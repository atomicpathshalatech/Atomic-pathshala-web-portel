import { renderFormulaContent } from "@/lib/test-portal/formula";

/**
 * Printable HTML for a Question Module (rendered to PDF by headless Chromium
 * in renderHtmlPdf). Question blocks never split across pages
 * (break-inside: avoid); page numbers/headers come from Chromium's
 * header/footer templates.
 */

export type ModuleDisplayFormat = "QUESTION_ONLY" | "WITH_OPTIONS" | "ANSWER_KEY_END" | "SOLUTIONS_SECTION" | "SOLUTION_AFTER_EACH";

export type RenderItem =
  | { kind: "NOTE"; text: string }
  | {
      kind: "QUESTION";
      statement: string;
      options: { key: string; text: string }[];
      answer: string | null; // "A" / "A,C"
      solution: string | null;
      imageUrl: string | null;
      sourceLabel: string | null; // only from a VERIFIED occurrence
      pageBreakBefore?: boolean;
      missing?: boolean; // the bank question was deleted
    };

export type RenderSection = { title: string; instructions: string | null; pageBreakBefore: boolean; items: RenderItem[] };

export type RenderModule = {
  title: string;
  subtitle: string | null;
  subject: string | null;
  chapter: string | null;
  displayFormat: ModuleDisplayFormat;
  showSourceLabels: boolean;
  pageSize: "A4" | "LETTER" | "A5";
  coverPage: boolean;
  contentsPage: boolean;
  fontSizePt: number;
  questionGapMm: number;
  logoUrl: string | null;
  sections: RenderSection[];
};

export type PreflightWarning = { level: "error" | "warning"; message: string };

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (s: string) => renderFormulaContent(String(s ?? ""));
const OPTION_LABELS: Record<string, string> = { A: "(1)", B: "(2)", C: "(3)", D: "(4)" };

/** Problems to fix (errors) or know about (warnings) before exporting. */
export function preflightModule(m: RenderModule): PreflightWarning[] {
  const w: PreflightWarning[] = [];
  const questions = m.sections.flatMap((s) => s.items.filter((i): i is Extract<RenderItem, { kind: "QUESTION" }> => i.kind === "QUESTION"));
  if (!questions.length) w.push({ level: "error", message: "The module has no questions yet." });
  m.sections.forEach((s, i) => {
    if (!s.items.length) w.push({ level: "warning", message: `Exercise ${i + 1} "${s.title}" is empty.` });
  });
  let n = 0;
  for (const s of m.sections) {
    for (const it of s.items) {
      if (it.kind !== "QUESTION") continue;
      n++;
      if (it.missing) {
        w.push({ level: "error", message: `Q${n}: the question was deleted from the Question Bank — remove it from the module.` });
        continue;
      }
      if (!it.statement.trim()) w.push({ level: "error", message: `Q${n}: question text is empty.` });
      if (m.displayFormat !== "QUESTION_ONLY" && it.options.length && it.options.some((o) => !o.text.trim())) w.push({ level: "warning", message: `Q${n}: an option is empty.` });
      if (m.displayFormat !== "QUESTION_ONLY" && m.displayFormat !== "WITH_OPTIONS" && !it.answer) w.push({ level: "warning", message: `Q${n}: no answer — it will show "—" in the answer key.` });
      if ((m.displayFormat === "SOLUTIONS_SECTION" || m.displayFormat === "SOLUTION_AFTER_EACH") && !it.solution) w.push({ level: "warning", message: `Q${n}: no solution available.` });
      if (/\[FIGURE\]|\bfigure (?:below|above)\b|diagram shown/i.test(it.statement) && !it.imageUrl) w.push({ level: "warning", message: `Q${n}: mentions a figure but has no image.` });
      if (it.statement.length > 3000) w.push({ level: "warning", message: `Q${n}: very long question — check it fits on one page.` });
    }
  }
  return w;
}

/** "Exercise 2: NEET PYQs" — unless the title already starts with "Exercise …" / "Chapter …". */
function exerciseHeading(title: string, n: number): string {
  return /^\s*(exercise|chapter|section|part)\b/i.test(title) ? title : `Exercise ${n}: ${title}`;
}

function questionHtml(it: Extract<RenderItem, { kind: "QUESTION" }>, number: number, m: RenderModule): string {
  const showOptions = m.displayFormat !== "QUESTION_ONLY";
  const label = m.showSourceLabels && it.sourceLabel ? `<span class="src">[${esc(it.sourceLabel)}]</span>` : "";
  const img = it.imageUrl ? `<div class="fig"><img src="${esc(it.imageUrl)}" alt="Figure for question ${number}"/></div>` : "";
  const opts = showOptions && it.options.length
    ? `<ol class="opts">${it.options.map((o) => `<li><span class="ok">${OPTION_LABELS[o.key] ?? `(${esc(o.key)})`}</span> <span>${rich(o.text)}</span></li>`).join("")}</ol>`
    : "";
  const inlineSol = m.displayFormat === "SOLUTION_AFTER_EACH"
    ? `<div class="sol"><b>Answer: ${it.answer ? it.answer.split(",").map((a) => OPTION_LABELS[a] ?? a).join(", ") : "—"}</b>${it.solution ? `<div>${rich(it.solution)}</div>` : `<div class="na">Solution not available.</div>`}</div>`
    : "";
  return `<div class="q${it.pageBreakBefore ? " pb" : ""}"><div class="qh"><span class="qn">${number}.</span><div class="qt">${rich(it.statement)} ${label}</div></div>${img}${opts}${inlineSol}</div>`;
}

export function renderModuleHtml(m: RenderModule): string {
  let n = 0;
  const numbered = m.sections.map((s) => ({
    ...s,
    items: s.items.map((it) => (it.kind === "QUESTION" ? { it, number: ++n } : { it, number: 0 })),
  }));
  const total = n;

  const cover = m.coverPage
    ? `<section class="cover">${m.logoUrl ? `<img class="logo" src="${esc(m.logoUrl)}" alt="Atomic Pathshala"/>` : ""}<div class="brand">ATOMIC <span>PATHSHALA</span></div><h1>${esc(m.title)}</h1>${m.subtitle ? `<h2>${esc(m.subtitle)}</h2>` : ""}<p class="meta">${[m.subject, m.chapter].filter(Boolean).map((x) => esc(x!)).join(" · ")}</p><p class="meta">${total} question${total === 1 ? "" : "s"} · ${m.sections.length} exercise${m.sections.length === 1 ? "" : "s"}</p></section>`
    : "";

  let start = 1;
  const contents = m.contentsPage && m.sections.length > 0
    ? `<section class="contents"><h2>Contents</h2><table>${numbered
        .map((s, i) => {
          const count = s.items.filter((x) => x.number).length;
          const range = count ? `Q${start}–Q${start + count - 1}` : "—";
          start += count;
          return `<tr><td>${esc(exerciseHeading(s.title, i + 1))}</td><td class="r">${range}</td></tr>`;
        })
        .join("")}</table>${m.displayFormat === "ANSWER_KEY_END" || m.displayFormat === "SOLUTIONS_SECTION" ? `<p class="meta">Answer key${m.displayFormat === "SOLUTIONS_SECTION" ? " and detailed solutions" : ""} at the end.</p>` : ""}</section>`
    : "";

  const body = numbered
    .map(
      (s, i) =>
        `<section class="exercise${s.pageBreakBefore && i > 0 ? " pb" : ""}"><h2 class="ex">${esc(exerciseHeading(s.title, i + 1))}</h2>${s.instructions ? `<p class="inst">${rich(s.instructions)}</p>` : ""}${s.items
          .map(({ it, number }) => (it.kind === "NOTE" ? `<div class="note">${rich(it.text)}</div>` : questionHtml(it, number, m)))
          .join("")}</section>`
    )
    .join("");

  const allQ = numbered.flatMap((s) => s.items.filter((x) => x.it.kind === "QUESTION")) as { it: Extract<RenderItem, { kind: "QUESTION" }>; number: number }[];
  const key = m.displayFormat === "ANSWER_KEY_END" || m.displayFormat === "SOLUTIONS_SECTION"
    ? `<section class="pb answers"><h2 class="ex">Answer Key</h2><div class="keygrid">${allQ
        .map(({ it, number }) => `<div><b>${number}.</b> ${it.answer ? it.answer.split(",").map((a) => OPTION_LABELS[a] ?? a).join(", ") : "—"}</div>`)
        .join("")}</div></section>`
    : "";
  const sols = m.displayFormat === "SOLUTIONS_SECTION"
    ? `<section class="pb"><h2 class="ex">Detailed Solutions</h2>${allQ
        .map(({ it, number }) => `<div class="q"><div class="qh"><span class="qn">${number}.</span><div class="qt"><b>Answer: ${it.answer ? it.answer.split(",").map((a) => OPTION_LABELS[a] ?? a).join(", ") : "—"}</b>${it.solution ? `<div>${rich(it.solution)}</div>` : `<div class="na">Solution not available.</div>`}</div></div></div>`)
        .join("")}</section>`
    : "";

  const size = m.pageSize === "LETTER" ? "letter" : m.pageSize === "A5" ? "A5" : "A4";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(m.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Noto+Serif+Devanagari:wght@400;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<style>
@page { size: ${size}; margin: 18mm 14mm 18mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Tinos, "Noto Serif Devanagari", serif; font-size: ${m.fontSizePt}pt; color: #111; line-height: 1.45; margin: 0; }
.pb { break-before: page; }
.cover { height: 240mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; break-after: page; }
.cover .logo { width: 28mm; height: 28mm; object-fit: contain; margin-bottom: 6mm; }
.brand { font-family: Montserrat, sans-serif; font-weight: 800; letter-spacing: .08em; font-size: 14pt; } .brand span { color: #ea580c; }
.cover h1 { font-family: Montserrat, sans-serif; font-size: 24pt; margin: 10mm 0 3mm; } .cover h2 { font-weight: 400; font-size: 14pt; margin: 0 0 6mm; color: #333; }
.meta { color: #555; margin: 1mm 0; }
.contents { break-after: page; } .contents h2 { font-family: Montserrat, sans-serif; } .contents table { width: 100%; border-collapse: collapse; } .contents td { padding: 2mm 1mm; border-bottom: 1px solid #ddd; } .contents .r { text-align: right; white-space: nowrap; }
h2.ex { font-family: Montserrat, sans-serif; font-size: 13pt; border-bottom: 2px solid #ea580c; padding-bottom: 1.5mm; margin: 0 0 3mm; break-after: avoid; }
.inst { font-style: italic; color: #333; margin: 0 0 3mm; }
.note { margin: 2mm 0 3mm; padding: 2mm 3mm; background: #f6f6f6; border-left: 3px solid #999; break-inside: avoid; }
.q { break-inside: avoid; margin: 0 0 ${m.questionGapMm}mm; }
.qh { display: flex; gap: 2mm; } .qn { font-weight: 700; min-width: 8mm; } .qt { flex: 1; overflow-wrap: anywhere; }
.src { color: #0369a1; font-size: .85em; white-space: nowrap; }
.fig { margin: 2mm 0 2mm 10mm; } .fig img { max-width: 100%; max-height: 70mm; object-fit: contain; }
.opts { list-style: none; padding: 0; margin: 1.5mm 0 0 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 6mm; }
.opts li { overflow-wrap: anywhere; } .ok { font-weight: 700; }
.sol { margin: 2mm 0 0 10mm; padding: 2mm 3mm; border: 1px dashed #bbb; background: #fbfbfb; }
.na { color: #888; font-style: italic; }
.keygrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.5mm 4mm; }
.katex { font-size: 1.02em; } table { max-width: 100%; }
</style></head><body>${cover}${contents}${body}${key}${sols}</body></html>`;
}
