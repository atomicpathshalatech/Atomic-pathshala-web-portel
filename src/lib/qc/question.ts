import { createHash } from "node:crypto";

/**
 * The question as the QC agents see it — built from the Question Bank row,
 * or by hand in tests. Nothing here talks to a model or the database.
 */

export type QcOption = { key: string; text: string };

export type QcQuestionInput = {
  id: string;
  code?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  microConcept?: string | null;
  type: string; // SINGLE_CORRECT | MULTIPLE_CORRECT | NUMERICAL | INTEGER | ASSERTION_REASON | STATEMENT_BASED | MATCH_COLUMN
  difficulty?: string | null;
  examLevel?: string | null;
  /** The language the agents read (English when the question has it). */
  language: "ENGLISH" | "HINDI";
  statement: string;
  options: QcOption[];
  /** The stored answer key: option letters, or the value for NUMERICAL / INTEGER. */
  storedAnswer: string[];
  solution?: string | null;
  /** The other language's answer key, when the question is bilingual. */
  otherLanguageAnswer?: string[] | null;
  /** The question needs a picture to be answered (figure, graph, structure image). */
  hasImage: boolean;
};

type TranslationRow = { language: string; statement: string; options: unknown; correctOptionIds: unknown; solution: string | null };
type QuestionRow = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  microConcept: string | null;
  type: string;
  difficulty: string;
  examLevel: string | null;
  imageUrl: string | null;
  solution: string | null;
  translations: TranslationRow[];
};

export function normalizeOptions(raw: unknown): QcOption[] {
  if (Array.isArray(raw)) {
    return raw
      .map((o, i) => {
        if (typeof o === "string") return { key: String.fromCharCode(65 + i), text: o };
        if (o && typeof o === "object") {
          const r = o as Record<string, unknown>;
          const key = String(r.key ?? r.id ?? r.label ?? String.fromCharCode(65 + i)).trim().toUpperCase();
          const text = String(r.text ?? r.value ?? r.content ?? "").trim();
          return { key, text };
        }
        return null;
      })
      .filter((o): o is QcOption => o !== null && o.text !== "");
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => ({ key: key.trim().toUpperCase(), text: String(value ?? "").trim() }))
      .filter((o) => o.text !== "");
  }
  return [];
}

export function normalizeAnswerKeys(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
  return list.map((x) => String(x).trim()).filter(Boolean).map((x) => (/^[a-z]$/i.test(x) ? x.toUpperCase() : x));
}

const hasPicture = (text: string | null | undefined) => Boolean(text && /!\[[^\]]*\]\([^)]+\)|<img\b/i.test(text));

/** Builds the agents' view of a Question Bank row. Null when it has no readable translation. */
export function toQcQuestion(row: QuestionRow): QcQuestionInput | null {
  const byLang = (l: string) => row.translations.find((t) => t.language.toUpperCase() === l);
  const en = byLang("ENGLISH");
  const hi = byLang("HINDI");
  const main = en ?? hi ?? row.translations[0];
  if (!main || !main.statement?.trim()) return null;
  const other = main === en ? hi : en;
  const options = normalizeOptions(main.options);
  return {
    id: row.id,
    code: row.questionCode,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    subTopic: row.subTopic,
    microConcept: row.microConcept,
    type: row.type,
    difficulty: row.difficulty,
    examLevel: row.examLevel,
    language: main.language.toUpperCase() === "HINDI" ? "HINDI" : "ENGLISH",
    statement: main.statement,
    options,
    storedAnswer: normalizeAnswerKeys(main.correctOptionIds),
    solution: main.solution || row.solution,
    otherLanguageAnswer: other ? normalizeAnswerKeys(other.correctOptionIds) : null,
    hasImage: Boolean(row.imageUrl) || hasPicture(main.statement) || options.some((o) => hasPicture(o.text)),
  };
}

/** Changes whenever anything a review depends on changes — a review is reused only for the same hash. */
export function qcContentHash(q: QcQuestionInput): string {
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const body = JSON.stringify([
    norm(q.subject),
    q.type,
    norm(q.statement),
    q.options.map((o) => [o.key, norm(o.text)]),
    [...q.storedAnswer].sort(),
    norm(q.solution),
    norm(q.chapter),
    norm(q.topic),
    norm(q.subTopic),
    q.difficulty ?? "",
  ]);
  return createHash("sha256").update(body).digest("hex");
}

export const isValueAnswerType = (type: string) => type === "NUMERICAL" || type === "INTEGER";

/** The question text given to a model. `withSolution: false` hides the stored key and solution (independent solving). */
export function renderQuestion(q: QcQuestionInput, opts: { withStoredAnswer: boolean; withSolution: boolean }): string {
  const lines: string[] = [];
  lines.push(`Subject: ${q.subject}`);
  if (q.examLevel) lines.push(`Exam: ${q.examLevel}`);
  lines.push(`Question type: ${q.type}`);
  lines.push(`Stored classification: chapter="${q.chapter ?? ""}", topic="${q.topic ?? ""}", sub-topic="${q.subTopic ?? ""}", difficulty=${q.difficulty ?? "?"}`);
  lines.push("", "QUESTION:", q.statement.trim());
  if (q.options.length) {
    lines.push("", "OPTIONS:");
    for (const o of q.options) lines.push(`(${o.key}) ${o.text}`);
  }
  if (q.hasImage) lines.push("", "NOTE: this question has a picture that you cannot see.");
  if (opts.withStoredAnswer) lines.push("", `STORED ANSWER KEY: ${q.storedAnswer.join(", ") || "(none stored)"}`);
  if (opts.withSolution) lines.push("", "STORED SOLUTION:", (q.solution ?? "").trim() || "(none stored)");
  return lines.join("\n");
}
