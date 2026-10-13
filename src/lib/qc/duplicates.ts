import { createHash } from "node:crypto";
import { normalizeAnswerKeys, normalizeOptions } from "./question";

/**
 * Finds questions in the Question Bank that look like the same question.
 *
 * Everything here is plain text comparison — no model is called, so a scan
 * costs nothing and gives the same result every time. What it can find:
 *   EXACT_DUPLICATE     same text and same options, character for character
 *   FORMAT_DUPLICATE    same after ignoring formatting, case, punctuation and option order
 *   STRUCTURAL_VARIANT  same wording with different numbers
 *   NEEDS_MANUAL_REVIEW wording very close, or the same statement with other options
 * What it cannot find: the same problem in different words, a Hindi question
 * against an English one, or equal pictures. Those need a later step.
 *
 * A candidate is only a suggestion. Nothing is merged or removed here.
 */

export type DuplicateCategory = "EXACT_DUPLICATE" | "FORMAT_DUPLICATE" | "STRUCTURAL_VARIANT" | "NEEDS_MANUAL_REVIEW";

export type DuplicateRow = {
  id: string;
  subject: string;
  type: string;
  imageUrl: string | null;
  translations: { language: string; statement: string; options: unknown; correctOptionIds: unknown }[];
};

export type DuplicateCandidate = {
  questionAId: string;
  questionBId: string;
  category: DuplicateCategory;
  /** 0–1. 1 for hash matches; the text similarity otherwise. */
  score: number;
  method: string;
  language: string;
  /** Do the two keyed answers say the same thing? null when one has no key. */
  sameAnswer: boolean | null;
  note: string;
};

/** How close two wordings must be to be shown to a person. */
export const SIMILARITY_THRESHOLD = 0.88;

const sha = (value: string) => createHash("sha1").update(value).digest("hex");

/** Pictures stay in the text as a token, so the same words around different pictures are not "the same question". */
const pictureTokens = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g, (_m, url: string) => ` img${sha(url).slice(0, 10)} `)
    .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, url: string) => ` img${sha(url).slice(0, 10)} `);

