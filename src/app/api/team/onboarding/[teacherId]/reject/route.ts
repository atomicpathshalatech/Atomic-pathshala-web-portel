import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const rejectSchema = z.object({ reason: z.string().min(3, "Please provide a reason") });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const { teacherId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.ONBOARDING_REVIEW);

    const { reason } = rejectSchema.parse(await request.json());

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) return apiError("Faculty member not found.", 404);
    if (teacher.onboardingStatus === "ACTIVE") {
      return apiError("This educator is already active and can't be rejected.", 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id: teacherId },
        data: { onboardingStatus: "REJECTED" },
      });
      await tx.user.update({
        where: { id: teacher.userId },
        data: { status: "SUSPENDED" },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ONBOARDING_REJECTED",
          entityType: "Teacher",
          entityId: teacherId,
          metadata: { reason },
        },
      });
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
