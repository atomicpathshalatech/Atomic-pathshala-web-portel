import "server-only";
import type { ModuleElementInput } from "@/lib/validation/module";
import { MODULE_CALLOUT_VARIANTS } from "@/lib/validation/module";
import { convertKrutiDevToUnicode, isKrutiDevEncoded } from "./krutidev-converter";

export interface NativeParseOptions {
  removeWords?: string[];
  renames?: Record<string, string>;
}

const CALLOUT_KEYWORDS: { re: RegExp; variant: string; label: string }[] = [
  { re: /^(?:note|नोट|विशेष)[\s\:\-\–—]+/i, variant: "NOTE", label: "Note" },
  { re: /^(?:important|महत्वपूर्ण|caution|warning|सावधानी)[\s\:\-\–—]+/i, variant: "CAUTION", label: "Caution" },
  { re: /^(?:remember|याद\s*रखें|ध्यान\s*दें)[\s\:\-\–—]+/i, variant: "REMEMBER", label: "Remember" },
  { re: /^(?:tip|trick|key\s*point|ट्रिक|सुझाव)[\s\:\-\–—]+/i, variant: "TIP", label: "Tip" },
  { re: /^(?:example|illustration|उदाहरण|उदा\.)[\s\:\-\–—]+/i, variant: "EXAMPLE", label: "Example" },
  { re: /^(?:formula|सूत्र|equation)[\s\:\-\–—]+/i, variant: "FORMULA", label: "Formula" },
  { re: /^(?:summary|quick\s*revision|सारांश|निष्कर्ष)[\s\:\-\–—]+/i, variant: "SUMMARY", label: "Summary" },
  { re: /^(?:concept|key\s*concept|संकल्पना)[\s\:\-\–—]+/i, variant: "CONCEPT", label: "Concept" },
];

