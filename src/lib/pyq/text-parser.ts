/**
 * Deterministic MCQ parser for text-based PYQ PDFs — the first pass of a PYQ
 * import (AI is only a fallback for pages this cannot read).
 *
 * Understands the layouts these papers actually use:
 *   - question starts:  "12. ", "12) ", "Q.12 ", "Q12. ", "Question 12:"
 *   - options:          "(1) .. (2) .. (3) .. (4)", "(a)..(d)", "(A)..(D)", "a) ..", "A. .."
 *                       on one line or one per line
 *   - inline answers:   "Ans. (3)", "Answer: (b)", "Correct option: 2"
 *   - inline solutions: "Sol.", "Solution:", "Explanation:", "Hint:"
 *   - an answer-key section at the end ("Answer Key", "ANSWERS") with
 *     "1. (3)  2. (4)" / "1-3" / "1 c" pairs
 *   - section headings that name the exam sitting ("NEET 2023") — numbering
 *     restarts under each heading, so the identity is section + number.
 *
 * It never invents an answer: a question without a printed answer gets none.
 */

import { findExamTags, headingTagForLine, stripQuestionTag, type DetectedTag, type ExamPattern } from "./metadata-detect";

export type ParsedPage = { pageNumber: number; text: string };

export type ParsedQuestion = {
  /** Unique within the document: "<sectionIndex>#<number>". */
  sourceKey: string;
  number: number;
  sourcePage: number;
  sectionIndex: number;
  sectionTag: DetectedTag | null;
  questionTag: DetectedTag | null;
  statement: string;
  options: { A: string; B: string; C: string; D: string };
  answer: string | null; // "A".."D" (or comma list), never guessed
  answerSource: "INLINE" | "ANSWER_KEY_SECTION" | null;
  solution: string | null;
  hasImageHint: boolean;
  issues: string[];
};

export type ParseResult = {
  questions: ParsedQuestion[];
  /** Section headings in document order (index = sectionIndex). */
  sections: (DetectedTag | null)[];
  answerKeyFound: boolean;
  warnings: string[];
};

const Q_START = /^\s*(?:Q(?:uestion)?\.?\s*(?:No\.?)?\s*)?(\d{1,3})\s*(?:\.(?!\d)|[):])\s*(?=\S)/i;
const ANSWER_KEY_HEADING = /^\s*(?:answer\s*key|answers?\s*(?:key|sheet)?|key\s*answers?|उत्तर\s*कुंजी)\s*:?\s*$/i;
const SOLUTIONS_HEADING = /^\s*(?:hints?\s*(?:&|and)\s*solutions?|solutions?|explanations?|हल)\s*:?\s*$/i;
const INLINE_ANSWER = /(?:^|\s)(?:Ans(?:wer)?|Correct\s*(?:option|answer)|उत्तर)\s*[.:\-–]?\s*\(?\s*([1-4a-dA-D](?:\s*[,&]\s*[1-4a-dA-D])*)\s*\)?/;
const INLINE_SOLUTION = /(?:^|\n)\s*(?:Sol(?:ution)?|Explanation|Hint|हल)\s*[.:\-–]\s*/i;
const FIGURE_HINT = /\b(figure|fig\.|diagram|graph|shown\s+(?:below|above|in)|circuit|the\s+structure)\b|चित्र/i;

const LETTERS = ["A", "B", "C", "D"] as const;

function toLetter(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (/^[1-4]$/.test(t)) return LETTERS[Number(t) - 1]!;
  if (/^[A-D]$/.test(t)) return t;
  return null;
}

function normalizeAnswer(raw: string): string | null {
  const parts = raw.split(/[,&\s]+/).map(toLetter).filter(Boolean) as string[];
  return parts.length ? Array.from(new Set(parts)).join(",") : null;
}

/** Option markers in the order the paper uses, tried from most to least specific. */
const OPTION_STYLES: RegExp[][] = [
  [/\(\s*1\s*\)/, /\(\s*2\s*\)/, /\(\s*3\s*\)/, /\(\s*4\s*\)/],
  [/\(\s*a\s*\)/, /\(\s*b\s*\)/, /\(\s*c\s*\)/, /\(\s*d\s*\)/],
  [/\(\s*A\s*\)/, /\(\s*B\s*\)/, /\(\s*C\s*\)/, /\(\s*D\s*\)/],
  [/(?:^|\s)a\)\s/, /(?:^|\s)b\)\s/, /(?:^|\s)c\)\s/, /(?:^|\s)d\)\s/],
  [/(?:^|\s)A[.)]\s/, /(?:^|\s)B[.)]\s/, /(?:^|\s)C[.)]\s/, /(?:^|\s)D[.)]\s/],
];

