import { normalizeText, tokenize } from "@/lib/search/normalize";
import type { SearchResult, SearchEntityType } from "@/lib/search/types";

/** Type nudges so a person beats a document on an equal text score. */
const TYPE_WEIGHT: Record<SearchEntityType, number> = {
  teacher: 6,
  student: 5,
  team_member: 5,
  class: 4,
  recording: 3,
  batch: 4,
  course: 3,
  subject: 3,
  chapter: 3,
  lecture: 2,
  test_series: 2,
  test: 2,
  module: 1,
  study_material: 1,
  question: 1,
};

/**
 * Score one result against the raw query. Higher = more relevant.
 *  - exact normalised title match ....... 100
 *  - title starts with the query ......... 80
 *  - every token present, in order ....... 62
 *  - every token present (any order) ..... 50
 *  - some tokens present ................. up to 34
 * plus a small type weight so ties resolve sensibly.
 */
export function scoreResult(result: SearchResult, rawQuery: string): number {
  const q = normalizeText(rawQuery);
  const tokens = tokenize(rawQuery);
  const hayTitle = normalizeText(result.title);
  const haySub = normalizeText(result.subtitle ?? "");
  const hay = `${hayTitle} ${haySub}`.trim();

  let base = 0;
  if (hayTitle === q && q.length > 0) base = 100;
  else if (q.length > 0 && hayTitle.startsWith(q)) base = 80;
  else if (tokens.length > 0 && hay.includes(tokens.join(" "))) base = 62;
  else if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) base = 50;
  else {
    const hits = tokens.filter((t) => hay.includes(t)).length;
    base = tokens.length > 0 ? Math.round((hits / tokens.length) * 34) : 0;
  }

  // No textual overlap at all — not a match, regardless of type weight.
  if (base <= 0) return 0;

  // Title hits are worth more than subtitle-only hits.
  if (tokens.length > 0 && tokens.every((t) => hayTitle.includes(t))) base += 6;

  return base + (TYPE_WEIGHT[result.type] ?? 0);
}

export function rankResults(results: SearchResult[], rawQuery: string): SearchResult[] {
  return results
    .map((r) => ({ ...r, score: scoreResult(r, rawQuery) }))
    .filter((r) => (r.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
