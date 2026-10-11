import "server-only";
import { prisma } from "@/lib/db";
import type { QcQuestionInput } from "./question";

/**
 * NCERT passages that may support a question, found in OUR stored NCERT text
 * (ncert_pages). The class, chapter and page number of every passage come
 * from the database row — a model is only ever asked whether a passage it was
 * shown supports the answer, never to recall a page number.
 */

export type NcertPassage = {
  /** 1-based number the agent uses to point at this passage. */
  index: number;
  documentId: string;
  pageId: string;
  className: string;
  subject: string;
  chapter: string;
  pageNumber: number;
  fileName: string;
  excerpt: string;
  rank: number;
};

const STOPWORDS = new Set(
  "which what when where while with without from that this these those following given correct incorrect statement statements option options about into their there have has been being were was will would could should than then them they both only also most more less such each other between among above below true false assertion reason none all are and the for not its can may does did one two three four find value number called known".split(
    " "
  )
);

/** Distinctive words of the question (LaTeX and markup removed). */
export function questionKeywords(q: QcQuestionInput, max = 12): string[] {
  const answerText = q.options.filter((o) => q.storedAnswer.includes(o.key)).map((o) => o.text).join(" ");
  const raw = `${q.topic ?? ""} ${q.subTopic ?? ""} ${q.statement} ${answerText}`
    .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .toLowerCase();
  const counts = new Map<string, number>();
  for (const word of raw.match(/[a-z]{4,}/g) ?? []) {
    if (STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w);
}

const ncertSubject = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes("bot") || s.includes("zoo") || s.includes("bio")) return "Biology";
  if (s.includes("phys")) return "Physics";
  if (s.includes("chem")) return "Chemistry";
  if (s.includes("math")) return "Mathematics";
  return subject;
};

/** The ~700 characters of the page with the most keyword hits. */
function bestExcerpt(text: string, keywords: string[], size = 700): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean;
  const lower = clean.toLowerCase();
  let best = 0;
  let bestScore = -1;
  for (let start = 0; start < clean.length - size / 2; start += 150) {
    const window = lower.slice(start, start + size);
    const score = keywords.reduce((n, k) => n + (window.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  return (best > 0 ? "…" : "") + clean.slice(best, best + size) + (best + size < clean.length ? "…" : "");
}

/** Up to `limit` passages; [] when there is nothing relevant (or the lookup fails — the review continues without). */
export async function findNcertPassages(q: QcQuestionInput, limit = 3): Promise<NcertPassage[]> {
  const keywords = questionKeywords(q);
  if (keywords.length < 2) return [];
  const tsquery = keywords.join(" | ");
  try {
    const rows = await prisma.$queryRaw<
      { pageId: string; documentId: string; pageNumber: number; fileName: string; chapter: string; subject: string; className: string; text: string; rank: number }[]
    >`
      SELECT p."id" AS "pageId", d."id" AS "documentId", p."pageNumber", d."fileName",
             c."title" AS "chapter", s."name" AS "subject", cl."name" AS "className",
             p."extractedText" AS "text",
             ts_rank_cd(to_tsvector('english', p."extractedText"), to_tsquery('english', ${tsquery})) AS "rank"
      FROM "ncert_pages" p
      JOIN "ncert_documents" d ON d."id" = p."documentId"
      JOIN "academic_subjects" s ON s."id" = d."academicSubjectId"
      JOIN "academic_chapters" c ON c."id" = d."academicChapterId"
      JOIN "academic_classes" cl ON cl."id" = d."academicClassId"
      WHERE d."language" = 'ENGLISH'
        AND s."name" ILIKE ${ncertSubject(q.subject)}
        AND length(p."extractedText") > 200
        AND to_tsvector('english', p."extractedText") @@ to_tsquery('english', ${tsquery})
      ORDER BY "rank" DESC
      LIMIT ${limit}`;
    return rows.map((r, i) => ({
      index: i + 1,
      documentId: r.documentId,
      pageId: r.pageId,
      className: r.className,
      subject: r.subject,
      chapter: r.chapter,
      pageNumber: r.pageNumber,
      fileName: r.fileName,
      excerpt: bestExcerpt(r.text, keywords),
      rank: Number(r.rank),
    }));
  } catch (err) {
    console.warn("[qc_ncert_lookup_warning]", err instanceof Error ? err.message : err);
    return [];
  }
}

export function renderPassages(passages: NcertPassage[]): string {
  if (passages.length === 0) return "REFERENCE PASSAGES: none were found in the NCERT library for this question.";
  return [
    "REFERENCE PASSAGES (from the NCERT library; may or may not be relevant):",
    ...passages.map((p) => `[${p.index}] NCERT ${p.className} ${p.subject}, chapter "${p.chapter}", page ${p.pageNumber}:\n${p.excerpt}`),
  ].join("\n\n");
}