function stripWords(text: string, words: string[]): string {
  let t = text;
  for (const w of words) {
    if (!w.trim()) continue;
    const re = new RegExp(w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    t = t.replace(re, "");
  }
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

function applyRenames(text: string, renames: Record<string, string>): string {
  let t = text;
  for (const [from, to] of Object.entries(renames)) {
    if (!from.trim()) continue;
    const re = new RegExp(`(^|[^\\p{L}])(${from.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}])`, "giu");
    t = t.replace(re, (_m, pre) => `${pre}${to}`);
  }
  return t;
}

/**
 * Ultra-fast deterministic native rule parser that transforms raw PDF text
 * into structured educational blocks in < 1ms without calling AI APIs.
 * Automatically detects and converts legacy Kruti Dev / Devlys 010 Hindi into standard UTF-8.
 */
export function parsePageTextNatively(
  pageText: string,
  pageNumber: number,
  options: NativeParseOptions = {}
): ModuleElementInput[] {
  const removeWords = options.removeWords ?? [];
  const renames = options.renames ?? {};

  // Auto-normalize Kruti Dev / Devlys legacy Hindi text layers to clean UTF-8 Unicode
  const normalizedPageText = isKrutiDevEncoded(pageText)
    ? convertKrutiDevToUnicode(pageText)
    : pageText;

  const clean = (t: string) => applyRenames(stripWords(t, removeWords), renames);

  const rawLines = normalizedPageText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      // Filter out pure standalone page numbers or headers
      if (/^(?:page\s*)?\d+\s*(?:of\s*\d+)?$/i.test(l)) return false;
      return l.length > 0;
    });

  if (rawLines.length === 0) return [];

  const elements: ModuleElementInput[] = [];
  const push = (el: Omit<ModuleElementInput, "id" | "order">) => {
    elements.push({
      id: `p${pageNumber}-${elements.length}-${Math.random().toString(36).slice(2, 7)}`,
      order: elements.length,
      ...el,
    });
  };

  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return;
    const combined = clean(currentParagraphLines.join(" "));
    if (combined.length > 0) {
      push({ type: "PARAGRAPH", content: combined });
    }
    currentParagraphLines = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;

    // 1. Chapter or Major Title Heading
    if (
      /^(?:chapter|अध्याय|unit|इकाई)\s*[\d\.\:\-\–—]+\s*.*$/i.test(line) ||
      (/^\d+\.\d+\s+[A-Z\u0900-\u097F]/.test(line) && line.length < 80) ||
      (/^[A-Z\u0900-\u097F\s]{4,60}$/.test(line) && !/[.,;:!?]$/.test(line) && line.length < 50)
    ) {
      flushParagraph();
      push({ type: "HEADING", content: clean(line) });
      continue;
    }

    // 2. Subheading / Topic Title
    if (
      /^(?:topic|विषय|section|भाग)\s*[\d\.\:\-\–—]+\s*.*$/i.test(line) ||
      (/^\([A-Z0-9ivx]+\)\s+[A-Z\u0900-\u097F]/i.test(line) && line.length < 90) ||
      (/^[A-Z\u0900-\u097F][A-Za-z0-9\s\u0900-\u097F\-\–—]{3,70}:$/.test(line))
    ) {
      flushParagraph();
      push({ type: "SUBHEADING", content: clean(line.replace(/:$/, "")) });
      continue;
    }

    // 3. Callout / Box Detection (Note, Formula, Example, Caution, Tip)
    let matchedCallout = false;
    for (const kw of CALLOUT_KEYWORDS) {
      if (kw.re.test(line)) {
        flushParagraph();
        const content = line.replace(kw.re, "").trim();
        const label = applyRenames(kw.label, renames);
        push({
          type: "CALLOUT",
          variant: kw.variant,
          label,
          content: clean(content || line),
        });
        matchedCallout = true;
        break;
      }
    }
    if (matchedCallout) continue;

    // 4. Questions & Practice Items (Q.1, Q1, Question 1, प्रश्न 1)
    if (/^(?:q(?:uestion)?|प्रश्न|prashna)\s*[\.\d]+[\s\:\-\)]+/i.test(line)) {
      flushParagraph();
      push({ type: "QUESTION", content: clean(line) });
      continue;
    }

    // 5. Multiple Choice Options ((1), (2), (A), (B), [A], [B])
    if (/^(?:\([1-4a-dA-D]\)|\[[1-4a-dA-D]\]|[1-4a-dA-D]\.)\s+/i.test(line)) {
      flushParagraph();
      push({ type: "OPTION", content: clean(line) });
      continue;
    }

    // 6. Solution / Answer Block
    if (/^(?:solution|answer|ans|hint|हल|उत्तर)[\s\:\-\–—]+/i.test(line)) {
      flushParagraph();
      push({ type: "SOLUTION", content: clean(line) });
      continue;
    }

    // 7. Bullet / List Items
    if (/^(?:[\•\-\*\▪\▫\–—]|\([i|v|x]+\))\s+/i.test(line)) {
      flushParagraph();
      const bulletText = clean(line.replace(/^(?:[\•\-\*\▪\▫\–—]|\([i|v|x]+\))\s+/, ""));
      push({ type: "BULLETS", content: bulletText });
      continue;
    }

    // 8. Math / Chemical Equations
    if (
      (line.includes("=") || line.includes("\\to") || line.includes("→") || line.includes("\\Delta")) &&
      !line.endsWith(".") &&
      line.length < 120 &&
      /[\+\-\*\/\^_\{\}\(\)\[\]\\α-ωΑ-Ω]/.test(line)
    ) {
      flushParagraph();
      push({ type: "EQUATION", content: clean(line) });
      continue;
    }

    // 9. Table Row Detection (Tab-separated or pipe-separated)
    if (line.includes("\t") || (line.includes("|") && line.split("|").length >= 3)) {
      flushParagraph();
      const cols = line
        .split(line.includes("\t") ? "\t" : "|")
        .map((c) => clean(c))
        .filter((c) => c.length > 0);
      if (cols.length >= 2) {
        push({ type: "TABLE", content: "", tableData: [cols] });
        continue;
      }
    }

    // Default: Running prose paragraph line
    currentParagraphLines.push(line);
  }

  flushParagraph();
  return elements;
}