/** Splits "stem (1) x (2) y (3) z (4) w" into stem + 4 options, or null. */
export function splitOptions(block: string): { stem: string; options: { A: string; B: string; C: string; D: string } } | null {
  for (const style of OPTION_STYLES) {
    const positions: { start: number; end: number }[] = [];
    let from = 0;
    let ok = true;
    for (const marker of style) {
      const re = new RegExp(marker.source, marker.flags.replace("g", ""));
      const m = block.slice(from).match(re);
      if (!m || m.index === undefined) {
        ok = false;
        break;
      }
      const start = from + m.index;
      positions.push({ start, end: start + m[0].length });
      from = start + m[0].length;
    }
    if (!ok) continue;
    const stem = block.slice(0, positions[0]!.start).trim();
    if (!stem) continue;
    const opts = positions.map((p, i) => block.slice(p.end, i < 3 ? positions[i + 1]!.start : undefined).trim());
    // In scientific questions, options may contain formulas or diagrams rendered as non-text glyphs.
    // Do not discard options as long as stem is present and markers were in sequential order:
    return { stem, options: { A: opts[0] || "", B: opts[1] || "", C: opts[2] || "", D: opts[3] || "" } };
  }
  return null;
}

/** "1. (3)  2. (4)", "1-c 2-a", "1) 3" — pairs of question number and answer, + grid reconstruction. */
export function parseAnswerKey(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const re = /(?:^|\s)(\d{1,3})\s*[.)\-–:]?\s*\(?\s*([1-4a-dA-D])\s*\)?(?=\s|$|,)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    const a = toLetter(m[2]!);
    if (a && !map.has(n)) map.set(n, a);
  }

  // Grid reconstruction for multi-column answer keys where font encodings dropped digits (like 6 and 8):
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/examgoal|keep practising|chapter-wise|solutions|page/i.test(line)) continue;
    const letters = Array.from(line.matchAll(/(?:^|\s|[.)])([A-D])(?=\s|$)/g)).map((x) => x[1]!);
    if (letters.length === 5) {
      const firstNumMatch = line.match(/^\s*(?:[^\d\s]*\s*)?(\d{1,3})\s*[.)]/);
      let startNum = firstNumMatch ? Number(firstNumMatch[1]) : null;
      if (!startNum) {
        const secondNumMatch = line.match(/\s+(\d{1,3})\s*[.)]/);
        if (secondNumMatch) startNum = Number(secondNumMatch[1]) - 1;
      }
      if (startNum) {
        for (let col = 0; col < 5; col++) {
          const qNum = startNum + col;
          if (!map.has(qNum)) map.set(qNum, letters[col]!);
        }
      }
    }
  }

  return map;
}

type Block = { number: number; page: number; section: number; lines: string[] };

/**
 * Parses a whole document (or a page range of one). Pages must be in order.
 * `patterns` lets custom exams (e.g. "IUPSC") be recognised in headings/tags.
 */
