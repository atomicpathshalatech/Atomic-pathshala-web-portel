/**
 * Deterministic exam / year / session / shift / paper detection for PYQ
 * PDFs. No AI: plain patterns over the extracted text.
 *
 * A tag is an exam name followed (within a short distance) by a year, e.g.
 *   "NEET 2024", "[NEET (UG) 2023]", "AIPMT 2015", "JEE Main 2021 (26 Feb Shift 1)",
 *   "[JEE (Main) 2020, 9 Jan, Shift-II]", "JEE Advanced 2019 Paper 1", "IUPSC 2019".
 *
 * Where it sits decides what it means:
 *   - a short line that is (almost) only the tag  -> SECTION_HEADING, applies
 *     to every following question until the next heading;
 *   - inside / at the end of a question's text    -> QUESTION_TAG, applies to
 *     that question only (and is stripped from the statement).
 * Nothing is guessed: a question with neither stays without a year.
 */

export type ExamPattern = {
  /** PyqExam.id when known; null for an exam only seen in the text. */
  examId: string | null;
  name: string;
  regex: RegExp;
  /** Built-ins only: PyqExam.slug — the real id is looked up by slug at runtime. */
  slug?: string;
};

export type DetectedTag = {
  examId: string | null;
  examLabel: string; // as written in the PDF
  examName: string; // canonical name of the matched pattern
  year: number;
  session: string | null;
  shift: string | null;
  paper: string | null;
  raw: string;
  index: number;
  length: number;
};

const MONTHS: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", sept: "September", oct: "October", nov: "November", dec: "December",
};

/**
 * Built-in surface spellings for the three standard exams. examId here is
 * the migration's seeded id, used only by the pure tests; at runtime
 * examPatterns() (exams-service.ts) swaps in the id of the row with the same
 * slug, since a database can hold these exams under other ids.
 */
