import { prisma } from "@/lib/db";
import { getActiveFounder } from "@/lib/founder";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Public endpoint — the ONLY thing the marketing homepage ever reads.
 * Deliberately never touches HomePageSection (the draft table): a live
 * visitor must only ever see an explicitly published, immutable snapshot.
 * No published version yet (or the live one was unpublished) -> the
 * caller (src/app/(public)/page.tsx) falls back to the static landing
 * page exactly as it exists today.
 */
export async function GET() {
  try {
    const [live, founder] = await Promise.all([
      prisma.homePageVersion.findFirst({
        where: { unpublishedAt: null },
        orderBy: { publishedAt: "desc" },
      }),
      // Shared by website + app: same canonical founder record, no duplication.
      getActiveFounder(),
    ]);

    if (!live) return apiSuccess({ published: false, sections: [] as unknown[], founder });

    const sections = Array.isArray(live.sectionsSnapshot) ? live.sectionsSnapshot : [];

    return apiSuccess({
      published: true,
      versionNumber: live.versionNumber,
      publishedAt: live.publishedAt,
      sections,
      founder,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
