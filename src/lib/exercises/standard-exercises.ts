/**
 * The exercises every chapter module has, in this order. A new chapter module
 * gets all of them at once ("New Exercise" → subject → chapter), each with its
 * own type (which decides its starting sections: topics, exam years, or the
 * NCERT / NCERT Exemplar parts).
 */

export const STANDARD_EXERCISES = [
  { title: "Exercise 1", exerciseType: "TOPIC_WISE" },
  { title: "Exercise 2", exerciseType: "ADVANCED" },
  { title: "Exercise 3", exerciseType: "NEET_PYQ" },
  { title: "Exercise 4", exerciseType: "JEE_PYQ" },
  { title: "Exercise 5", exerciseType: "MIXED" },
  { title: "NCERT & NCERT Exemplar", exerciseType: "NCERT" },
] as const;

export const NCERT_EXERCISE_TITLE = "NCERT & NCERT Exemplar";

/** Sort key: Exercise 1…5 in number order, then NCERT, then anything else by name. */
export function exerciseOrderKey(title: string, exerciseType?: string | null): number {
  const m = title.trim().match(/^exercise\s*(\d+)/i);
  if (m) return Number(m[1]);
  if (exerciseType === "NCERT" || /ncert/i.test(title)) return 100;
  return 200;
}

export function sortChapterExercises<T extends { title: string; exerciseType?: string | null; createdAt?: Date | string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      exerciseOrderKey(a.title, a.exerciseType) - exerciseOrderKey(b.title, b.exerciseType) ||
      a.title.localeCompare(b.title) ||
      String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
  );
}

/**
 * A PDF extraction started from an exercise carries its target in the job's
 * tags ("exercise:<id>", "exercise-section:<id>"), so its questions are added
 * to that exercise when they are imported (draft-importer.ts).
 */
export function exerciseTargetTags(exerciseId: string, sectionId?: string | null): string[] {
  return [`exercise:${exerciseId}`, ...(sectionId ? [`exercise-section:${sectionId}`] : [])];
}

export function exerciseTargetOf(tags: string[] | null | undefined): { exerciseId: string; sectionId: string | null } | null {
  const ex = tags?.find((t) => t.startsWith("exercise:"));
  if (!ex) return null;
  const sec = tags?.find((t) => t.startsWith("exercise-section:"));
  return { exerciseId: ex.slice("exercise:".length), sectionId: sec ? sec.slice("exercise-section:".length) : null };
}
