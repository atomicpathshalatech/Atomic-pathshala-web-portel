import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { moduleUpdateSchema } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const module_ = await prisma.module.findUnique({
      where: { id: params.id },
      include: {
        brandProfile: true,
        pages: { orderBy: { pageNumber: "asc" } },
        versions: { orderBy: { createdAt: "desc" } },
        exportHistory: { orderBy: { createdAt: "desc" } },
        processingJobs: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    });
    if (!module_) return apiError("Module not found", 404);
    return apiSuccess({ module: module_ });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const existing = await prisma.module.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Module not found", 404);

    const input = moduleUpdateSchema.parse(await request.json());

    if (input.brandProfileId) {
      const brand = await prisma.brandProfile.findUnique({ where: { id: input.brandProfileId } });
      if (!brand) return apiError("Brand profile not found", 404);
    }

    const updated = await prisma.module.update({
      where: { id: params.id },
      data: {
        title: input.title,
        subject: input.subject,
        class: input.class,
        batch: input.batch,
        chapter: input.chapter,
        facultyName: input.facultyName,
        academicYear: input.academicYear,
        ...(input.brandProfileId !== undefined && { brandProfileId: input.brandProfileId }),
      },
    });

    return apiSuccess({ module: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_DELETE);

    const existing = await prisma.module.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Module not found", 404);
    if (existing.status === "PUBLISHED") {
      return apiError("Unpublish this module before deleting it.", 409);
    }

    await prisma.module.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MODULE_DELETED",
        entityType: "Module",
        entityId: params.id,
        metadata: { code: existing.code, title: existing.title },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