export const BUILTIN_EXAM_PATTERNS: ExamPattern[] = [
  {
    examId: "pyqexam_jee_adv",
    slug: "jee-advanced",
    name: "JEE Advanced",
    regex: /\b(?:JEE[\s\-–]*\(?\s*Adv(?:anced|ance|\.)?\s*\)?|IIT[\s\-–]*JEE(?:[\s\-–]*\(?\s*Adv(?:anced|\.)?\s*\)?)?)/gi,
  },
  {
    examId: "pyqexam_jee_main",
    slug: "jee-main",
    name: "JEE Main",
    regex: /\b(?:JEE[\s\-–]*\(?\s*Mains?\s*\)?|AIEEE)/gi,
  },
  {
    examId: "pyqexam_neet_ug",
    slug: "neet-ug",
    name: "NEET UG",
    regex: /\b(?:(?:Re[\s\-]*)?NEET(?:[\s\-–]*\(?\s*UG\s*\)?)?(?:[\s\-–]*(?:Phase|Odisha|Manipur)[\s\-–]*(?:I{1,2}|\d)?)?|(?:CBSE[\s\-–]*)?AIPMT)/gi,
  },
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Pattern for a configured (custom) exam name: tolerant of spaces / hyphens / brackets. */
export function patternForExamName(examId: string | null, name: string): ExamPattern | null {
  const words = String(name || "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(escapeRegex);
  if (!words.length) return null;
  return { examId, name, regex: new RegExp(`\\b${words.join("[\\s\\-–()]*")}\\b`, "gi") };
}

const YEAR_RE = /\b(19[89]\d|20[0-4]\d)\b/;
const SHIFT_RE = /\bShift[\s\-–:]*(I{1,3}|1st|2nd|3rd|[1-3])\b|\b(Morning|Evening|Afternoon)\s*(?:Shift)?\b/i;
const PAPER_RE = /\bPaper[\s\-–:]*(I{1,2}|[12])\b|\bSet[\s\-–:]*(?:Code)?[\s\-–:]*([A-Z]\d?|\d{1,2})\b/i;
const SESSION_RE = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b|\b(Phase|Session|Attempt)[\s\-–]*(I{1,2}|[12])\b/i;

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3" };

function normShift(m: RegExpMatchArray | null): string | null {
  if (!m) return null;
  if (m[1]) {
    const v = m[1].toLowerCase().replace(/(st|nd|rd)$/, "");
    return `Shift ${ROMAN[v] ?? v}`;
  }
  return m[2] ? m[2][0]!.toUpperCase() + m[2].slice(1).toLowerCase() : null;
}

function normPaper(m: RegExpMatchArray | null): string | null {
  if (!m) return null;
  if (m[1]) return `Paper ${ROMAN[m[1].toLowerCase()] ?? m[1]}`;
  return m[2] ? `Set ${m[2].toUpperCase()}` : null;
}

function normSession(m: RegExpMatchArray | null): string | null {
  if (!m) return null;
  if (m[1]) return MONTHS[m[1].slice(0, m[1].toLowerCase().startsWith("sept") ? 4 : 3).toLowerCase()] ?? m[1];
  return m[2] ? `${m[2][0]!.toUpperCase()}${m[2].slice(1).toLowerCase()} ${ROMAN[m[3]!.toLowerCase()] ?? m[3]}` : null;
}

/**
 * All exam+year tags in a piece of text. `patterns` should list custom
 * exams first (more specific), then BUILTIN_EXAM_PATTERNS.
 */
export function findExamTags(text: string, patterns: ExamPattern[] = BUILTIN_EXAM_PATTERNS): DetectedTag[] {
  const tags: DetectedTag[] = [];
  const taken: [number, number][] = [];
  for (const p of patterns) {
    const re = new RegExp(p.regex.source, p.regex.flags.includes("g") ? p.regex.flags : p.regex.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      if (taken.some(([a, b]) => start >= a && start < b)) continue;
      // Year must follow within ~25 chars ("NEET (UG) - 2023", "JEE Main, 2021").
      const after = text.slice(start + m[0].length, start + m[0].length + 25);
      const y = after.match(YEAR_RE);
      if (!y || y.index === undefined || /[.?]\s/.test(after.slice(0, y.index))) continue;
      // Details (session / shift / paper) live in a bracket right after the year
      // or explicitly match known session/shift/paper keywords.
      const yearEnd = start + m[0].length + y.index + y[0].length;
      const afterYear = text.slice(yearEnd, yearEnd + 60);

      // Check if bracketed: e.g. " (24 Feb Shift 1)" or " [Phase II]"
      let tail = "";
      const bracketMatch = afterYear.match(/^\s*([(\[])([^)\]\n]+)[)\]]/);
      if (bracketMatch) {
        tail = bracketMatch[0];
      } else {
        // Only match explicit keywords like "Shift 1", "Paper 2", "Phase 1"
        const kwMatch = afterYear.match(/^\s*(?:Shift[\s\-–:]*(?:I{1,3}|[1-3]|1st|2nd|3rd)|Paper[\s\-–:]*(?:I{1,2}|[12])|Set[\s\-–:]*[A-Z\d]+|Phase[\s\-–:]*\d+|Morning|Evening)\b/i);
        if (kwMatch) {
          tail = kwMatch[0];
        }
      }
      const end = yearEnd + tail.length;
      tags.push({
        examId: p.examId,
        examLabel: m[0].trim(),
        examName: p.name,
        year: Number(y[1]),
        session: normSession(tail.match(SESSION_RE)),
        shift: normShift(tail.match(SHIFT_RE)),
        paper: normPaper(tail.match(PAPER_RE)),
        raw: text.slice(start, end).trim(),
        index: start,
        length: end - start,
      });
      taken.push([start, end]);
    }
  }
  return tags.sort((a, b) => a.index - b.index);
}

/**
 * A line that is a section heading for an exam sitting: short, and the tag
 * covers most of it ("NEET 2023", "JEE Main 2021 — 24 Feb Shift 1 (Physics)").
 */
