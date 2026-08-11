import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.ONBOARDING_REVIEW);

    const applications = await prisma.teacher.findMany({
      where: { onboardingStatus: { not: "ACTIVE" } },
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        documents: { select: { type: true, status: true } },
        contracts: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ applications });
  } catch (error) {
    return handleApiError(error);
  }
}
