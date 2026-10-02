import katex from "katex";
import { renderFormulaContent } from "@/lib/test-portal/formula";
import type { ModuleElementInput } from "@/lib/validation/module";

/**
 * The premium, colourful notes design: a full HTML document that headless
 * Chromium prints to PDF (real fonts incl. Devanagari, KaTeX maths, colour
 * boxes). Also used as the on-screen preview.
 */

export type PremiumTheme = "ATOMIC_BLUE" | "SUNRISE" | "EMERALD" | "ROYAL";

type Palette = { primary: string; deep: string; soft: string; accent: string; ink: string; name: string };

export const PREMIUM_THEMES: Record<PremiumTheme, Palette> = {
  ATOMIC_BLUE: { name: "Atomic Blue", primary: "#1d4ed8", deep: "#172554", soft: "#eff6ff", accent: "#f59e0b", ink: "#0f172a" },
  SUNRISE: { name: "Sunrise", primary: "#ea580c", deep: "#7c2d12", soft: "#fff7ed", accent: "#2563eb", ink: "#1c1917" },
  EMERALD: { name: "Emerald", primary: "#047857", deep: "#064e3b", soft: "#ecfdf5", accent: "#d97706", ink: "#0f172a" },
  ROYAL: { name: "Royal", primary: "#6d28d9", deep: "#2e1065", soft: "#f5f3ff", accent: "#db2777", ink: "#18181b" },
};

// Each kind of box keeps its own colour in every theme, so students learn
// "green = tip, rose = remember" across all notes.
const CALLOUT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  CONCEPT: { color: "#2563eb", bg: "#eff6ff", icon: "M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z" },
  NOTE: { color: "#d97706", bg: "#fffbeb", icon: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6" },
  EXAMPLE: { color: "#7c3aed", bg: "#f5f3ff", icon: "M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zm0 0A1.5 1.5 0 0 0 5.5 21H20" },
  TIP: { color: "#059669", bg: "#ecfdf5", icon: "M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V7z" },
  REMEMBER: { color: "#e11d48", bg: "#fff1f2", icon: "M12 21s-7-4.4-9.5-8.6C.8 9.4 2.6 5 6.5 5c2.2 0 3.5 1.3 5.5 3.4C14 6.3 15.3 5 17.5 5c3.9 0 5.7 4.4 4 7.4C19 16.6 12 21 12 21z" },
  CAUTION: { color: "#dc2626", bg: "#fef2f2", icon: "M12 3l10 18H2zM12 10v5M12 18h.01" },
  FORMULA: { color: "#4338ca", bg: "#eef2ff", icon: "M18 4H7l6 8-6 8h11" },
  SUMMARY: { color: "#0d9488", bg: "#f0fdfa", icon: "M4 6h16M4 12h16M4 18h10" },
};

