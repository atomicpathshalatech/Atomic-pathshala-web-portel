/**
 * Pure helpers shared by the PYQ import pipeline, the library API and the
 * migration's backfill (which must produce identical keys in SQL).
 */

/** "JEE Mains", "JEE-Main", "jee main" -> "jeemains"/"jeemain". Years are dropped. */
export function normalizeExamKey(label: string): string {
  return String(label || "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

export function slugifyExamName(name: string): string {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "exam"
  );
}

function part(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * One key per (question, exam, year, session, shift, paper, number) — the
 * same normalisation the migration's backfill uses — so a retried import or
 * a re-uploaded PDF can never create a second identical occurrence.
 */
export function buildOccurrenceKey(o: {
  questionId: string;
  examId: string;
  year?: number | null;
  session?: string | null;
  shift?: string | null;
  paper?: string | null;
  questionNumber?: string | number | null;
}): string {
  return [
    o.questionId,
    o.examId,
    o.year ?? "",
    part(o.session),
    part(o.shift),
    part(o.paper),
    part(o.questionNumber),
  ].join("|");
}

/** "NEET UG 2024", "JEE Main 2021 · January · Shift 1" — only from verified data. */
export function formatOccurrenceLabel(o: {
  examName: string;
  year?: number | null;
  session?: string | null;
  shift?: string | null;
  paper?: string | null;
}): string {
  const head = [o.examName, o.year ?? ""].filter(Boolean).join(" ");
  const tail = [o.session, o.shift, o.paper].filter((x) => x && String(x).trim());
  return tail.length ? `${head} · ${tail.join(" · ")}` : head;
}
