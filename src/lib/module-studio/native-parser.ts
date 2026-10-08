import "server-only";
import type { ModuleElementInput } from "@/lib/validation/module";
import { convertKrutiDevToUnicode, isKrutiDevEncoded } from "./krutidev-converter";

export interface NativeParseOptions {
  removeWords?: string[];
  renames?: Record<string, string>;
}

const CALLOUT_KEYWORDS: { re: RegExp; variant: string; label: string }[] = [
  { re: /^(?:note|नोट|विशेष)[\s\:\-\–—]+/i, variant: "NOTE", label: "Note" },
  { re: /^(?:important|महत्वपूर्ण|caution|warning|सावधानी)[\s\:\-\–—]+/i, variant: "CAUTION", label: "Important" },
  { re: /^(?:remember|याद\s*रखें|ध्यान\s*दें)[\s\:\-\–—]+/i, variant: "REMEMBER", label: "Remember" },
  { re: /^(?:tip|trick|key\s*point|key\s*points|मुख्य\s*बिंदु|ट्रिक|सुझाव)[\s\:\-\–—]+/i, variant: "TIP", label: "Key Points" },
  { re: /^(?:example|illustration|उदाहरण|उदा\.)[\s\:\-\–—]+/i, variant: "EXAMPLE", label: "Example" },
  { re: /^(?:formula|सूत्र|equation)[\s\:\-\–—]+/i, variant: "FORMULA", label: "Formula" },
  { re: /^(?:summary|quick\s*revision|quick\s*rivision|सारांश|निष्कर्ष)[\s\:\-\–—]+/i, variant: "SUMMARY", label: "Quick Revision" },
  { re: /^(?:concept|key\s*concept|संकल्पना)[\s\:\-\–—]+/i, variant: "CONCEPT", label: "Concept" },
  { re: /^(?:focus\s*point|फोकस\s*पॉइंट)[\s\:\-\–—]+/i, variant: "TIP", label: "Focus Point" },
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
 * Checks if a line contains answer key mappings like:
 * "1. (2)  2. (3)  3. (1)  4. (4)" or "1-(b), 2-(c), 3-(a)" or "Q.1 - (3), Q.2 - (1)"
 */
function parseAnswerKeyPairs(text: string): Array<{ qNum: string; ans: string }> {
  const pairs: Array<{ qNum: string; ans: string }> = [];
  const regex = /(?:Q\.?)?\s*(\d+)[\s\.\:\-\–—]+\(?\s*([1-4A-Da-d])\s*\)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    pairs.push({ qNum: match[1]!, ans: `(${match[2]!.toUpperCase()})` });
  }
  return pairs;
}

