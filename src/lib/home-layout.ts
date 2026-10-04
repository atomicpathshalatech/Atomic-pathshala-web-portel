import "server-only";
import { prisma } from "@/lib/db";
import type { LayoutSection } from "@/lib/home-templates";

/**
 * The live homepage layout: the latest published Website Builder version
 * (unless it was unpublished), or null → the page uses DEFAULT_LAYOUT.
 */
export async function getLiveHomeLayout(): Promise<{ versionNumber: number; sections: LayoutSection[] } | null> {
  try {
    // The newest version decides: if it was unpublished, the site goes back to the default layout.
    const live = await prisma.homePageVersion.findFirst({ orderBy: { publishedAt: "desc" } });
    if (!live || live.unpublishedAt || !Array.isArray(live.sectionsSnapshot)) {
      // Fallback: if admin has saved sections in builder but hasn't published a version yet, show them!
      const draftRows = await prisma.homePageSection.findMany({ orderBy: { order: "asc" } });
      if (draftRows.length > 0) {
        const draftSections = draftRows.map((s) => ({
          id: s.id,
          type: s.type as string,
          title: s.title,
          subtitle: s.subtitle,
          visible: s.visible !== false,
          visibleDesktop: s.visibleDesktop !== false,
          visibleMobile: s.visibleMobile !== false,
          config: s.config && typeof s.config === "object" ? (s.config as Record<string, unknown>) : {},
          background: s.background,
          padding: s.padding,
        }));
        return { versionNumber: 0, sections: draftSections };
      }
      return null;
    }
    const sections = (live.sectionsSnapshot as unknown[])
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as Record<string, unknown>).type === "string")
      .map((s) => ({
        id: typeof s.id === "string" ? s.id : undefined,
        type: s.type as string,
        title: typeof s.title === "string" ? s.title : null,
        subtitle: typeof s.subtitle === "string" ? s.subtitle : null,
        visible: s.visible !== false,
        visibleDesktop: s.visibleDesktop !== false,
        visibleMobile: s.visibleMobile !== false,
        config: s.config && typeof s.config === "object" ? (s.config as Record<string, unknown>) : {},
        background: typeof s.background === "string" ? s.background : null,
        padding: typeof s.padding === "string" ? s.padding : null,
      })); // the snapshot is stored in display order
    return sections.length ? { versionNumber: live.versionNumber, sections } : null;
  } catch (error) {
    console.error("getLiveHomeLayout failed, using the default layout:", error);
    return null;
  }
}
