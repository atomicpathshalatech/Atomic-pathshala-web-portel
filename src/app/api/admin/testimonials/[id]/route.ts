import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { testimonialUpdateSchema } from "@/lib/validation/testimonial";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TESTIMONIAL_MANAGE);

    const input = testimonialUpdateSchema.parse(await request.json());

    const existing = await prisma.testimonial.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Testimonial not found.", 404);

    const testimonial = await prisma.testimonial.update({ where: { id: params.id }, data: input });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TESTIMONIAL_UPDATED",
        entityType: "Testimonial",
        entityId: testimonial.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return apiSuccess({ testimonial });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TESTIMONIAL_MANAGE);

    const existing = await prisma.testimonial.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Testimonial not found.", 404);

    await prisma.testimonial.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TESTIMONIAL_DELETED",
        entityType: "Testimonial",
        entityId: params.id,
        metadata: { studentName: existing.studentName },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
