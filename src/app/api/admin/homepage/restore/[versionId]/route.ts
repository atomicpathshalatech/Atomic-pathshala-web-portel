import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

type SnapshotSection = {
  type: string;
  title: string | null;
  subtitle: string | null;
  order: number;
  visible: boolean;
  visibleDesktop: boolean;
  visibleMobile: boolean;
  config: Prisma.JsonValue;
  background: string | null;
  padding: string | null;
  createdById: string;
};

/**
 * Restore = copy an old version's snapshot back into the live DRAFT table
 * AND immediately publish a fresh version from it. Nothing from the old
 * version's history is destroyed (the version being restored FROM stays
 * in the version list), and the draft becomes editable again from the
 * restored state rather than the admin having to also click Publish.
 */
export async function POST(_request: Request, { params }: { params: { versionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_PUBLISH);

    const source = await prisma.homePageVersion.findUnique({ where: { id: params.versionId } });
    if (!source) return apiError("Version not found.", 404);

    const snapshot = source.sectionsSnapshot as unknown as SnapshotSection[];
    if (!Array.isArray(snapshot)) return apiError("This version's snapshot is unreadable.", 422);

    const lastVersion = await prisma.homePageVersion.findFirst({ orderBy: { versionNumber: "desc" } });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const restored = await prisma.$transaction(async (tx) => {
      await tx.homePageSection.deleteMany({});
      await tx.homePageSection.createMany({
        data: snapshot.map((s) => ({
          type: s.type as never,
          title: s.title,
          subtitle: s.subtitle,
          order: s.order,
          visible: s.visible,
          visibleDesktop: s.visibleDesktop,
          visibleMobile: s.visibleMobile,
          config: s.config ?? {},
          background: s.background,
          padding: s.padding,
          createdById: s.createdById ?? session.user.id,
          updatedById: session.user.id,
        })),
      });

      const newSections = await tx.homePageSection.findMany({ orderBy: { order: "asc" } });

      return tx.homePageVersion.create({
        data: {
          versionNumber,
          sectionsSnapshot: newSections,
          note: `Restored from version ${source.versionNumber}`,
          publishedById: session.user.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOMEPAGE_RESTORED",
        entityType: "HomePageVersion",
        entityId: restored.id,
        metadata: { restoredFromVersion: source.versionNumber, newVersionNumber: versionNumber },
      },
    });

    return apiSuccess({ version: restored });
  } catch (error) {
    return handleApiError(error);
  }
}
