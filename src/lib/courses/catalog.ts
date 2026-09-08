import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const COURSE_CATALOG_TAG = "course-catalog";

/**
 * Active/upcoming batch catalogue for the student-facing course listing.
 *
 * This query is completely student-agnostic (no user filter) and its result
 * is identical for every viewer, yet `(student)/courses/page.tsx` re-ran it
 * — a multi-join `findMany` against the cross-region DB — on every single
 * visit. Wrapped in `unstable_cache` with a 5-minute revalidate window so
 * the common case is served from the Next data cache with zero DB round
 * trips. Soft stats on the cards (`enrollmentCount`) may lag by up to 5 min,
 * which is fine for a listing. Mutation routes can also call
 * `revalidateTag(COURSE_CATALOG_TAG)` for an immediate refresh.
 */
export const getActiveBatchCatalog = unstable_cache(
  async () => {
    return prisma.batch.findMany({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      include: {
        course: { include: { subjects: true } },
        teachers: {
          include: { teacher: { include: { user: { select: { name: true } } } } },
        },
        _count: { select: { enrollments: true, schedules: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
  ["active-batch-catalog"],
  { revalidate: 300, tags: [COURSE_CATALOG_TAG] }
);
