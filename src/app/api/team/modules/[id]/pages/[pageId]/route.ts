import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { modulePageUpdateSchema } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Manual edit of one page's content blocks — this is how a human reviewer
 * fixes whatever the AI extraction pass got wrong (or fills in a scanned
 * page's content from scratch). Every processed page starts with
 * needsReview: true for exactly this reason; saving here with
 * needsReview: false is the reviewer's explicit sign-off.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const page = await prisma.modulePage.findFirst({ where: { id: params.pageId, moduleId: params.id } });
    if (!page) return apiError("Page not found", 404);

    const input = modulePageUpdateSchema.parse(await request.json());

    const updated = await prisma.modulePage.update({
      where: { id: params.pageId },
      data: {
        elements: input.elements,
        ...(input.needsReview !== undefined && { needsReview: input.needsReview }),
      },
    });

    // If every page on this module is now clear of review flags, and the
    // module was only sitting in REVIEW_REQUIRED because of that, promote
    // it to READY automatically — otherwise a reviewer would have to
    // remember to flip the module's own status by hand after clearing the
    // last page.
    const moduleRow = await prisma.module.findUnique({ where: { id: params.id } });
    if (moduleRow?.status === "REVIEW_REQUIRED") {
      const stillNeedsReview = await prisma.modulePage.count({ where: { moduleId: params.id, needsReview: true } });
      if (stillNeedsReview === 0) {
        await prisma.module.update({ where: { id: params.id }, data: { status: "READY" } });
      }
    }

    return apiSuccess({ page: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
