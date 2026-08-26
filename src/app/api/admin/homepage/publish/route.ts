import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { homepagePublishSchema } from "@/lib/validation/homepage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Snapshots the current DRAFT (HomePageSection rows) into an immutable
 * HomePageVersion. The public site only ever reads the latest
 * non-unpublished version — it never reads HomePageSection directly — so
 * draft edits never leak to visitors until this runs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_PUBLISH);

    const input = homepagePublishSchema.parse(await request.json().catch(() => ({})));

    const sections = await prisma.homePageSection.findMany({ orderBy: { order: "asc" } });
    if (sections.length === 0) {
      return apiError("Add at least one section before publishing.", 400);
    }

    const lastVersion = await prisma.homePageVersion.findFirst({ orderBy: { versionNumber: "desc" } });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.homePageVersion.create({
      data: {
        versionNumber,
        sectionsSnapshot: sections,
        note: input.note,
        publishedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOMEPAGE_PUBLISHED",
        entityType: "HomePageVersion",
        entityId: version.id,
        metadata: { versionNumber, sectionCount: sections.length },
      },
    });

    return apiSuccess({ version }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
