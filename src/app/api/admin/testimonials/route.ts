import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { testimonialCreateSchema } from "@/lib/validation/testimonial";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TESTIMONIAL_MANAGE);

    const testimonials = await prisma.testimonial.findMany({ orderBy: { order: "asc" } });
    return apiSuccess({ testimonials });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TESTIMONIAL_MANAGE);

    const input = testimonialCreateSchema.parse(await request.json());

    const testimonial = await prisma.testimonial.create({
      data: { ...input, createdById: session.user.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TESTIMONIAL_CREATED",
        entityType: "Testimonial",
        entityId: testimonial.id,
        metadata: { studentName: testimonial.studentName },
      },
    });

    return apiSuccess({ testimonial }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