/**
 * Ultra-fast deterministic spatial line parser that converts extracted PDF lines
 * into structured academic elements while preserving exact line-to-line Hindi Devanagari,
 * chemical formulas, dual-column question grids, and compact answer keys.
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
      if (/^Page\s*\|\s*\d+$/i.test(l)) return false;
      if (/^CAREERWILL$/i.test(l)) return false;
      if (/^NEET\s+DIVISION$/i.test(l)) return false;
      if (/^Medium\s*:\s*Hindi$/i.test(l)) return false;
      return l.length > 0;
    });

  if (rawLines.length === 0) return [];

  const elements: ModuleElementInput[] = [];
  let isInsideAnswerKey = false;
  let answerKeyEntries: Array<{ qNum: string; ans: string }> = [];

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

  const flushAnswerKey = () => {
    if (answerKeyEntries.length === 0) return;
    // Build 5-column compact matrix table
    const tableData: string[][] = [["Q.No", "Ans", "Q.No", "Ans", "Q.No", "Ans", "Q.No", "Ans", "Q.No", "Ans"]];
    for (let idx = 0; idx < answerKeyEntries.length; idx += 5) {
      const row: string[] = [];
      for (let col = 0; col < 5; col++) {
        const item = answerKeyEntries[idx + col];
        if (item) {
          row.push(`Q.${item.qNum}`, item.ans);
        } else {
          row.push("-", "-");
        }
      }
      tableData.push(row);
    }

    push({
      type: "TABLE",
      content: "Answer Key",
      label: "Answer Key Grid",
      tableData,
    });

    answerKeyEntries = [];
    isInsideAnswerKey = false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;

    // 0. Answer Key Detection & Gathering
    if (/^(?:answer\s*key|उत्तर\s*कुंजी|ans\s*key)/i.test(line)) {
      flushParagraph();
      isInsideAnswerKey = true;
      push({ type: "HEADING", content: clean(line) });
      continue;
    }

    if (isInsideAnswerKey) {
      const pairs = parseAnswerKeyPairs(line);
      if (pairs.length > 0) {
        answerKeyEntries.push(...pairs);
        continue;
      } else if (line.length > 0 && !/^\d+/.test(line)) {
        // Exited answer key block
        flushAnswerKey();
      }
    }

    // 1. Major Section Banners (Booster Section, Topic Wise Questions, Rank Booster, NEET PYQ)
    if (
      /^(?:booster\s*section|topic\s*wise\s*questions|rank\s*booster\s*question|neet\s*pyq|quick\s*revision|quick\s*rivision)/i.test(line) ||
      /^(?:बूस्टर\s*सेक्शन|टॉपिक\s*वाइज|रैंक\s*बूस्टर|क्विक\s*रिवीजन)/i.test(line)
    ) {
      flushParagraph();
      push({ type: "HEADING", content: clean(line) });
      continue;
    }

    // 2. Numbered Section Titles (1.1, 1.2, 1.3, 1.4...)
    if (/^\d+\.\d+\s+[A-Za-z\u0900-\u097F]/.test(line) && line.length < 90) {
      flushParagraph();
      push({ type: "HEADING", content: clean(line) });
      continue;
    }

    // 3. Subrules: Subrule (i), Subrule (ii), (a), (b), A), B)
    if (
      /^(?:subrule|उप\s*नियम|नियम|mifu;e|fu;e)\s*[\(\d\wivx\)]+/i.test(line) ||
      /^(?:[A-Z]\)|\([a-z0-9ivx]+\))\s+[A-Za-z\u0900-\u097F]/.test(line)
    ) {
      flushParagraph();
      push({ type: "SUBHEADING", content: clean(line) });
      continue;
    }

    // 4. Questions: Q.1, Q.2, Q.3, प्रश्न 1, Que. 1
    if (/^(?:q(?:uestion|\.)?\s*\d+|प्रश्न\s*\d+|que\.\s*\d+)/i.test(line)) {
      flushParagraph();
      push({ type: "QUESTION", content: clean(line) });
      continue;
    }

    // 5. Multiple Choice Options: (1), (2), (3), (4), (A), (B), (C), (D)
    if (/^(?:\([1-4a-dA-D]\)|\[[1-4a-dA-D]\]|[1-4a-dA-D]\.)\s+/.test(line)) {
      flushParagraph();
      push({ type: "OPTION", content: clean(line) });
      continue;
    }

    // 6. Solved Example & Solution Steps
    if (/^(?:solution|answer|ans|hint|हल|उत्तर)[\s\:\-\–—]+/i.test(line)) {
      flushParagraph();
      push({ type: "SOLUTION", content: clean(line) });
      continue;
    }

    // 7. Callouts & Boxes (Key Points, Important, Formula, Example, Note)
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

    // 8. Standalone Formula or Chemical Notation (HC ≡ C - CH = CH - CH3, etc.)
    if (
      (line.includes("≡") || line.includes("=") || line.includes("→") || line.includes("–") || line.includes("-")) &&
      !line.endsWith(".") &&
      line.length < 100 &&
      /CH[0-9]?|COOH|OH|NH2|Cl|Br|NO2|SO3H|sp[123]?/i.test(line)
    ) {
      flushParagraph();
      push({ type: "CHEMICAL_EQUATION", content: clean(line) });
      continue;
    }

    // 9. Table Row Detection (Tab or pipe separated)
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
  flushAnswerKey();
  return elements;
}