export function headingTagForLine(line: string, patterns?: ExamPattern[]): DetectedTag | null {
  const t = line.trim();
  if (!t || t.length > 90) return null;
  // A numbered line is a question, not a heading.
  if (/^\(?\s*(?:Q\.?\s*)?\d{1,3}\s*[.)]\s+\S/.test(t)) return null;
  const tags = findExamTags(t, patterns);
  if (tags.length !== 1) return null;
  const tag = tags[0]!;
  const leftover = (t.slice(0, tag.index) + t.slice(tag.index + tag.length))
    .replace(/[\[\]()\-–—:,|.]/g, " ")
    .replace(/\b(question|questions|paper|solved|pyq|previous|year|years|physics|chemistry|biology|botany|zoology|mathematics|maths|section|part|[a-d])\b/gi, " ")
    .trim();
  return leftover.length <= 12 ? tag : null;
}

/** Removes a trailing / bracketed tag from a question statement ("... [NEET 2019]"). */
export function stripQuestionTag(statement: string, tag: DetectedTag): string {
  const before = statement.slice(0, tag.index).replace(/[\s\[(\-–—,]+$/, "");
  const after = statement.slice(tag.index + tag.length).replace(/^[\s\])\-–—,.]+/, "");
  return `${before}${before && after ? " " : ""}${after}`.trim();
}

export type ResolvedQuestionMeta = {
  examId: string | null;
  examName: string | null;
  examLabel: string | null;
  year: number | null;
  session: string | null;
  shift: string | null;
  paper: string | null;
  method: "ADMIN_DOCUMENT" | "SECTION_HEADING" | "QUESTION_TAG" | "NONE";
  conflicts: string[];
};

/**
 * Decides one question's exam/year from (in order): its own tag, the
 * section heading it sits under, and — only for a single-sitting document —
 * the admin's document-level values. A disagreement is reported, never
 * silently overwritten.
 */
export function resolveQuestionMeta(input: {
  yearMode: "SINGLE" | "MULTI";
  document: { examId: string | null; examName: string | null; year: number | null; session?: string | null; shift?: string | null; paper?: string | null };
  questionTag: DetectedTag | null;
  sectionTag: DetectedTag | null;
}): ResolvedQuestionMeta {
  const { yearMode, document: doc, questionTag, sectionTag } = input;
  const conflicts: string[] = [];
  const fromTag = (t: DetectedTag, method: "QUESTION_TAG" | "SECTION_HEADING"): ResolvedQuestionMeta => ({
    examId: t.examId,
    examName: t.examName,
    examLabel: t.examLabel,
    year: t.year,
    session: t.session,
    shift: t.shift,
    paper: t.paper,
    method,
    conflicts,
  });

  if (yearMode === "SINGLE") {
    const tag = questionTag ?? sectionTag;
    if (tag && doc.year && tag.year !== doc.year) {
      conflicts.push(`Source says ${tag.raw} but the document was imported as ${doc.examName ?? "the exam"} ${doc.year}.`);
    }
    if (tag && doc.examId && tag.examId && tag.examId !== doc.examId) {
      conflicts.push(`Source mentions ${tag.examLabel}, not ${doc.examName}.`);
    }
    if (doc.year || doc.examId) {
      return {
        examId: doc.examId,
        examName: doc.examName,
        examLabel: doc.examName,
        year: doc.year,
        session: doc.session ?? tag?.session ?? null,
        shift: doc.shift ?? tag?.shift ?? null,
        paper: doc.paper ?? tag?.paper ?? null,
        method: "ADMIN_DOCUMENT",
        conflicts,
      };
    }
  }

  if (questionTag) return fromTag(questionTag, "QUESTION_TAG");
  if (sectionTag) return fromTag(sectionTag, "SECTION_HEADING");
  return {
    examId: yearMode === "MULTI" ? doc.examId : null,
    examName: yearMode === "MULTI" ? doc.examName : null,
    examLabel: null,
    year: null,
    session: null,
    shift: null,
    paper: null,
    method: "NONE",
    conflicts,
  };
}