/** Whitespace-only clean-up: what "character for character" means here. */
export const lightNormalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Formatting, case and punctuation removed; letters and digits of any script kept. */
export function deepNormalize(text: string): string {
  return pictureTokens(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, " ")
    .replace(/\\(?:text|mathrm|mathbf|mathit|rm|bf|left|right|displaystyle|,|;|!|quad|qquad)\b/g, " ")
    .replace(/[$\\{}*_`~^#|[\]()]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}.+\-=/<>%]+/gu, " ")
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The wording with every number replaced by a placeholder. */
export const maskNumbers = (normalized: string) => normalized.replace(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g, "#");

const tokens = (normalized: string) => normalized.split(" ").filter(Boolean);

/** Word-pair overlap (Jaccard) of two normalized texts. */
export function textSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const grams = (t: string[]) => {
    const set = new Set<string>();
    if (t.length === 1) set.add(t[0]!);
    for (let i = 0; i < t.length - 1; i++) set.add(`${t[i]} ${t[i + 1]}`);
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / (A.size + B.size - shared);
}

type View = {
  id: string;
  subject: string;
  language: string;
  exact: string;
  format: string;
  statement: string;
  statementTokens: string[];
  options: string[];
  masked: string;
  hasNumbers: boolean;
  /** Normalized text of the keyed option(s), or the keyed value. */
  answer: string | null;
};

function viewsOf(row: DuplicateRow): View[] {
  const views: View[] = [];
  for (const t of row.translations) {
    if (!t.statement?.trim()) continue;
    const picture = row.imageUrl ? ` img${sha(row.imageUrl).slice(0, 10)}` : "";
    const options = normalizeOptions(t.options);
    const statement = deepNormalize(t.statement) + picture;
    const optionTexts = options.map((o) => deepNormalize(o.text));
    const keys = normalizeAnswerKeys(t.correctOptionIds);
    const keyed = options.length ? keys.map((k) => deepNormalize(options.find((o) => o.key === k)?.text ?? "")).filter(Boolean).sort() : keys.map((k) => deepNormalize(k));
    const all = [statement, ...optionTexts].join(" | ");
    views.push({
      id: row.id,
      subject: row.subject,
      language: t.language.toUpperCase(),
      exact: sha(JSON.stringify([lightNormalize(t.statement) + picture, options.map((o) => lightNormalize(o.text))])),
      format: sha(JSON.stringify([statement, [...optionTexts].sort()])),
      statement,
      statementTokens: tokens(statement),
      options: optionTexts,
      masked: sha(maskNumbers(JSON.stringify([statement, [...optionTexts].sort()]))),
      hasNumbers: /\d/.test(all),
      answer: keyed.length ? keyed.join(" & ") : null,
    });
  }
  return views;
}

const RANK: Record<DuplicateCategory, number> = { EXACT_DUPLICATE: 4, FORMAT_DUPLICATE: 3, STRUCTURAL_VARIANT: 2, NEEDS_MANUAL_REVIEW: 1 };

const optionOverlap = (a: string[], b: string[]) => {
  if (a.length === 0 && b.length === 0) return 1;
  const B = new Set(b);
  const shared = a.filter((x) => B.has(x)).length;
  return shared / Math.max(a.length, b.length);
};

/**
 * All duplicate candidates among the given questions. Questions are only
 * compared within one subject and one language.
 */
export function findDuplicateCandidates(rows: DuplicateRow[]): DuplicateCandidate[] {
  const best = new Map<string, DuplicateCandidate>();
  const offer = (a: View, b: View, category: DuplicateCategory, score: number, method: string, note: string) => {
    if (a.id === b.id) return;
    const [x, y] = a.id < b.id ? [a, b] : [b, a];
    const key = `${x.id}|${y.id}`;
    const current = best.get(key);
    if (current && (RANK[current.category] > RANK[category] || (RANK[current.category] === RANK[category] && current.score >= score))) return;
    best.set(key, {
      questionAId: x.id,
      questionBId: y.id,
      category,
      score: Math.round(score * 1000) / 1000,
      method,
      language: a.language,
      sameAnswer: x.answer === null || y.answer === null ? null : x.answer === y.answer,
      note,
    });
  };

  const groups = new Map<string, View[]>();
  for (const row of rows) for (const v of viewsOf(row)) {
    const key = `${v.subject}|${v.language}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }

  const bucket = (views: View[], keyOf: (v: View) => string | null, each: (a: View, b: View) => void) => {
    const map = new Map<string, View[]>();
    for (const v of views) {
      const k = keyOf(v);
      if (k) (map.get(k) ?? map.set(k, []).get(k)!).push(v);
    }
    for (const list of map.values()) {
      // A very large bucket is a stock phrase ("Choose the correct statement"), not a duplicate.
      if (list.length < 2 || list.length > 40) continue;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) each(list[i]!, list[j]!);
    }
  };

  for (const views of groups.values()) {
    bucket(views, (v) => v.exact, (a, b) => offer(a, b, "EXACT_DUPLICATE", 1, "exact text", "The text and the options are identical."));
    bucket(views, (v) => v.format, (a, b) =>
      offer(a, b, "FORMAT_DUPLICATE", 1, "normalized text", a.options.join("|") === b.options.join("|") ? "Same question; only formatting, case or punctuation differs." : "Same question with the options in a different order.")
    );
    bucket(views, (v) => (v.hasNumbers ? v.masked : null), (a, b) => {
      if (a.format !== b.format) offer(a, b, "STRUCTURAL_VARIANT", 0.95, "same wording, different numbers", "The wording is the same and only the numbers differ. This can be a valid separate question.");
    });
    bucket(views, (v) => (v.statementTokens.length >= 6 ? v.statement : null), (a, b) => {
      if (a.format === b.format) return;
      const overlap = optionOverlap(a.options, b.options);
      if (overlap >= 0.5) offer(a, b, "NEEDS_MANUAL_REVIEW", 0.9, "same statement", `The statement is the same; ${Math.round(overlap * 100)}% of the options are the same.`);
    });

    // Close wording: compare only texts of similar length that share a rare word.
    const full = views.map((v) => ({ v, t: tokens([v.statement, ...[...v.options].sort()].join(" ")) })).filter((x) => x.t.length >= 8);
    const frequency = new Map<string, number>();
    for (const x of full) for (const w of new Set(x.t)) frequency.set(w, (frequency.get(w) ?? 0) + 1);
    const index = new Map<string, number[]>();
    full.forEach((x, i) => {
      const rare = [...new Set(x.t)].sort((p, q) => frequency.get(p)! - frequency.get(q)!).slice(0, 4);
      for (const w of rare) (index.get(w) ?? index.set(w, []).get(w)!).push(i);
    });
    const seen = new Set<string>();
    for (const list of index.values()) {
      if (list.length > 60) continue;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = full[list[i]!]!;
        const b = full[list[j]!]!;
        if (a.v.id === b.v.id) continue;
        const key = `${list[i]}|${list[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ratio = Math.min(a.t.length, b.t.length) / Math.max(a.t.length, b.t.length);
        if (ratio < 0.75) continue;
        const score = textSimilarity(a.t, b.t);
        if (score >= SIMILARITY_THRESHOLD && a.v.format !== b.v.format) offer(a.v, b.v, "NEEDS_MANUAL_REVIEW", score, "close wording", `The wording is ${Math.round(score * 100)}% the same.`);
      }
    }
  }

  return [...best.values()].sort((a, b) => RANK[b.category] - RANK[a.category] || b.score - a.score);
}
