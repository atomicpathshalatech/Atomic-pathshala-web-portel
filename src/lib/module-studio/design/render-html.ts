import katex from "katex";
import { renderFormulaContent } from "@/lib/test-portal/formula";
import type { ModuleElementInput } from "@/lib/validation/module";
import { fillTokens, pageBox, type DesignSection, type DesignTheme, type ModuleDesign, type SectionKind } from "./model";
import { calloutElements, formulaElements, questionUnits, theoryElements, type ContentPage, type QuestionUnit } from "./content";

/**
 * HTML for the designed module, printed to PDF by headless Chromium
 * (render-pdf.ts). Two documents: the cover (one page, positioned freely) and
 * the body (every other section, flowing across pages with the page-break
 * rules). Header, footer and page numbers come from Chromium's own page
 * templates; background, watermark and master-page graphics are drawn per
 * page afterwards (render-pdf.ts), because Chromium does not repeat fixed
 * elements reliably on every printed page.
 */

export type ChapterInfo = { description?: string | null; learningObjectives?: string | null; prerequisites?: string | null };
export type TocEntry = { anchor: string; label: string; level: 1 | 2 };

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (t: string) => renderFormulaContent(t || "");
const displayMath = (latex: string) => {
  try {
    return katex.renderToString(latex || "", { throwOnError: false, displayMode: true });
  } catch {
    return esc(latex);
  }
};
const imageUrl = (content: string) => content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] ?? (/^https?:\/\//.test(content.trim()) ? content.trim() : null);

const DEVANAGARI: Record<string, string> = { "Noto Serif": "Noto Serif Devanagari", Merriweather: "Noto Serif Devanagari" };
export const fontStack = (f: string) => `"${f}", "${DEVANAGARI[f] ?? "Noto Sans Devanagari"}", "Noto Sans Devanagari", "Nirmala UI", sans-serif`;

export function fontLink(themes: DesignTheme[]) {
  const fams = new Set<string>(["Noto Sans", "Noto Sans Devanagari", "Noto Serif Devanagari"]);
  for (const t of themes) {
    fams.add(t.headingFont);
    fams.add(t.bodyFont);
  }
  const q = [...fams].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;700${f === "Poppins" ? ";800" : ""}`).join("&");
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap">`;
}

const themeVars = (t: Partial<DesignTheme>) =>
  [
    t.primary && `--p:${t.primary}`,
    t.deep && `--deep:${t.deep}`,
    t.soft && `--soft:${t.soft}`,
    t.accent && `--accent:${t.accent}`,
    t.ink && `--ink:${t.ink}`,
    t.headingFont && `--hf:${fontStack(t.headingFont)}`,
    t.bodyFont && `--bf:${fontStack(t.bodyFont)}`,
    t.baseSizePt && `--fs:${t.baseSizePt}pt`,
    t.lineHeight && `--lh:${t.lineHeight}`,
    t.radiusMm != null && `--r:${t.radiusMm}mm`,
    t.borderWidthPt != null && `--bw:${t.borderWidthPt}pt`,
    t.borderStyle && `--bs:${t.borderStyle}`,
  ]
    .filter(Boolean)
    .join(";");

export function effectiveTheme(d: ModuleDesign, s?: DesignSection): DesignTheme {
  return { ...d.theme, ...(s?.themeOverride ?? {}) } as DesignTheme;
}

function elementStyle(el: ModuleElementInput): string {
  const s = el.style;
  if (!s) return "";
  return [
    s.fontFamily && `font-family:${s.fontFamily === "times" ? '"Noto Serif","Noto Serif Devanagari",serif' : s.fontFamily === "courier" ? "monospace" : "inherit"}`,
    s.fontSize && `font-size:${s.fontSize}pt`,
    s.bold != null && `font-weight:${s.bold ? 700 : 400}`,
    s.italic && "font-style:italic",
    s.color && `color:${s.color}`,
    s.align && `text-align:${s.align}`,
    s.lineHeight && `line-height:${s.lineHeight}`,
    s.letterSpacing != null && `letter-spacing:${s.letterSpacing}pt`,
  ]
    .filter(Boolean)
    .join(";");
}

/** data-* used by the page-break checks; keep / split decided by the rules and the block's own override. */
function keepAttrs(el: ModuleElementInput | null, label: string, defaultKeep: boolean) {
  const keep = el?.layout?.keepTogether ?? defaultKeep;
  return `data-keep="${keep ? 1 : 0}" data-label="${esc(label)}"${el?.layout?.breakBefore ? ' data-break-before="1"' : ""}`;
}

type Ctx = { d: ModuleDesign; pages: ContentPage[]; counters: { h2: number; fig: number }; toc: TocEntry[]; chapter?: ChapterInfo | null; pyqSectionOn: boolean };

function renderTheory(els: (ModuleElementInput & { sourcePage?: number })[], c: Ctx, sec: DesignSection): string {
  const r = c.d.rules;
  const out: string[] = [];
  for (const el of els) {
    const st = elementStyle(el);
    const brk = el.layout?.breakBefore ? `<div class="pb"></div>` : "";
    const where = el.sourcePage ? ` (module page ${el.sourcePage})` : "";
    switch (el.type) {
      case "HEADING": {
        c.counters.h2++;
        const anchor = `h-${sec.id}-${c.counters.h2}`;
        c.toc.push({ anchor, label: el.content.replace(/\$[^$]*\$/g, "").replace(/\*\*/g, "").trim().slice(0, 120), level: 2 });
        out.push(`${brk}<h2 id="${anchor}" class="h2${r.headingWithNext ? " keep-next" : ""}" style="${st}"><span class="h2-num">${String(c.counters.h2).padStart(2, "0")}</span><span>${rich(el.content)}</span></h2>`);
        break;
      }
      case "SUBHEADING":
        out.push(`${brk}<h3 class="h3${r.headingWithNext ? " keep-next" : ""}" style="${st}">${rich(el.content)}</h3>`);
        break;
      case "BULLETS":
        out.push(`${brk}<ul class="bullets" style="${st}">${el.content.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `<li>${rich(x)}</li>`).join("")}</ul>`);
        break;
      case "CALLOUT": {
        const v = (el.variant ?? "NOTE").toUpperCase();
        const label = el.label || v.charAt(0) + v.slice(1).toLowerCase();
        out.push(`${brk}<div class="callout c-${esc(v)}" ${keepAttrs(el, `Box "${label}"${where}`, true)} style="${st}"><div class="callout-head">${esc(label)}</div><div class="callout-body">${el.content.split(/\n{2,}/).map((p) => `<p>${rich(p)}</p>`).join("")}</div></div>`);
        break;
      }
      case "TABLE": {
        const rows = el.tableData ?? [];
        if (!rows.length) break;
        const [head, ...body] = rows;
        out.push(`${brk}<div class="table-wrap" ${keepAttrs(el, `Table${where}`, r.avoidSplittingTables)}><table style="${st}"><thead><tr>${(head ?? []).map((x) => `<th>${rich(x)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((x) => `<td>${rich(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        break;
      }
      case "EQUATION":
      case "CHEMICAL_EQUATION":
        out.push(`${brk}<div class="equation" ${keepAttrs(el, `Equation${where}`, true)}>${displayMath(el.content.replace(/^\$+|\$+$/g, ""))}</div>`);
        break;
      case "IMAGE":
      case "DIAGRAM":
      case "CHEMICAL_STRUCTURE": {
        const url = imageUrl(el.content);
        if (!url) {
          if (el.content.trim()) out.push(`<p>${rich(el.content)}</p>`);
          break;
        }
        c.counters.fig++;
        const wrap = el.layout?.wrap ?? "none";
        const pct = el.layout?.widthPct ?? (wrap === "none" ? null : 42);
        const wmm = el.content.match(/!\[w=(\d{1,3})mm\]/)?.[1];
        const width = pct ? `width:${pct}%` : wmm ? `width:${wmm}mm;max-width:100%` : "";
        out.push(`${brk}<figure class="figure wrap-${wrap}" style="${width}" ${keepAttrs(el, `Picture${where}`, r.avoidSplittingFigures)}><img src="${esc(url)}" alt=""/>${el.label ? `<figcaption><b>Fig. ${c.counters.fig}</b> ${rich(el.label)}</figcaption>` : ""}</figure>`);
        break;
      }
      case "PAGE_BREAK":
        out.push(`<div class="pb"></div>`);
        break;
      default:
        if (el.content.trim()) out.push(`${brk}<p style="${st}">${rich(el.content)}</p>`);
    }
  }
  return out.join("\n");
}

function questionCard(u: QuestionUnit, c: Ctx, opts: { answers: boolean; solution: boolean }) {
  const r = c.d.rules;
  const long = u.options.some((o) => o.content.replace(/\$[^$]*\$/g, "xx").length > 34);
  const label = `Question ${u.number} (module page ${u.sourcePage})`;
  const keep = u.question.layout?.keepTogether ?? r.keepQuestionTogether;
  const opt = u.options.length
    ? `<div class="options ${long ? "one-col" : ""}" ${r.keepOptionsTogether ? 'data-keep-soft="1"' : ""}>${u.options.map((o) => `<div class="option" style="${elementStyle(o)}">${rich(o.content)}</div>`).join("")}</div>`
    : "";
  const ans = opts.answers && u.answer ? `<div class="answer"><span class="tag">Answer</span> ${rich(u.answer)}</div>` : "";
  const sol = opts.solution && u.solution ? `<div class="solution"><div class="sol-head${r.keepSolutionHeading ? " keep-next" : ""}"><span class="tag">Solution</span></div><div class="sol-body">${rich(u.solution.content.replace(/^\s*(sol(ution)?|हल)\s*[.:\-–]?\s*/i, ""))}</div></div>` : "";
  return `${u.question.layout?.breakBefore ? '<div class="pb"></div>' : ""}<div class="q-card" data-keep="${keep ? 1 : 0}" data-label="${esc(label)}"><div class="q-head"><span class="q-num">${u.number}</span><div class="q-text" style="${elementStyle(u.question)}">${rich(u.question.content.replace(/^\s*(?:q(?:ue(?:stion)?)?\.?\s*)?\d{1,3}\s*[.):]\s*/i, ""))}</div></div>${opt}${ans}${sol}</div>`;
}

function sectionBody(sec: DesignSection, c: Ctx): { html: string; empty: boolean } {
  const d = c.d;
  switch (sec.kind) {
    case "CONTENTS":
      return { html: `<div class="toc" data-toc="1"></div>`, empty: false };
    case "CHAPTER_INTRO": {
      const lines = (v?: string | null) => (v || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
      const learn = lines(c.chapter?.learningObjectives);
      const pre = lines(c.chapter?.prerequisites);
      return {
        empty: false,
        html: `<div class="intro"><div class="intro-kicker">${esc([d.setup.subject, d.setup.className].filter(Boolean).join(" · "))}</div><div class="intro-title">${esc(d.setup.chapterName || d.setup.title)}</div>${c.chapter?.description ? `<p class="intro-desc">${rich(c.chapter.description)}</p>` : ""}${learn.length ? `<div class="callout c-CONCEPT"><div class="callout-head">What you will learn</div><ul class="bullets">${learn.map((x) => `<li>${rich(x)}</li>`).join("")}</ul></div>` : ""}${pre.length ? `<div class="callout c-NOTE"><div class="callout-head">Before you start</div><ul class="bullets">${pre.map((x) => `<li>${rich(x)}</li>`).join("")}</ul></div>` : ""}${sec.note ? `<div class="note">${sec.note.split(/\n{2,}/).map((p) => `<p>${rich(p)}</p>`).join("")}</div>` : ""}</div>`,
      };
    }
    case "THEORY": {
      const els = theoryElements(c.pages, sec);
      return { html: renderTheory(els, c, sec), empty: els.length === 0 };
    }
    case "QUESTIONS":
    case "PYQ":
    case "PRACTICE": {
      let units = questionUnits(c.pages, sec);
      if (sec.kind === "PYQ") units = units.filter((u) => u.pyq);
      else if (sec.kind === "QUESTIONS" && c.pyqSectionOn && !sec.fromPage && !sec.toPage) units = units.filter((u) => !u.pyq);
      const strip = sec.kind === "PRACTICE" ? `<div class="practice-strip"><span>Name ____________________</span><span>Date __________</span><span>Score ______ / ${units.length}</span></div>` : "";
      return { html: strip + units.map((u) => questionCard(u, c, { answers: false, solution: false })).join("\n"), empty: units.length === 0 };
    }
    case "ANSWER_KEY": {
      const units = questionUnits(c.pages, sec);
      const cells = units.map((u) => `<div class="ak-cell"><span class="ak-q">${u.number}</span><span class="ak-a">${u.answer ? rich(u.answer) : "—"}</span></div>`).join("");
      return { html: `<div class="ak-grid">${cells}</div>`, empty: units.length === 0 };
    }
    case "SOLUTIONS": {
      const units = questionUnits(c.pages, sec).filter((u) => u.solution || u.answer);
      return { html: units.map((u) => questionCard(u, c, { answers: true, solution: true })).join("\n"), empty: units.length === 0 };
    }
    case "SUMMARY": {
      const els = calloutElements(c.pages, ["SUMMARY", "CONCEPT"], sec);
      const note = sec.note ? `<div class="note">${sec.note.split(/\n{2,}/).map((p) => `<p>${rich(p)}</p>`).join("")}</div>` : "";
      return { html: note + renderTheory(els, c, sec), empty: els.length === 0 && !sec.note };
    }
    case "FORMULA_SHEET": {
      const els = formulaElements(c.pages, sec);
      return { html: `<div class="formula-grid">${els.map((e) => (e.type === "CALLOUT" ? `<div class="formula-card" data-keep="1" data-label="Formula">${rich(e.content)}</div>` : `<div class="formula-card" data-keep="1" data-label="Formula">${displayMath(e.content.replace(/^\$+|\$+$/g, ""))}</div>`)).join("")}</div>${sec.note ? `<div class="note">${rich(sec.note)}</div>` : ""}`, empty: els.length === 0 && !sec.note };
    }
    case "REVISION": {
      const els = calloutElements(c.pages, ["REMEMBER", "TIP", "CAUTION", "NOTE"], sec);
      const bullets = theoryElements(c.pages, sec).filter((e) => e.type === "BULLETS");
      const note = sec.note ? `<div class="note">${sec.note.split(/\n{2,}/).map((p) => `<p>${rich(p)}</p>`).join("")}</div>` : "";
      return { html: note + renderTheory([...els, ...bullets], c, sec), empty: els.length + bullets.length === 0 && !sec.note };
    }
    default:
      return { html: "", empty: true };
  }
}

function baseCss(d: ModuleDesign, bleed: number) {
  const { w, h } = pageBox(d);
  const t = d.theme;
  const p = d.page;
  return `
  :root { ${themeVars(t)}; }
  @page { size: ${w + 2 * bleed}mm ${h + 2 * bleed}mm; margin: ${p.marginTopMm + bleed}mm ${p.marginRightMm + bleed}mm ${p.marginBottomMm + bleed}mm ${p.marginLeftMm + bleed}mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { font-family: var(--bf); font-size: var(--fs); line-height: var(--lh); color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  p { margin: 0 0 2.2mm; }
  .katex { font-size: 1.04em; }
  .pb { break-after: page; height: 0; }
  .sec { break-before: page; } .sec:first-of-type { break-before: auto; }
  .sec-title { font-family: var(--hf); color: var(--deep); font-weight: 800; font-size: calc(var(--fs) * 1.9); line-height: 1.2; margin: 0 0 5mm; padding-bottom: 2mm; break-after: avoid; }
  .flow.cols-2 { column-count: 2; column-gap: 7mm; column-rule: 0.4pt solid color-mix(in srgb, var(--p) 25%, transparent); }
  .flow.cols-2 .h2, .flow.cols-2 .practice-strip { column-span: all; }
  .keep-next { break-after: avoid; page-break-after: avoid; }
  [data-keep="1"] { break-inside: avoid; page-break-inside: avoid; }
  [data-keep-soft="1"] { break-inside: avoid; }
  [data-split="1"] { break-inside: auto !important; }
  .h2 { font-family: var(--hf); font-weight: 700; font-size: calc(var(--fs) * 1.45); line-height: 1.3; margin: 6mm 0 3mm; display: flex; gap: 3mm; align-items: center; color: var(--deep); }
  .h3 { font-family: var(--hf); font-weight: 600; font-size: calc(var(--fs) * 1.18); color: var(--deep); margin: 4.5mm 0 2mm; }
  .bullets { margin: 0 0 2.5mm; padding-left: 5mm; } .bullets li { margin-bottom: 1mm; }
  .callout { border: var(--bw) var(--bs) color-mix(in srgb, var(--cc, var(--p)) 45%, transparent); border-radius: var(--r); padding: 2.6mm 3.4mm 1.6mm; margin: 3mm 0; background: color-mix(in srgb, var(--cc, var(--p)) 7%, white); }
  .callout-head { font-family: var(--hf); font-weight: 700; font-size: calc(var(--fs) * .88); text-transform: uppercase; letter-spacing: .04em; color: var(--cc, var(--p)); margin-bottom: 1.2mm; }
  .c-CONCEPT { --cc: #2563eb } .c-NOTE { --cc: #d97706 } .c-EXAMPLE { --cc: #7c3aed } .c-TIP { --cc: #059669 } .c-REMEMBER { --cc: #e11d48 } .c-CAUTION { --cc: #dc2626 } .c-FORMULA { --cc: #4338ca } .c-SUMMARY { --cc: #0d9488 }
  .table-wrap { margin: 3mm 0; border: var(--bw) solid color-mix(in srgb, var(--p) 30%, #e5e7eb); border-radius: var(--r); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: calc(var(--fs) * .93); }
  th { background: var(--p); color: #fff; text-align: left; font-family: var(--hf); font-weight: 600; padding: 1.8mm 2.6mm; }
  td { padding: 1.6mm 2.6mm; border-top: 0.5pt solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) td { background: var(--soft); }
  .equation { margin: 3mm 0; padding: 2mm 3mm; background: var(--soft); border-radius: var(--r); text-align: center; }
  .figure { margin: 3mm auto; text-align: center; } .figure img { max-width: 100%; max-height: 110mm; object-fit: contain; }
  .figure.wrap-left { float: left; margin: 1mm 4mm 2mm 0; } .figure.wrap-right { float: right; margin: 1mm 0 2mm 4mm; }
  .h2, .h3, .q-card, .table-wrap, .pb, .sec-title { clear: both; }
  figcaption { font-size: calc(var(--fs) * .85); color: #475569; margin-top: 1mm; } figcaption b { color: var(--p); }
  .q-card { margin: 2.6mm 0; padding: 2.4mm 3mm; border: var(--bw) var(--bs) #e2e8f0; border-radius: var(--r); background: #fff; }
  .q-head { display: flex; gap: 2.5mm; align-items: flex-start; } .q-num { flex: none; min-width: 6.5mm; height: 6.5mm; border-radius: 99px; background: var(--p); color: #fff; font-family: var(--hf); font-weight: 700; font-size: calc(var(--fs) * .85); display: flex; align-items: center; justify-content: center; }
  .q-text { font-weight: 600; flex: 1; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2mm 4mm; margin: 2mm 0 0 9mm; } .options.one-col { grid-template-columns: 1fr; }
  .option { padding: .8mm 2mm; border-radius: calc(var(--r) * .6); background: #f8fafc; }
  .answer, .solution { margin: 2mm 0 0 9mm; } .solution { padding: 2mm 3mm; border-radius: var(--r); background: color-mix(in srgb, #16a34a 6%, white); border: 0.6pt dashed #86efac; }
  .tag { display: inline-block; font-family: var(--hf); font-weight: 700; font-size: calc(var(--fs) * .78); color: #fff; background: #16a34a; border-radius: 99px; padding: .3mm 2.2mm; text-transform: uppercase; letter-spacing: .05em; }
  .practice-strip { display: flex; justify-content: space-between; gap: 4mm; border: var(--bw) solid var(--p); border-radius: var(--r); padding: 2.5mm 4mm; margin-bottom: 4mm; font-weight: 600; }
  .ak-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.4mm; }
  .ak-cell { display: flex; justify-content: space-between; border: 0.6pt solid color-mix(in srgb, var(--p) 35%, #e5e7eb); border-radius: calc(var(--r) * .6); padding: 1.2mm 2.4mm; break-inside: avoid; }
  .ak-q { font-weight: 700; color: var(--p); } .ak-a { font-weight: 600; }
  .formula-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; } .formula-card { border: var(--bw) var(--bs) color-mix(in srgb, var(--p) 40%, transparent); border-radius: var(--r); padding: 2.5mm; background: var(--soft); }
  .flow.cols-2 .formula-grid { grid-template-columns: 1fr; }
  .intro-kicker { font-family: var(--hf); font-weight: 600; color: var(--p); text-transform: uppercase; letter-spacing: .12em; font-size: calc(var(--fs) * .9); }
  .intro-title { font-family: var(--hf); font-weight: 800; font-size: calc(var(--fs) * 2.6); line-height: 1.15; color: var(--deep); margin: 2mm 0 5mm; }
  .intro-desc { font-size: calc(var(--fs) * 1.08); }
  .note { margin: 2mm 0 4mm; }
  .toc-row { display: flex; align-items: baseline; gap: 2mm; padding: 1.4mm 0; break-inside: avoid; } .toc-row.l1 { font-family: var(--hf); font-weight: 700; color: var(--deep); margin-top: 2mm; font-size: calc(var(--fs) * 1.08); } .toc-row.l2 { padding-left: 6mm; }
  .toc-dots { flex: 1; border-bottom: 0.8pt dotted #94a3b8; transform: translateY(-1mm); } .toc-num { font-variant-numeric: tabular-nums; min-width: 8mm; text-align: right; font-weight: 600; }
  .toc a { color: inherit; text-decoration: none; }

  /* ---- template styles ---- */
  .style-PREMIUM .sec-title { border-bottom: 1.4mm solid var(--p); }
  .style-PREMIUM .h2 { background: linear-gradient(90deg, var(--p), color-mix(in srgb, var(--p) 70%, var(--accent))); color: #fff; padding: 2.4mm 3.5mm; border-radius: var(--r); }
  .style-PREMIUM .h2-num { background: rgba(255,255,255,.22); border-radius: calc(var(--r) * .6); padding: .4mm 2mm; font-size: .8em; }
  .style-PREMIUM .h3 { border-left: 1.3mm solid var(--accent); padding-left: 2.6mm; }
  .style-MINIMAL .sec-title { font-weight: 700; border-bottom: 0.6pt solid var(--ink); }
  .style-MINIMAL .h2 { border-bottom: 0.6pt solid color-mix(in srgb, var(--p) 60%, transparent); padding-bottom: 1mm; }
  .style-MINIMAL .h2-num { color: var(--p); }
  .style-MINIMAL .q-card { border: none; border-bottom: 0.5pt solid #e2e8f0; border-radius: 0; padding-left: 0; }
  .style-MINIMAL .q-num { background: transparent; color: var(--p); border: 0.8pt solid var(--p); }
  .style-MINIMAL .callout { background: transparent; border-width: 0 0 0 1mm; border-radius: 0; }
  .style-MINIMAL .option { background: transparent; }
  .style-CLASSROOM .sec-title { background: var(--soft); color: var(--p); border-radius: calc(var(--r) * 2); padding: 3mm 5mm; border: var(--bw) dashed var(--p); }
  .style-CLASSROOM .h2 { background: var(--soft); border: var(--bw) dashed var(--p); border-radius: calc(var(--r) * 2.5); padding: 2.4mm 4mm; color: var(--p); }
  .style-CLASSROOM .h2-num { background: var(--accent); color: #fff; border-radius: 99px; padding: .4mm 2.2mm; }
  .style-CLASSROOM .q-card { border-color: color-mix(in srgb, var(--p) 40%, transparent); border-radius: calc(var(--r) * 2.5); background: color-mix(in srgb, var(--soft) 55%, white); }
  .style-CLASSROOM .q-num { background: var(--accent); }
  .style-CLASSROOM .callout { border-radius: calc(var(--r) * 2.5); border-style: dashed; }
  .style-EXAM { font-size: calc(var(--fs) * .95); }
  .style-EXAM .sec-title { font-size: calc(var(--fs) * 1.4); text-transform: uppercase; letter-spacing: .06em; text-align: center; border-top: 0.8pt solid var(--ink); border-bottom: 0.8pt solid var(--ink); padding: 1.5mm 0; color: var(--ink); }
  .style-EXAM .h2 { color: var(--ink); font-size: calc(var(--fs) * 1.2); }
  .style-EXAM .q-card { border: none; border-radius: 0; padding: 1.2mm 0; margin: 1.6mm 0; background: none; }
  .style-EXAM .q-num { background: none; color: var(--ink); border-radius: 0; min-width: 5.5mm; justify-content: flex-start; font-size: 1em; }
  .style-EXAM .q-num::after { content: "."; }
  .style-EXAM .option { background: none; padding: .3mm 0; }
  .style-EXAM .options { margin-left: 7.5mm; }
  .style-EXAM .ak-cell { border-color: var(--ink); border-radius: 0; }
  .style-EXAM .ak-q { color: var(--ink); }
  `;
}

/** The body: every section except the cover, in order, flowing across pages. */
export function buildBodyHtml(d: ModuleDesign, pages: ContentPage[], opts: { chapter?: ChapterInfo | null; tocPages?: Record<string, number> | null }) {
  const bleed = d.output.mode === "PRINT" ? d.output.bleedMm : 0;
  const ctx: Ctx = { d, pages, counters: { h2: 0, fig: 0 }, toc: [], chapter: opts.chapter, pyqSectionOn: d.sections.some((s) => s.enabled && s.kind === "PYQ") };
  const skipped: string[] = [];
  const parts: string[] = [];
  const themes: DesignTheme[] = [d.theme];
  const body = d.sections.filter((s) => s.enabled && s.kind !== "COVER");
  for (const s of body) {
    const r = sectionBody(s, ctx);
    if (r.empty) {
      skipped.push(s.title);
      continue;
    }
    const anchor = `sec-${s.id}`;
    if (s.kind !== "CONTENTS") ctx.toc.splice(ctx.toc.length - (r.html.match(/<h2 id=/g)?.length ?? 0), 0, { anchor, label: s.title, level: 1 });
    if (s.themeOverride) themes.push(effectiveTheme(d, s));
    parts.push(
      `<section class="sec kind-${s.kind} style-${s.style}" id="${anchor}" style="${themeVars(s.themeOverride ?? {})}"><h1 class="sec-title">${esc(s.title)}</h1><div class="flow cols-${s.columns}">${r.html}</div></section>`
    );
  }
  const tocHtml = ctx.toc.map((e) => `<div class="toc-row l${e.level}"><a href="#${e.anchor}">${esc(e.label)}</a><span class="toc-dots"></span><span class="toc-num">${opts.tocPages ? (opts.tocPages[e.anchor] != null ? opts.tocPages[e.anchor] : "") : "00"}</span></div>`).join("");
  const html = `<!doctype html><html lang="${d.setup.language === "HINDI" ? "hi" : "en"}"><head><meta charset="utf-8"><title>${esc(d.setup.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css">${fontLink(themes)}
<style>${baseCss(d, bleed)}</style></head><body>
<nav aria-hidden="true" style="height:0;overflow:hidden">${ctx.toc.map((e) => `<a href="#${e.anchor}"></a>`).join("")}${body.map((s) => `<a href="#sec-${s.id}"></a>`).join("")}</nav>
${parts.join("\n").replace('<div class="toc" data-toc="1"></div>', `<div class="toc">${tocHtml}</div>`)}
</body></html>`;
  return { html, toc: ctx.toc, skipped, sectionAnchors: body.filter((s) => !skipped.includes(s.title)).map((s) => `sec-${s.id}`) };
}

/** Chromium page templates: text labels and page numbers on every body page. */
export function headerFooterTemplates(d: ModuleDesign) {
  const bleed = d.output.mode === "PRINT" ? d.output.bleedMm : 0;
  const hf = d.headerFooter;
  const t = d.theme;
  const tok = (s: string) => esc(fillTokens(s, d)).replace(/\{page\}/g, '<span class="pageNumber"></span>').replace(/\{pages\}/g, '<span class="totalPages"></span>');
  const strip = (s: string) => (d.headerFooter.numbering === "NONE" ? s.replace(/\{page\}|\{pages\}/g, "") : s);
  const base = `width:100%;box-sizing:border-box;padding:0 ${d.page.marginRightMm + bleed}mm 0 ${d.page.marginLeftMm + bleed}mm;font-family:'Noto Sans','Noto Sans Devanagari','Nirmala UI',sans-serif;font-size:7.5pt;color:#475569;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  return {
    headerTemplate: `<div style="${base}margin-top:${bleed + Math.max(4, d.page.marginTopMm - 10)}mm;border-bottom:0.6pt solid ${t.primary};padding-bottom:1.2mm;margin-left:${d.page.marginLeftMm + bleed}mm;margin-right:${d.page.marginRightMm + bleed}mm;padding-left:0;padding-right:0;width:auto;flex:1"><span style="color:${t.primary};font-weight:700">${tok(strip(hf.headerLeft))}</span><span>${tok(strip(hf.headerRight))}</span></div>`,
    footerTemplate: `<div style="${base}margin-bottom:${bleed + Math.max(3, d.page.marginBottomMm - 11)}mm"><span>${tok(strip(hf.footerLeft))}</span><span style="font-weight:600;color:${t.deep}">${tok(strip(hf.footerRight))}</span></div>`,
  };
}

/** The cover: one page, laid out by its template style, plus the teacher's placed graphics. */
export function buildCoverHtml(d: ModuleDesign, s: DesignSection) {
  const bleed = d.output.mode === "PRINT" ? d.output.bleedMm : 0;
  const { w, h } = pageBox(d);
  const t = effectiveTheme(d, s);
  const st = d.setup;
  const chips = [st.subject, st.className, st.batch, st.session].filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join("");
  const layouts: Record<string, string> = {
    PREMIUM: `<div class="cv cv-premium"><div class="cv-top"><span class="brand">Atomic Pathshala</span><span class="modno">MODULE ${esc(st.moduleNumber)}</span></div><div class="cv-mid"><div class="kicker">${esc(st.subject)}</div><h1>${esc(st.chapterName || st.title)}</h1>${st.chapterName && st.title !== st.chapterName ? `<div class="sub">${esc(st.title)}</div>` : ""}<div class="chips">${chips}</div></div><div class="cv-bottom">${st.author ? `<div class="by">Prepared by<b>${esc(st.author)}</b></div>` : "<div></div>"}</div></div>`,
    MINIMAL: `<div class="cv cv-minimal"><div class="kicker">${esc(st.subject)} · Module ${esc(st.moduleNumber)}</div><h1>${esc(st.chapterName || st.title)}</h1><div class="rule"></div>${st.chapterName && st.title !== st.chapterName ? `<div class="sub">${esc(st.title)}</div>` : ""}<div class="meta">${esc([st.className, st.batch, st.session].filter(Boolean).join("  ·  "))}</div><div class="by">${esc(st.author)}</div></div>`,
    CLASSROOM: `<div class="cv cv-classroom"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="inner"><div class="modno">Module ${esc(st.moduleNumber)}</div><h1>${esc(st.chapterName || st.title)}</h1><div class="chips">${chips}</div>${st.author ? `<div class="by">with <b>${esc(st.author)}</b></div>` : ""}</div></div>`,
    EXAM: `<div class="cv cv-exam"><div class="exam-box"><div class="kicker">${esc(st.subject)} — ${esc(st.className)}</div><h1>${esc(st.chapterName || st.title)}</h1><div class="sub">${esc(st.title !== st.chapterName ? st.title : "Practice & Test Module")}</div><table class="exam-meta"><tr><td>Module</td><td>${esc(st.moduleNumber)}</td><td>Session</td><td>${esc(st.session)}</td></tr><tr><td>Batch</td><td>${esc(st.batch)}</td><td>Faculty</td><td>${esc(st.author)}</td></tr></table><div class="omr">Name ___________________________ &nbsp; Roll No. __________</div></div></div>`,
  };
  const graphics = [...s.graphics].sort((a, b) => a.z - b.z).map((g) => graphicHtml(g, bleed, st.logoUrl)).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8">${fontLink([t])}
<style>
  :root { ${themeVars(t)}; }
  @page { size: ${w + 2 * bleed}mm ${h + 2 * bleed}mm; margin: 0; }
  * { box-sizing: border-box; } html, body { margin: 0; padding: 0; }
  body { width: ${w + 2 * bleed}mm; height: ${h + 2 * bleed}mm; overflow: hidden; position: relative; font-family: var(--bf); color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: absolute; inset: 0; overflow: hidden; }
  .cv { position: absolute; inset: 0; padding: ${bleed + 22}mm ${bleed + 18}mm; display: flex; flex-direction: column; }
  h1 { font-family: var(--hf); font-weight: 800; line-height: 1.12; margin: 0; }
  .chip { display: inline-block; border-radius: 99px; padding: 1.2mm 3.5mm; font-size: 9.5pt; margin: 0 2mm 2mm 0; }
  .by b { display: block; font-family: var(--hf); font-size: 14pt; }
  .cv-premium { justify-content: space-between; color: #fff; background: radial-gradient(120% 70% at 100% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 60%), linear-gradient(160deg, var(--p), var(--deep)); }
  .cv-premium .cv-top { display: flex; justify-content: space-between; align-items: center; padding-left: 34mm; } .cv-premium .brand { font-family: var(--hf); font-weight: 700; font-size: 13pt; }
  .cv-premium .modno { font-family: var(--hf); font-weight: 700; letter-spacing: .12em; background: rgba(255,255,255,.16); padding: 1.5mm 4mm; border-radius: 99px; font-size: 9.5pt; }
  .cv-premium .kicker { font-family: var(--hf); letter-spacing: .2em; text-transform: uppercase; font-weight: 600; opacity: .9; }
  .cv-premium h1 { font-size: 34pt; margin: 5mm 0 3mm; } .cv-premium .sub { font-size: 14pt; opacity: .92; margin-bottom: 6mm; } .cv-premium .chip { border: 0.8pt solid rgba(255,255,255,.4); }
  .cv-minimal { justify-content: center; background: #fff; } .cv-minimal .kicker { color: var(--p); font-family: var(--hf); font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
  .cv-minimal h1 { font-size: 36pt; color: var(--ink); margin: 6mm 0; } .cv-minimal .rule { width: 30mm; height: 1.2mm; background: var(--p); margin-bottom: 6mm; } .cv-minimal .sub { font-size: 13pt; color: #475569; } .cv-minimal .meta { margin-top: 10mm; color: #64748b; } .cv-minimal .by { margin-top: auto; font-family: var(--hf); font-weight: 600; }
  .cv-classroom { background: var(--soft); justify-content: center; align-items: center; text-align: center; }
  .cv-classroom .blob { position: absolute; border-radius: 50%; opacity: .9; } .b1 { width: 90mm; height: 90mm; background: var(--p); top: -25mm; right: -25mm; } .b2 { width: 60mm; height: 60mm; background: var(--accent); bottom: 20mm; left: -18mm; } .b3 { width: 30mm; height: 30mm; background: color-mix(in srgb, var(--p) 40%, white); bottom: 60mm; right: 30mm; }
  .cv-classroom .inner { position: relative; background: #fff; border-radius: 10mm; padding: 14mm 12mm; border: 1.2mm dashed var(--p); max-width: 150mm; }
  .cv-classroom .modno { display: inline-block; background: var(--accent); color: #fff; font-family: var(--hf); font-weight: 700; border-radius: 99px; padding: 1.5mm 5mm; }
  .cv-classroom h1 { font-size: 30pt; color: var(--p); margin: 6mm 0; } .cv-classroom .chip { background: var(--soft); color: var(--deep); }
  .cv-exam { justify-content: center; background: #fff; } .exam-box { border: 1.4pt solid var(--ink); padding: 12mm 10mm; } .cv-exam .kicker { text-transform: uppercase; letter-spacing: .1em; font-weight: 600; }
  .cv-exam h1 { font-size: 28pt; margin: 4mm 0; text-transform: uppercase; } .cv-exam .sub { margin-bottom: 8mm; } .exam-meta { width: 100%; border-collapse: collapse; } .exam-meta td { border: 0.6pt solid var(--ink); padding: 2mm 3mm; } .exam-meta td:nth-child(odd) { font-weight: 700; width: 22%; } .omr { margin-top: 10mm; }
  .g { position: absolute; }
</style></head><body><div class="page">${layouts[s.style] ?? layouts.PREMIUM}</div>${graphics}</body></html>`;
  return html;
}

function graphicHtml(g: ModuleDesign["sections"][number]["graphics"][number], bleed: number, logoUrl: string | null) {
  const box = `left:${g.x + bleed}mm;top:${g.y + bleed}mm;width:${g.w}mm;height:${g.h}mm;z-index:${10 + g.z};opacity:${g.opacity ?? 1}`;
  const src = g.kind === "LOGO" ? logoUrl : g.src;
  if (g.kind === "LOGO" || g.kind === "IMAGE") return src ? `<img class="g" src="${esc(src)}" alt="" style="${box};object-fit:contain"/>` : "";
  if (g.kind === "TEXT") return `<div class="g" style="${box};font-size:${g.fontSizePt ?? 12}pt;color:${g.color ?? "#000"};font-weight:${g.bold ? 700 : 400};text-align:${g.align ?? "left"};font-family:var(--hf);line-height:1.2">${esc(g.text ?? "")}</div>`;
  if (g.kind === "LINE") return `<svg class="g" style="${box};overflow:visible" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="none"><line x1="0" y1="0" x2="${g.w}" y2="${g.h}" stroke="${g.stroke ?? "#000"}" stroke-width="${((g.strokeWidthPt ?? 1) * 25.4) / 72}" vector-effect="non-scaling-stroke"/></svg>`;
  return `<div class="g" style="${box};background:${g.fill ?? "transparent"};border:${g.stroke ? `${g.strokeWidthPt ?? 1}pt solid ${g.stroke}` : "none"};border-radius:${g.kind === "ELLIPSE" ? "50%" : "0"}"></div>`;
}

export const KIND_ORDER_HINT: SectionKind[] = ["COVER", "CONTENTS", "CHAPTER_INTRO", "THEORY", "QUESTIONS", "PYQ", "PRACTICE", "ANSWER_KEY", "SOLUTIONS", "SUMMARY", "FORMULA_SHEET", "REVISION"];