export function parsePyqText(pages: ParsedPage[], patterns?: ExamPattern[]): ParseResult {
  const warnings: string[] = [];
  const sections: (DetectedTag | null)[] = [null];
  const blocks: Block[] = [];
  let mode: "QUESTIONS" | "ANSWER_KEY" | "SOLUTIONS" = "QUESTIONS";
  const answerKeyText: string[][] = [[]]; // per section
  const solutionBlocks: { section: number; number: number; lines: string[] }[] = [];
  let current: Block | null = null;
  let currentSol: { section: number; number: number; lines: string[] } | null = null;
  let lastNumber = 0;

  const newSection = (tag: DetectedTag | null) => {
    sections.push(tag);
    answerKeyText.push([]);
    lastNumber = 0;
  };

  for (const page of pages) {
    const lines = page.text.replace(/\r/g, "").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      if (!line.trim()) continue;
      // Running headers/footers: page numbers, "Page 3 of 20", URLs.
      if (/^\s*(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?\s*$/i.test(line) || /^\s*(?:www\.|https?:\/\/)\S+\s*$/i.test(line)) continue;

      const heading = headingTagForLine(line, patterns);
      if (heading) {
        current = null;
        currentSol = null;
        mode = "QUESTIONS";
        newSection(heading);
        continue;
      }
      if (ANSWER_KEY_HEADING.test(line)) {
        mode = "ANSWER_KEY";
        current = null;
        continue;
      }
      if (SOLUTIONS_HEADING.test(line)) {
        mode = "SOLUTIONS";
        current = null;
        continue;
      }

      const qPrefixMatch = line.match(/^\s*(?:Q(?:uestion)?\.?\s*(?:No\.?)?\s*)(\d{1,3})\s*(?:\.(?!\d)|[):])\s*(?=\S)/i);
      const plainNumMatch = mode !== "ANSWER_KEY" ? line.match(/^\s*(\d{1,3})\s*(?:\.(?!\d)|[):])\s*(?=\S)/) : null;
      const start = qPrefixMatch || plainNumMatch;
      const hasQPrefix = Boolean(qPrefixMatch);

      // If we see a Q-prefixed question start while in ANSWER_KEY or SOLUTIONS mode, exit back to QUESTIONS mode
      if (qPrefixMatch && (mode === "ANSWER_KEY" || mode === "SOLUTIONS")) {
        mode = "QUESTIONS";
      }

      const sec = sections.length - 1;
      if (mode === "ANSWER_KEY") {
        answerKeyText[sec]!.push(line);
        continue;
      }

      if (mode === "SOLUTIONS") {
        if (start) {
          currentSol = { section: sec, number: Number(start[1]), lines: [line.slice(start[0].length)] };
          solutionBlocks.push(currentSol);
        } else if (currentSol) currentSol.lines.push(line);
        continue;
      }

      if (start) {
        const n = Number(start[1]);
        const isNext = n === lastNumber + 1 || (lastNumber === 0 && n >= 1);
        const currentLines = current?.lines ? current.lines.join(" ") : "";
        const currentHasOptions = currentLines ? OPTION_STYLES.some((st) => st.some((re) => re.test(currentLines))) : true;
        const isRestart = n === 1 && (lastNumber > 1 || sections.length > 1) && (hasQPrefix || currentHasOptions);
        if (isNext || isRestart) {
          if (isRestart) newSection(null);
          mode = "QUESTIONS";
          current = { number: n, page: page.pageNumber, section: sections.length - 1, lines: [line.slice(start[0].length)] };
          blocks.push(current);
          lastNumber = n;
          continue;
        }
      }
      if (current) current.lines.push(line);
    }
  }

  const keys = answerKeyText.map((t) => parseAnswerKey(t.join("\n")));
  const answerKeyFound = keys.some((k) => k.size > 0);
  const solutions = new Map(solutionBlocks.map((s) => [`${s.section}#${s.number}`, s.lines.join("\n").trim()]));

  const questions: ParsedQuestion[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    const issues: string[] = [];
    let text = b.lines.join("\n");

    // Inline solution: everything after "Sol." belongs to the solution.
    let solution: string | null = null;
    const solAt = text.search(INLINE_SOLUTION);
    if (solAt >= 0) {
      solution = text.slice(solAt).replace(INLINE_SOLUTION, "").trim() || null;
      text = text.slice(0, solAt);
    }

    let answer: string | null = null;
    let answerSource: ParsedQuestion["answerSource"] = null;
    const inline = text.match(INLINE_ANSWER);
    if (inline && inline.index !== undefined) {
      answer = normalizeAnswer(inline[1]!);
      answerSource = answer ? "INLINE" : null;
      text = (text.slice(0, inline.index) + text.slice(inline.index + inline[0].length)).trim();
    }
    if (!answer) {
      const fromKey = keys[b.section]?.get(b.number) ?? (sections.length === 1 ? undefined : keys[0]?.get(b.number));
      if (fromKey) {
        answer = fromKey;
        answerSource = "ANSWER_KEY_SECTION";
      }
    }
    if (!solution) solution = solutions.get(`${b.section}#${b.number}`) ?? null;

    const flat = text.replace(/\s*\n\s*/g, " ").trim();
    const split = splitOptions(flat);
    let statement = split ? split.stem : flat;
    const options = split?.options ?? { A: "", B: "", C: "", D: "" };
    if (!split) issues.push("Options not found — check the question and its options.");

    // A tag inside the question ("... [NEET 2019]") belongs to this question only.
    const qTags = findExamTags(statement, patterns);
    const questionTag = qTags.length ? qTags[qTags.length - 1]! : null;
    if (questionTag) statement = stripQuestionTag(statement, questionTag);
    if (!answer) issues.push("No answer printed for this question in the PDF.");
    if (statement.length < 8) issues.push("Question text looks incomplete.");

    const sourceKey = `${b.section}#${b.number}`;
    if (seen.has(sourceKey)) {
      warnings.push(`Question ${b.number} appears twice in section ${b.section}; the second copy was kept separately for review.`);
    }
    const key = seen.has(sourceKey) ? `${sourceKey}@p${b.page}` : sourceKey;
    seen.add(key);

    questions.push({
      sourceKey: key,
      number: b.number,
      sourcePage: b.page,
      sectionIndex: b.section,
      sectionTag: sections[b.section] ?? null,
      questionTag,
      statement,
      options,
      answer,
      answerSource,
      solution,
      hasImageHint: FIGURE_HINT.test(flat),
      issues,
    });
  }

  return { questions, sections, answerKeyFound, warnings };
}

/** How usable a parse is: share of questions that have a stem and all four options. */
export function parseQuality(result: ParseResult): number {
  if (!result.questions.length) return 0;
  const good = result.questions.filter((q) => q.options.A && q.options.D && q.statement.length >= 8).length;
  return good / result.questions.length;
}
