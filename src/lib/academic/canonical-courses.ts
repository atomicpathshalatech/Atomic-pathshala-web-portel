/**
 * The canonical, currently-approved course list — the dropdown was
 * previously an unfiltered `prisma.course.findMany()` (every row in the
 * `courses` table, however it got there), when the product only wants
 * exactly these four shown/selectable anywhere a teacher/admin picks a
 * course. Slugs match prisma/seed.ts's SEED_COURSES exactly — the only
 * place Course rows are ever created in this codebase (no course-creation
 * UI/API exists), so this list is authoritative for "approved" regardless
 * of what other rows a re-seed, a manual DB edit, or old test data may
 * have left in the table. "foundation-9th-10th" (seeded alongside these
 * four) is deliberately excluded — not one of the four approved options.
 */
export const CANONICAL_COURSE_SLUGS = [
  "class-11th-science",
  "class-12th-science",
  "neet-ug-2026",
  "jee-main-advanced-2026",
] as const;

export type CanonicalCourseSlug = (typeof CANONICAL_COURSE_SLUGS)[number];

export function isCanonicalCourseSlug(slug: string): slug is CanonicalCourseSlug {
  return (CANONICAL_COURSE_SLUGS as readonly string[]).includes(slug);
}
