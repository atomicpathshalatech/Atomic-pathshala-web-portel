import type { ModuleElementInput } from "@/lib/validation/module";
import type { DesignSection } from "./model";

/**
 * Turns the module's blocks into what each section shows. Pure functions of
 * plain data, tested in scripts/test-module-design.ts.
 */

export type ContentPage = { pageNumber: number; elements: ModuleElementInput[] };

export type QuestionUnit = {
  number: number;
  question: ModuleElementInput;
  options: ModuleElementInput[];
  answer: string | null;
  solution: ModuleElementInput | null;
  pyq: boolean;
  sourcePage: number;
};

const PYQ_RE = /\b(NEET|AIPMT|JEE|AIIMS|CBSE|NCERT\s*Exemplar)\b[^\n]{0,24}?\b(19|20)\d{2}\b|\[(19|20)\d{2}\]|\((?:NEET|JEE|AIPMT)[^)]*\)/i;

/** "Ans. (2)", "उत्तर: (1)", "Answer: B" → "(2)" / "(1)" / "(B)". */
export function answerOf(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(?:ans(?:wer)?|उत्तर|सही उत्तर|correct(?: option)?)\s*[.:\-–]?\s*\(?\s*([1-4a-dA-D])\s*\)?/i) ?? t.match(/^\(?\s*([1-4a-dA-D])\s*\)\s*$/);
  return m ? `(${m[1]!.toUpperCase()})` : null;
}

function inRange(pageNumber: number, s: Pick<DesignSection, "fromPage" | "toPage">) {
  return (s.fromPage == null || pageNumber >= s.fromPage) && (s.toPage == null || pageNumber <= s.toPage);
}

const SKIP = new Set(["HEADER", "FOOTER"]);

export function flatten(pages: ContentPage[], s?: Pick<DesignSection, "fromPage" | "toPage">) {
  const out: (ModuleElementInput & { sourcePage: number })[] = [];
  for (const p of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    if (s && !inRange(p.pageNumber, s)) continue;
    for (const el of [...p.elements].sort((a, b) => a.order - b.order)) out.push({ ...el, sourcePage: p.pageNumber });
  }
  return out;
}

/** Questions with their options, answer and solution (numbered in module order). */
export function questionUnits(pages: ContentPage[], s?: Pick<DesignSection, "fromPage" | "toPage">): QuestionUnit[] {
  const els = flatten(pages, s).filter((e) => !SKIP.has(e.type));
  const out: QuestionUnit[] = [];
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!;
    if (el.type !== "QUESTION") continue;
    const u: QuestionUnit = { number: out.length + 1, question: el, options: [], answer: null, solution: null, pyq: PYQ_RE.test(el.content), sourcePage: el.sourcePage };
    while (els[i + 1] && ["OPTION", "ANSWER", "SOLUTION"].includes(els[i + 1]!.type)) {
      const next = els[++i]!;
      if (next.type === "OPTION") u.options.push(next);
      else if (next.type === "ANSWER") u.answer = answerOf(next.content) ?? next.content.trim();
      else {
        u.solution = next;
        u.answer ??= answerOf(next.content);
      }
    }
    out.push(u);
  }
  return out;
}

const IN_QUESTION = new Set(["QUESTION", "OPTION", "ANSWER", "SOLUTION"]);

/** Everything that is not a question: the chapter's theory, in order. */
export function theoryElements(pages: ContentPage[], s?: Pick<DesignSection, "fromPage" | "toPage">) {
  return flatten(pages, s).filter((e) => !SKIP.has(e.type) && !IN_QUESTION.has(e.type));
}

export function formulaElements(pages: ContentPage[], s?: Pick<DesignSection, "fromPage" | "toPage">) {
  return flatten(pages, s).filter((e) => e.type === "EQUATION" || e.type === "CHEMICAL_EQUATION" || (e.type === "CALLOUT" && e.variant === "FORMULA"));
}

export function calloutElements(pages: ContentPage[], variants: string[], s?: Pick<DesignSection, "fromPage" | "toPage">) {
  return flatten(pages, s).filter((e) => e.type === "CALLOUT" && variants.includes(e.variant ?? "NOTE"));
}

/** Lines of the source PDF's own running header/footer — the design prints its own instead. */
export function sourceHeaderFooterCount(pages: ContentPage[]) {
  return flatten(pages).filter((e) => SKIP.has(e.type)).length;
}
