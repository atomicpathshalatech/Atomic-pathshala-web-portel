import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { moduleVersionCreateSchema } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const versions = await prisma.moduleVersion.findMany({
      where: { moduleId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Snapshots every page's current elements as one named, restorable point in time. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (!moduleRow) return apiError("Module not found", 404);

    const input = moduleVersionCreateSchema.parse(await request.json());

    const snapshot = moduleRow.pages.map((p) => ({ pageNumber: p.pageNumber, elements: p.elements }));

    const version = await prisma.moduleVersion.create({
      data: { moduleId: params.id, label: input.label, snapshot, createdById: session.user.id },
    });

    return apiSuccess({ version }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
