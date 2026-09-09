/**
 * Text normalisation for the global search + AI search.
 *
 * People search must treat "Firoz", "Ali", "Firoz Ali", "firoz ali",
 * " FIROZ  ALI ", and "Firoz sir" as the same person. We do that WITHOUT a
 * schema change or a search engine: normalise the query, split it into
 * tokens (dropping honorifics), and AND each token as a case-insensitive
 * `contains` against the stored name. Token-AND makes word order and
 * partial words irrelevant, which is exactly the tolerance the spec asks
 * for.
 */

const HONORIFICS = new Set([
  "sir",
  "sr",
  "maam",
  "ma'am",
  "madam",
  "mam",
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "professor",
  "teacher",
  "faculty",
  "ji",
]);

/** lowercase, strip diacritics, collapse all whitespace/punctuation runs to
 *  a single space, trim. " Firoz   Ali! " -> "firoz ali" */
export function normalizeText(input: string): string {
  return (input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Normalised tokens with honorifics removed. "Firoz Sir" -> ["firoz"] */
export function tokenize(input: string): string[] {
  const norm = normalizeText(input);
  if (!norm) return [];
  const tokens = norm.split(" ").filter((t) => t.length > 0 && !HONORIFICS.has(t));
  // If the query was ONLY an honorific ("sir"), fall back to the raw tokens
  // so we still search for something rather than everything.
  return tokens.length > 0 ? tokens : norm.split(" ").filter(Boolean);
}

/**
 * Prisma where-fragment that matches a stored text field against every
 * query token (case-insensitive, order-independent, partial). Pass the
 * field name, e.g. nameContainsAll("name", tokens).
 */
export function containsAll(field: string, tokens: string[]): Record<string, unknown> {
  return {
    AND: tokens.map((t) => ({ [field]: { contains: t, mode: "insensitive" } })),
  };
}

/**
 * Like containsAll but matches when every token appears in ANY of the
 * given fields (the token can land in a different column each time).
 * Useful for "firoz current electricity" style compound queries against
 * {teacher name} + {chapter/title}.
 */
export function containsAllAcross(fields: string[], tokens: string[]): Record<string, unknown> {
  return {
    AND: tokens.map((t) => ({
      OR: fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" } })),
    })),
  };
}

/** Strip honorifics but keep order/spacing — for display + AI prompts. */
export function stripHonorifics(input: string): string {
  return tokenize(input).join(" ");
}
