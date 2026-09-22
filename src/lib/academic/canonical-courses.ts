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

/**
 * Strips 4-digit years (e.g. 2024, 2025, 2026, 2027, 2028, 2029) from batch & course titles,
 * and cleans up dangling brackets, double spaces, and hyphens.
 */
export function cleanBatchName(name?: string | null): string {
  if (!name) return "";
  return name
    .replace(/\b20\d{2}\b/g, "") // Remove 2024, 2025, 2026, 2027, 2028 etc.
    .replace(/\(\s*\)/g, "")     // Remove empty parentheses
    .replace(/\s{2,}/g, " ")     // Collapse multiple spaces
    .replace(/\s+-\s*$/, "")     // Remove trailing hyphen
    .replace(/-\s+-/g, "-")      // Clean double hyphens
    .trim();
}

/**
 * Formats multi-line descriptions so that:
 * - Existing newlines and paragraph breaks are preserved.
 * - Point-wise bullet points (•, -, *) start on new lines.
 * - Section headers like "Highlights:", "Target Batch:" get appropriate spacing.
 */
export function formatDescriptionText(text?: string | null): string {
  if (!text) return "";
  let formatted = text.trim();

  // If inline bullets exist (e.g. "foo • bar • baz"), ensure they get a newline
  formatted = formatted.replace(/([^\n])\s+([•\u2022\*\-])\s+/g, "$1\n$2 ");

  // Ensure major section headings get a newline before them if not already on one
  const sectionHeadings = [
    "Test Series Highlights:",
    "Batch Highlights:",
    "Target Batch:",
    "Target Students:",
    "Target Examination:",
    "Medium:",
    "Goal:",
    "Key Features:",
    "Course Includes:",
  ];

  for (const heading of sectionHeadings) {
    const reg = new RegExp(`([^\\n])\\s*(${heading})`, "gi");
    formatted = formatted.replace(reg, "$1\n\n$2");
  }

  return formatted;
}