export type PremiumModuleInput = {
  title: string;
  subject?: string | null;
  chapter?: string | null;
  className?: string | null;
  facultyName?: string | null;
  academicYear?: string | null;
  theme?: PremiumTheme;
  brand?: { name: string; logoUrl?: string | null; tagline?: string | null; websiteUrl?: string | null; primaryColor?: string | null } | null;
  watermark?: boolean;
  pages: { pageNumber: number; elements: ModuleElementInput[] }[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function rich(text: string): string {
  return renderFormulaContent(text || "");
}

function displayMath(latex: string): string {
  try {
    return katex.renderToString(latex || "", { throwOnError: false, displayMode: true });
  } catch {
    return esc(latex);
  }
}

function imageUrl(content: string): string | null {
  const m = content.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (m) return m[1]!;
  return /^https?:\/\//.test(content.trim()) ? content.trim() : null;
}

function renderElements(elements: ModuleElementInput[], counters: { section: number; question: number; figure: number }): string {
  const out: string[] = [];
  const els = [...elements].sort((a, b) => a.order - b.order);
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!;
    switch (el.type) {
      case "HEADING":
        counters.section++;
        out.push(`<h2 class="h2"><span class="h2-num">${String(counters.section).padStart(2, "0")}</span><span>${rich(el.content)}</span></h2>`);
        break;
      case "SUBHEADING":
        out.push(`<h3 class="h3">${rich(el.content)}</h3>`);
        break;
      case "BULLETS": {
        const items = el.content.split("\n").map((s) => s.trim()).filter(Boolean);
        out.push(`<ul class="bullets">${items.map((it) => `<li>${rich(it)}</li>`).join("")}</ul>`);
        break;
      }
      case "CALLOUT": {
        const v = CALLOUT_STYLE[el.variant ?? "NOTE"] ?? CALLOUT_STYLE.NOTE!;
        const label = el.label || (el.variant ?? "Note").charAt(0) + (el.variant ?? "Note").slice(1).toLowerCase();
        out.push(
          `<div class="callout" style="--c:${v.color};--bg:${v.bg}"><div class="callout-head"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${v.icon}"/></svg><span>${esc(label)}</span></div><div class="callout-body">${el.content
            .split(/\n{2,}/)
            .map((p) => `<p>${rich(p)}</p>`)
            .join("")}</div></div>`
        );
        break;
      }
      case "TABLE": {
        const rows = el.tableData ?? [];
        if (!rows.length) break;
        const [head, ...body] = rows;
        out.push(
          `<div class="table-wrap"><table><thead><tr>${(head ?? []).map((c) => `<th>${rich(c)}</th>`).join("")}</tr></thead><tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`
        );
        break;
      }
      case "EQUATION":
      case "CHEMICAL_EQUATION":
        out.push(`<div class="equation">${displayMath(el.content.replace(/^\$+|\$+$/g, ""))}</div>`);
        break;
      case "IMAGE":
      case "DIAGRAM":
      case "CHEMICAL_STRUCTURE": {
        const url = imageUrl(el.content);
        if (url) {
          counters.figure++;
          // "![w=42mm](url)" — the figure's original printed width.
          const w = el.content.match(/!\[w=(\d{1,3})mm\]/)?.[1];
          out.push(
            `<figure class="figure"><img src="${esc(url)}" alt=""${w ? ` style="width:${Math.min(Number(w), 182)}mm"` : ""}/>${el.label ? `<figcaption><b>Fig. ${counters.figure}</b> ${rich(el.label)}</figcaption>` : ""}</figure>`
          );
        } else if (el.content.trim()) {
          out.push(`<p>${rich(el.content)}</p>`);
        }
        break;
      }
      case "QUESTION": {
        counters.question++;
        // Gather this question's options and solution into one card.
        const options: ModuleElementInput[] = [];
        let solution: ModuleElementInput | null = null;
        while (els[i + 1] && (els[i + 1]!.type === "OPTION" || (els[i + 1]!.type === "SOLUTION" && !solution))) {
          const next = els[++i]!;
          if (next.type === "OPTION") options.push(next);
          else solution = next;
        }
        const long = options.some((o) => o.content.length > 38);
        out.push(
          `<div class="question"><div class="q-text">${rich(el.content)}</div>${
            options.length ? `<div class="options ${long ? "one-col" : ""}">${options.map((o) => `<div class="option">${rich(o.content)}</div>`).join("")}</div>` : ""
          }${solution ? `<div class="solution"><span class="sol-tag">Solution</span>${rich(solution.content)}</div>` : ""}</div>`
        );
        break;
      }
      case "OPTION":
        out.push(`<div class="option loose">${rich(el.content)}</div>`);
        break;
      case "SOLUTION":
        out.push(`<div class="solution"><span class="sol-tag">Solution</span>${rich(el.content)}</div>`);
        break;
      default:
        if (el.content.trim()) out.push(`<p>${rich(el.content)}</p>`);
    }
  }
  return out.join("\n");
}

export function buildPremiumModuleHtml(input: PremiumModuleInput): string {
  const p = PREMIUM_THEMES[input.theme ?? "ATOMIC_BLUE"];
  const brandName = input.brand?.name || "Atomic Pathshala";
  const counters = { section: 0, question: 0, figure: 0 };
  const body = input.pages.map((pg) => renderElements(pg.elements, counters)).join("\n");
  const meta = [input.subject, input.className, input.academicYear].filter(Boolean).map((m) => esc(String(m)));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(input.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap">
<style>
  :root { --p:${p.primary}; --deep:${p.deep}; --soft:${p.soft}; --accent:${p.accent}; --ink:${p.ink}; }
  @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Noto Sans", "Noto Sans Devanagari", sans-serif; color: var(--ink); font-size: 10.6pt; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  p { margin: 0 0 7pt; }
  .katex { font-size: 1.05em; }

  /* Cover */
  .cover { height: 263mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; break-after: page;
    background: radial-gradient(120% 70% at 100% 0%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 60%), linear-gradient(160deg, var(--p), var(--deep)); color: #fff; border-radius: 6mm; padding: 16mm 14mm; position: relative; overflow: hidden; }
  .cover::after { content: ""; position: absolute; right: -40mm; bottom: -40mm; width: 140mm; height: 140mm; border-radius: 50%; border: 18mm solid rgba(255,255,255,.07); }
  .brand { display: flex; align-items: center; gap: 4mm; font-family: Poppins, sans-serif; font-weight: 700; font-size: 13pt; letter-spacing: .02em; }
  .brand img { height: 13mm; width: auto; background: #fff; border-radius: 3mm; padding: 1.5mm; }
  .chip { display: inline-block; font-family: Poppins, sans-serif; font-size: 9pt; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; background: rgba(255,255,255,.16); padding: 1.6mm 4mm; border-radius: 99px; }
  .cover h1 { font-family: Poppins, "Noto Sans Devanagari", sans-serif; font-size: 32pt; line-height: 1.15; margin: 6mm 0 4mm; font-weight: 800; }
  .cover .chapter { font-size: 14pt; opacity: .92; }
  .cover .meta { display: flex; gap: 3mm; flex-wrap: wrap; margin-top: 8mm; }
  .cover .meta span { border: 1px solid rgba(255,255,255,.35); border-radius: 99px; padding: 1.2mm 3.5mm; font-size: 9.5pt; }
  .cover .faculty { font-size: 11pt; } .cover .faculty b { font-family: Poppins, sans-serif; font-size: 13pt; display: block; }
  .cover .tagline { font-size: 9.5pt; opacity: .85; margin-top: 2mm; }

  /* Headings */
  .h2 { display: flex; align-items: center; gap: 3.5mm; margin: 9mm 0 4mm; padding: 3mm 4mm; border-radius: 3mm; background: linear-gradient(90deg, var(--p), color-mix(in srgb, var(--p) 70%, var(--accent))); color: #fff;
    font-family: Poppins, "Noto Sans Devanagari", sans-serif; font-size: 15pt; font-weight: 700; line-height: 1.3; break-after: avoid; page-break-after: avoid; }
  .h2-num { background: rgba(255,255,255,.22); border-radius: 2mm; padding: .6mm 2.4mm; font-size: 11pt; }
  .h3 { font-family: Poppins, "Noto Sans Devanagari", sans-serif; font-size: 12.5pt; color: var(--deep); margin: 6mm 0 2.5mm; padding-left: 3mm; border-left: 1.4mm solid var(--accent); line-height: 1.35; break-after: avoid; page-break-after: avoid; }

  .bullets { margin: 0 0 7pt; padding-left: 0; list-style: none; }
  .bullets li { position: relative; padding-left: 6mm; margin-bottom: 1.6mm; }
  .bullets li::before { content: ""; position: absolute; left: 1mm; top: .62em; width: 2.2mm; height: 2.2mm; border-radius: 50%; background: var(--p); box-shadow: 0 0 0 1mm var(--soft); }

  .callout { border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); border-left: 1.6mm solid var(--c); background: var(--bg); border-radius: 3mm; padding: 3mm 4mm 2mm; margin: 4mm 0; break-inside: avoid; page-break-inside: avoid; }
  .callout-head { display: inline-flex; align-items: center; gap: 1.6mm; color: #fff; background: var(--c); font-family: Poppins, sans-serif; font-weight: 600; font-size: 9pt; letter-spacing: .04em; text-transform: uppercase; border-radius: 99px; padding: .8mm 3mm; margin-bottom: 2mm; }

  .table-wrap { margin: 4mm 0; break-inside: avoid; page-break-inside: avoid; border-radius: 3mm; overflow: hidden; border: 1px solid color-mix(in srgb, var(--p) 25%, #e5e7eb); }
  table { width: 100%; border-collapse: collapse; font-size: 9.8pt; }
  th { background: var(--p); color: #fff; text-align: left; font-family: Poppins, "Noto Sans Devanagari", sans-serif; font-weight: 600; padding: 2mm 3mm; }
  td { padding: 1.8mm 3mm; border-top: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) td { background: var(--soft); }

  .equation { margin: 3.5mm 0; padding: 2.5mm 4mm; background: var(--soft); border-radius: 3mm; text-align: center; break-inside: avoid; }
  .figure { margin: 4mm auto; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .figure img { max-width: 100%; max-height: 95mm; object-fit: contain; }
  figcaption { font-size: 9pt; color: #475569; margin-top: 1.5mm; } figcaption b { color: var(--p); }

  .question { border: 1px solid #e2e8f0; border-radius: 3mm; padding: 3mm 4mm; margin: 3.5mm 0; break-inside: avoid; page-break-inside: avoid; background: #fff; }
  .q-text { font-weight: 600; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 5mm; margin-top: 2mm; }
  .options.one-col { grid-template-columns: 1fr; }
  .option { padding: 1.2mm 2.5mm; border-radius: 2mm; background: #f8fafc; }
  .option.loose { margin: 1mm 0 1mm 4mm; }
  .solution { margin-top: 2.5mm; padding: 2.5mm 3mm; border-radius: 2mm; background: #f0fdf4; border: 1px dashed #86efac; }
  .sol-tag { display: inline-block; font-family: Poppins, sans-serif; font-weight: 600; font-size: 8.5pt; color: #fff; background: #16a34a; border-radius: 99px; padding: .4mm 2.4mm; margin-right: 2mm; text-transform: uppercase; letter-spacing: .05em; }

  ${input.watermark && input.brand?.logoUrl ? `.wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; } .wm img { width: 95mm; opacity: .05; } main { position: relative; z-index: 1; }` : ""}
</style></head>
<body>
${input.watermark && input.brand?.logoUrl ? `<div class="wm"><img src="${esc(input.brand.logoUrl)}" alt=""/></div>` : ""}
<section class="cover">
  <div class="brand">${input.brand?.logoUrl ? `<img src="${esc(input.brand.logoUrl)}" alt=""/>` : ""}<span>${esc(brandName)}</span></div>
  <div>
    ${input.subject ? `<span class="chip">${esc(input.subject)}</span>` : ""}
    <h1>${esc(input.title)}</h1>
    ${input.chapter && input.chapter !== input.title ? `<div class="chapter">${esc(input.chapter)}</div>` : ""}
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
  </div>
  <div>
    ${input.facultyName ? `<div class="faculty">Prepared by<b>${esc(input.facultyName)}</b></div>` : ""}
    ${input.brand?.tagline ? `<div class="tagline">${esc(input.brand.tagline)}</div>` : ""}
  </div>
</section>
<main>
${body}
</main>
</body></html>`;
}

/** Header/footer printed on every page after the cover (Chromium templates). */
export function premiumHeaderFooter(input: { title: string; brandName?: string | null; website?: string | null; theme?: PremiumTheme }) {
  const p = PREMIUM_THEMES[input.theme ?? "ATOMIC_BLUE"];
  const base = `font-family: Arial, sans-serif; font-size: 8px; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; color: #64748b;`;
  return {
    headerTemplate: `<div style="${base}"><span style="color:${p.primary};font-weight:700">${esc(input.brandName || "Atomic Pathshala")}</span><span>${esc(input.title)}</span></div>`,
    footerTemplate: `<div style="${base}"><span>${esc(input.website || "")}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  };
}
